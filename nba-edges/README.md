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
  - teammates ruled out: their minutes go to the rest of the rotation, weighted toward players with room to play more (MIN × (36 − MIN)), at a quarter strength (`NBA_OUT_MIN_SCALE` 0.25). There's no usage bump (`NBA_OUT_USAGE` 0). This only counts players who have been playing, since a long absence is already in everyone's averages.
- **Season blend:** until a player has about 15 games, last season is mixed in.

## Backtest (`backtest.js`, results in `BACKTEST.md`)

`node nba-edges/backtest.js` replays 2024–25 (the fit season) and 2025–26 (out of sample) with the bot's own `projectSide`/`flagRows`. There's no look-ahead: stats are season-to-date as of the day before each weekly bucket, blended with the prior season. The first run downloads about 400 nba.com snapshots and 2,500 ESPN box scores into `.cache/bt`. Reruns take about 20 seconds.

- **The original teammate-out rule overshot about 5x.** It gave everyone +70% × lost/remaining, capped at +25%, and made projections 5–7% worse than the plain season average. Grid search picked a quarter-strength minutes shift with no usage bump. For 20+ MPG players a teammate sitting barely changes their numbers.
- **Points boosts are the real signal.** With that setting, flagged points boosts beat the player's average 60% / 56% of the time, against a 48% / 46% baseline. They delivered 98% / 66% of the promised gain (+2.5 promised → +2.5, and +2.7 → +1.8 out of sample).
- **Other boosts show up at about half size.** Rebounds, assists and threes delivered roughly 40–80% of the promised gain.
- **Shot-zone edges are noise.** They promised about +2 pts and delivered +0.2–0.3, so shot-zone alerts are off by default (`ZONE_MIN` 99). The zone factor stays in the projections.
- **Bench players (10–20 MPG) are where teammate-out news pays.** They're projected by default (`MIN_PROJ` 10), with their own share of a missing teammate's minutes (`NBA_OUT_BENCH_SCALE` 0.25, picked on 2024–25).
  - Flagged bench boosts, almost all in games with a teammate out, beat the player's average 77% / 70% of the time, against a ~48% baseline.
  - Points came in at +5.0 / +4.5 against +3.0 promised. The model is conservative here.
  - 6–10% of flagged bench players got a coach's-decision DNP. The backtest counts those as "didn't play", not as known in advance. A prop on a player who doesn't play is usually voided.
  - **The big caveat:** these spots depend on knowing who's out. The backtest knows every absence, and the live bot only knows what the injury report says 90 minutes before tip. Late scratches will cost some of this.
  - Bench boosts are large in % terms, so they tend to fill the morning list. Alerts label them `bench N mpg`.
- **Whole-model accuracy barely moves.** Projections beat the plain average by only 0.1–1% in squared error. The value is in the flagged tail, not in every projection.
- **Caveats:**
  - "Ruled out" means a regular who didn't play, because ESPN keeps no historical injury lists. That's slightly optimistic.
  - Spreads and totals are only available from December 2025.
  - There are no historical prop lines, so none of this shows the bot beating sportsbooks.

## Modes (`run.js`)

| `MODE` | What it does |
|---|---|
| `morning` | Whole slate, one push listing the top `TOP_N` shot-zone edges, prop lines and projection boosts. |
| `pregame` | Games tipping within `PREGAME_MIN` (90) minutes. Fresh injuries, plus prop lines if `ODDS_API_KEY` is set. One push per game, sent once. |
| `snapshot` | Saves stats.nba.com data to `data/nba-stats.json`. Run it on a PC with `snapshot.cmd` (pull, snapshot, commit, push that one file). |
| `probe` | Reports which data sources the current machine can reach. |

Workflow: `.github/workflows/nba-edges-alerts.yml`. Morning runs at 15:00 UTC, and pregame checks every 30 min from 16:00 to 04:30 UTC, October–June.

## Data sources

- **ESPN** (no key): schedule, spread/total, injuries, rosters, and ESPN-only fallback stats. It 403s custom bot user agents, and a spoofed Chrome agent from GitHub runners, so requests use Node's default agent.
- **stats.nba.com** (no key): shot zones, pace, opponent stats. It **times out from GitHub runners**, which is why the Action reads the committed snapshot. The snapshot is used if it's under 36h old. Otherwise the Action tries live nba.com, then a snapshot up to 7 days old, then ESPN only (no zones or opponent adjustments).
- **The Odds API** (optional `ODDS_API_KEY`): player points, rebounds, assists and threes lines, taking the median across US books. Each game costs credits per market.

## Settings (env)

`TOP_N` (6), `ZONE_MIN` (99 = shot-zone alerts off; 1.0 to turn them on), `NBA_OUT_MIN_SCALE` (0.25), `NBA_OUT_USAGE` (0), `NBA_OUT_MODE` (`minutes`; `uniform` = the old rule), `NBA_OUT_BENCH_SCALE` (0.25), `MIN_PROJ` (10; 20 = starters only), `BOOST_MIN` (0.10), `P_MIN` (0.58), `PREGAME_MIN` (90), `ODDS_IN_MORNING` (0), `DATE` (test a past slate; keeps finished games), `FORCE_ESPN` (1 = skip nba.com), `DRY_RUN`.

## Cache (`.cache/`)

- `data-<season>.json`: 12h
- `r-<team>-<date>.json`: 12h
- `odds-events-<date>.json`: 3h
- `morning-<date>.json` / `pregame-<date>.json`: sent markers
- `picks-<date>.json`: sent picks, graded by `results/`

## Known limits

- Injuries: only Out/Doubtful players are dropped. Day-to-day players who sit will still be flagged in the morning scan, which is why the pregame check re-pulls injuries.
- Testing a past `DATE` uses today's ESPN rosters, so offseason moves put some players on the wrong team.
