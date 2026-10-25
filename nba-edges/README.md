# NBA Edges

NBA matchup alerts sent to ntfy: per-game stat projections (projection boosts, and prop lines when `ODDS_API_KEY` is set). Shot-zone edge alerts exist but are off by default, per the backtest. It's the NBA version of `launch-angle/`, comparing a player's own tendencies with what tonight's opponent gives up.

## Model (`model.js`)

- **Shot-zone matchups:** the player's per-game FGA and FG% by zone (rim, paint, mid-range, left/right corner 3, above-the-break 3), with FG% shrunk by 30 league-average attempts. Each zone is weighted by how well the opponent defends it (opponent-allowed FG% ÷ league) and how often they allow it (√ of zone-share ÷ league). Both factors are clamped to 0.85–1.15. The output is points gained or lost from the shot mix.
- **Projections** for PTS, REB, AST and 3PM start from the season average and apply:
  - minutes: 50/50 season and last-10
  - the zone factor
  - scoring environment: implied team total from the ESPN total/spread ÷ team PPG, or opponent pace
  - opponent rebounds and assists allowed ÷ league
  - blowout trim for starters when the spread is 12 or more
  - teammates ruled out: their minutes go to the rest of the rotation, weighted toward players with room to play more (MIN × (36 − MIN)), at a quarter strength (`NBA_OUT_MIN_SCALE` 0.25). Per-minute production gets a small usage bump: 0.15 × the share of that stat the team lost (`NBA_OUT_USAGE` 0.15). This only counts players who have been playing, since a long absence is already in everyone's averages.
- **Season blend:** until a player has about 15 games, last season is mixed in.
- **Calibration** (`calibrate`, `sdOf`; the `CAL` constants, fit by the backtest on 2024–26). Every alert uses it:
  - starters (20+ MPG) keep only k (0.6–0.8) of the projection's gap from their average; bench players keep all of it
  - then every projection is pulled toward the middle (beta ≈ 0.94): a 28+ ppg scorer comes in about 2 under his average
  - the prop probability uses the real spread, sd = a + b·√projection. The old fixed spreads were about 2/3 of it in the 8–20 pt range, so "90%" picks were really ~75%.
  - Alerts show the calibrated projection; picks log it as `proj` and the raw one as `projRaw`.

## Backtest (`backtest.js`, results in `BACKTEST.md`)

`node nba-edges/backtest.js` replays 2024–25 (the fit season) and 2025–26 (out of sample) with the bot's own `projectSide`/`flagRows`. There's no look-ahead: stats are season-to-date as of the day before each weekly bucket, blended with the prior season. Rosters and games played come from the box scores in date order (a player belongs to the team he last appeared for), because nba.com's historical snapshots list each player's *current* team. The first run downloads about 400 nba.com snapshots and 2,500 ESPN box scores into `.cache/bt`. Reruns take about 20 seconds.

- **The original teammate-out rule overshot about 5x.** It gave everyone +70% × lost/remaining, capped at +25%, and made projections 5–7% worse than the plain season average. Grid search picked a quarter-strength minutes shift with a small usage bump (0.15). The bump is marginal: usage 0 did a hair better out of sample. Anything stronger overshoots.
- **Points boosts are the real signal.** With that setting, flagged points boosts beat the player's average 72% / 63% of the time, against a 48% / 46% baseline. They delivered more than promised (+2.6 promised → +4.9, and +2.7 → +3.2 out of sample).
- **Other starter boosts are too few to judge.** Only 1–18 rebound, assist and three flags a season.
- **Shot-zone edges are noise.** They promised about +2 pts and delivered +0.2–0.3, so shot-zone alerts are off by default (`ZONE_MIN` 99). The zone factor stays in the projections.
- **Bench players (10–20 MPG) are where teammate-out news pays.** They're projected by default (`MIN_PROJ` 10), with their own share of a missing teammate's minutes (`NBA_OUT_BENCH_SCALE` 0.25, picked on 2024–25).
  - Flagged bench boosts, almost all in games with a teammate out, beat the player's average 77% / 76% of the time on points, against a ~48% baseline.
  - Points came in at +4.8 / +5.5 against +3.0 promised. The model is conservative here.
  - 6–9% of flagged bench players got a coach's-decision DNP. The backtest counts those as "didn't play", not as known in advance. A prop on a player who doesn't play is usually voided.
  - **The big caveat:** these spots depend on knowing who's out. The backtest knows every absence, and the live bot only knows what the injury report says 90 minutes before tip. Late scratches will cost some of this.
  - Bench boosts are large in % terms, so they tend to fill the morning list. Alerts label them `bench N mpg`.
- **Calibration (added 2026-10-24) makes the probabilities honest and the picks fewer and better.** With stand-in lines (each player's average rounded to x.5; there are no historical prop lines), out of sample on 2025-26: picks went from 5,351 at 63.1% to 4,116 at 66.6%, and "said 65–75%" now hits 64% instead of 62% from a claimed 68%. Starter points boosts went from 655 flags beating their average 57.9% of the time to 133 at 64.7%. Real books are sharper than the stand-in line, so live hit rates will be lower. After a model change, rerun the backtest and paste its `CAL` line into `model.js`.
- **Whole-model accuracy barely moves.** Projections beat the plain average by only 0.1–1% in squared error. The value is in the flagged tail, not in every projection.
- **Caveats:**
  - "Ruled out" means a regular who didn't play, because ESPN keeps no historical injury lists. That's slightly optimistic.
  - Spreads and totals are only available from December 2025.
  - There are no historical prop lines, so none of this shows the bot beating sportsbooks.

## Game lines (`lines.js`, backtest in `BACKTEST-LINES.md`)

Every morning push ends with a **Game lines** block: each game's spread and total (ESPN's current line) next to the model's, and how far apart they are. A pregame push includes its game's row when it goes out anyway.

- **Model:** opponent-adjusted team ratings from this season's results (30 ESPN team schedules), weighted toward recent games (half-life 30 days) and seeded by last season's final ratings (×0.6, worth 4 games). Home court 1.6, back-to-back −1.8, and regulars ruled out (box-score value × share of games played) cost margin. Every setting is an `NBA_LINES_*` env var.
- **Backtest (`node nba-edges/backtest-lines.js`, needs `backtest.js` run first for its cache):** 2024-25 fit, 2025-26 out of sample, against ESPN's opening and closing lines.
  - **No edge against the closing line**, at any size of disagreement: spreads 50–53%, totals lose. The model's disagreement with the close shows up in results at 0.05 ± 0.13 of its size (0 = the line already knew).
  - Against the **opening** line spreads did better (2025-26: 56% at 3+ pts, 60% at 5+ pts), and the line moved toward the model about 2.5x as often as away. But part of that is the backtest knowing who sat, and the bot sees the 11 AM line, not the open.
  - Big totals disagreements lost in both seasons.
- **So there's no ✅ by default.** `SPREAD_EDGES=1` / `TOTAL_EDGES=1` turn them on. Spreads off by `MIN_SPREAD` (4) or more are still logged as tracked picks, and `results/` grades them against the result **and the closing line**. If the morning disagreements keep beating the close, that's the evidence to turn ✅ on.
- **Known limit: offseason moves.** Ratings start from last season's *teams*, so a team that lost its stars over the summer looks too good for the first few weeks (Oct 2026: LAC without Leonard, Harden and Zubac, model OKC −7 vs the market's −14.5). The market prices that; the model doesn't until the games come in.

## Modes (`run.js`)

| `MODE` | What it does |
|---|---|
| `morning` | Whole slate, one push listing the top `TOP_N` shot-zone edges, prop lines and projection boosts, then the game lines. |
| `pregame` | Games tipping within `PREGAME_MIN` (90) minutes. Fresh injuries, plus prop lines if `ODDS_API_KEY` is set. One push per game, sent once. |
| `snapshot` | Saves stats.nba.com data to `data/nba-stats.json`. Run it on a PC with `snapshot.cmd` (pull, snapshot, commit, push that one file). |
| `probe` | Reports which data sources the current machine can reach. |

Workflow: `.github/workflows/nba-edges-alerts.yml`. Morning runs at 15:00 UTC, and pregame checks every 30 min from 16:00 to 04:30 UTC, October–June.

## Data sources

- **ESPN** (no key): schedule, spread/total, injuries, rosters, and ESPN-only fallback stats. It 403s custom bot user agents, and a spoofed Chrome agent from GitHub runners, so requests use Node's default agent.
- **stats.nba.com** (no key): shot zones, pace, opponent stats. It **times out from GitHub runners**, which is why the Action reads the committed snapshot. The snapshot is used if it's under 36h old. Otherwise the Action tries live nba.com, then a snapshot up to 7 days old, then ESPN only (no zones or opponent adjustments).
- **The Odds API** (optional `ODDS_API_KEY`): player points, rebounds, assists and threes lines, taking the median across US books. Each game costs credits per market.

## Settings (env)

`TOP_N` (6), `ZONE_MIN` (99 = shot-zone alerts off; 1.0 to turn them on), `NBA_OUT_MIN_SCALE` (0.25), `NBA_OUT_USAGE` (0.15), `NBA_OUT_MODE` (`minutes`; `uniform` = the old rule), `NBA_OUT_BENCH_SCALE` (0.25), `MIN_PROJ` (10; 20 = starters only), `BOOST_MIN` (0.10), `P_MIN` (0.58), `NBA_CAL` (JSON override of the calibration constants), `PREGAME_MIN` (90), `ODDS_IN_MORNING` (0), `SPREAD_EDGES` (0), `TOTAL_EDGES` (0), `MIN_SPREAD` (4), `MIN_TOTAL` (6), `NBA_LINES_HALF_LIFE` / `_PRIOR_GAMES` / `_REGRESS` / `_HCA` / `_B2B` / `_INJ` / `_INJ_TOTAL` (game-line model, see `lines.js`), `CLOSE_LINES` (1 = pull prop lines again in the last `CLOSE_WINDOW` (45) minutes before tip as the closing line; one Odds API call per game with props), `MODEL_VERSION` (tag on logged picks; bump it on any model change), `DATE` (test a past slate; keeps finished games), `FORCE_ESPN` (1 = skip nba.com), `DRY_RUN`.

## Cache (`.cache/`)

- `data-<season>.json`: 12h
- `r-<team>-<date>.json`: 12h
- `odds-events-<date>.json`: 3h
- `results-<season>.json`: finished games for the game-line ratings (this season 4h, last season 30 days)
- `morning-<date>.json` / `pregame-<date>.json`: sent markers
- `picks-<date>.json`: sent picks, graded by `results/`

## Known limits

- Injuries: only Out/Doubtful players are dropped. Day-to-day players who sit will still be flagged in the morning scan, which is why the pregame check re-pulls injuries.
- Testing a past `DATE` uses today's ESPN rosters, so offseason moves put some players on the wrong team.
