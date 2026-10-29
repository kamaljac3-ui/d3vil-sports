# NBA Edges

NBA matchup alerts sent to ntfy: per-game stat projections (projection boosts, and prop lines when `ODDS_API_KEY` is set) for **PRA (points + rebounds + assists)**, points, rebounds, assists and threes. PRA comes first: it's Kamal's main bet. Shot-zone edge alerts exist but are off by default, per the backtest. It's the NBA version of `launch-angle/`, comparing a player's own tendencies with what tonight's opponent gives up.

## Model (`model.js`)

- **Shot-zone matchups:** the player's per-game FGA and FG% by zone (rim, paint, mid-range, left/right corner 3, above-the-break 3), with FG% shrunk by 30 league-average attempts. Each zone is weighted by how well the opponent defends it (opponent-allowed FG% ÷ league) and how often they allow it (√ of zone-share ÷ league). Both factors are clamped to 0.85–1.15. The output is points gained or lost from the shot mix.
- **Projections** for PTS, REB, AST and 3PM start from the season average and apply:
  - minutes: 50/50 season and last-10
  - the zone factor
  - scoring environment: implied team total from the ESPN total/spread ÷ team PPG, or opponent pace
  - opponent rebounds and assists allowed ÷ league
  - blowout minutes from this team's spread (2026-10-28, `BLOW_*`): starters (28+ MPG) ×0.96 when the spread is 12+ either way; an 8+ point underdog's rotation (20–28 MPG) ×1.046 and bench (<20) ×1.126 for garbage time. Fit on PRA vs the projection with ESPN closing spreads: starters 0.977/0.945 and underdog bench 1.063/1.183 in 2024-25/2025-26, out-of-sample error −0.4%. The favorite's bench came in under only in 2025-26, so it's left alone
  - PRA is the sum of the points, rebounds and assists projections, calibrated on its own (`CAL.pra`)
  - teammates ruled out: their minutes go to the rest of the rotation, weighted toward players with room to play more (MIN × (36 − MIN)), at a quarter strength (`NBA_OUT_MIN_SCALE` 0.25). Per-minute production gets a small usage bump: 0.15 × the share of that stat the team lost (`NBA_OUT_USAGE` 0.15). This only counts players who have been playing, since a long absence is already in everyone's averages.
- **Season blend:** until a player has about 15 games, last season is mixed in.
- **`b2b 2nd night` tag** (informational only, never in the projection): the player's team played yesterday. In the 2024–26 box scores, regulars who played the second night scored right at their projection (+0.15 vs +0.17 pts on other nights). A player's own back-to-back split barely repeated from one season to the next (0.11× ± 0.08), so the tag doesn't say better or worse. What did change is that they sat 21% of second nights vs 16% of other games, so the risk is a late rest day.
- **Defense context** (informational only, never in a projection or a pick):
  - Player rows get a tag like `SAC 29th of 30 vs forwards (+11% pts)` when the opponent ranks in the top or bottom `DVP_RANK` (3) defenses against his position (ESPN's G/F/C). The ranking is points allowed to that position vs those players' own per-minute averages, from this season's ESPN box scores (cached for good as `box-<id>.json`), and starts once teams have `DVP_MIN_GP` (10) games. 1st = allows the least.
  - Each game line gets a second line, e.g. `pts allowed/g (1st = fewest): MEM 5th (105.5, L10 104.0), SAC 26th (124.5, L10 126.1)`, after `DEF_MIN_GP` (5) games. These are raw points, so fast teams look worse than they are.
  - Why it's only a note: in the 2024–26 backtest, players facing a bottom-3 defense vs their position beat their own average by about 0.7 pts more than players facing a top-3 one. But they didn't beat the projection by more, because the game total and pace already carry it. Adding a DvP factor didn't improve projections out of sample. The game-line ratings are already opponent-adjusted and recency-weighted (half-life fit in `BACKTEST-LINES.md`).
- **Calibration** (`calibrate`, `sdOf`; the `CAL` constants, fit by the backtest on 2024–26). Every alert uses it:
  - starters (20+ MPG) keep only k (0.6–0.8) of the projection's gap from their average; bench players keep all of it
  - then every projection is pulled toward the middle (beta ≈ 0.94): a 28+ ppg scorer comes in about 2 under his average
  - the prop probability uses the real spread, sd = a + b·√projection. The old fixed spreads were about 2/3 of it in the 8–20 pt range, so "90%" picks were really ~75%.
  - Alerts show the calibrated projection; picks log it as `proj` and the raw one as `projRaw`.

**Before testing an idea or changing the model, read [`LEARNINGS.md`](LEARNINGS.md).** It lists every angle tried, its evidence and its status, plus what the weekly review checks on live picks.

## Backtest (`backtest.js`, results in `BACKTEST.md`)

`node nba-edges/backtest.js` replays 2024–25 (the fit season) and 2025–26 (out of sample) with the bot's own `projectSide`/`flagRows`. There's no look-ahead: stats are season-to-date as of the day before each weekly bucket, blended with the prior season. Rosters and games played come from the box scores in date order (a player belongs to the team he last appeared for), because nba.com's historical snapshots list each player's *current* team. The first run downloads about 400 nba.com snapshots and 2,500 ESPN box scores into `.cache/bt`. Reruns take about 20 seconds.

- **The original teammate-out rule overshot about 5x.** It gave everyone +70% × lost/remaining, capped at +25%, and made projections 5–7% worse than the plain season average. Grid search picked a quarter-strength minutes shift with a small usage bump (0.15). The bump is marginal: usage 0 did a hair better out of sample. Anything stronger overshoots.
- **Points boosts are the real signal.** With that setting, flagged points boosts beat the player's average 72% / 65% of the time, against a 48% / 46% baseline. They delivered more than promised (+2.6 promised → +4.8, and +2.7 → +3.2 out of sample).
- **Other starter boosts are too few to judge.** Only 1–18 rebound, assist and three flags a season.
- **Shot-zone edges are noise.** They promised about +2 pts and delivered +0.2–0.3, so shot-zone alerts are off by default (`ZONE_MIN` 99). The zone factor stays in the projections.
- **Bench players (10–20 MPG) are where teammate-out news pays.** They're projected by default (`MIN_PROJ` 10), with their own share of a missing teammate's minutes (`NBA_OUT_BENCH_SCALE` 0.25, picked on 2024–25).
  - Flagged bench boosts, almost all in games with a teammate out, beat the player's average 77% / 76% of the time on points, against a ~48% baseline.
  - Points came in at +4.8 / +5.5 against +3.0 promised. The model is conservative here.
  - 5–9% of flagged bench players got a coach's-decision DNP. The backtest counts those as "didn't play", not as known in advance. A prop on a player who doesn't play is usually voided.
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

## PRA board (top 10 PRA bets of the slate)

One push a day, sent by the first pregame run after `BOARD_HOUR` (13 = 1 PM ET), or by `MODE=board`. For every projected
player with a PRA line it takes the side the model likes **at your book's number and price** (`MY_BOOKS`, FanDuel; else the
median at -110), keeps it if the calibrated projection is `BOARD_MIN_GAP` (2.5) or more off the line and the EV is positive,
and ranks by EV. One bet per player, top `BOARD_N` (10). Each comes with its facts:

```
2. Domantas Sabonis (SAC) vs NOP: PRA o34.5 -110 FanDuel
   proj 38.7 → 66%, +26% EV · Pinnacle fair 50%
   L5 40 56 33 42 (3/4 over) · avg 34.4 · 34 min
   w/o Cardwell, Murray, Raynaud; high team total
```

- **Facts, not ranking:** last 5 games' PRA this season (from ESPN box scores, cached as `pra-<id>.json`) and how many beat the
  line, season average, projected minutes, last meetings vs this opponent, the sharp fair chance of that exact bet
  (Pinnacle, else the other US books' no-vig consensus), and the tags (teammates out, b2b, DvP, blowout/underdog, cold H2H).
- **Credits:** the board's props pull is cached as `book-<id>.json` and reused by that evening's pregame alerts for
  `PROPS_TTL_H` (8) hours, so a game costs about 2 credits (this pull + the closing line).
- **Late news (`nba-news`):** the board is also posted as compact JSON to a second ntfy topic (`NTFY_TOPIC` + `BOARD_DATA_SUFFIX`, default `-board`; don't subscribe to it). When NBA News sees a new Out on a team with board picks, it sends a **Board update**: the pick's own player out → the bet voids; a teammate out → his re-projected chance at the board's line, if it moved `BOARD_UPDATE_MIN` (1) PRA or more, and "skip it" if it now leans the other way. No odds are pulled, so it can't say how far the book's line moved.
- **Grading:** board picks are logged as `kind:"prop"`, `stat:"pra"`, mode `board`; the ledger's review groups them as
  "PRA board". Last-5 hit rates are descriptive: the backtest found recent form/H2H adds little beyond the projection.

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
- **The Odds API** (optional `ODDS_API_KEY`): player prop lines and prices, pulled in pregame mode (and once more in the last 45 min as the closing line).
  - **Credits.** The key is on the free tier (500 credits/month). It was shared with the NFL bots until 2026-10-29; they now use SportsGameOdds (`NFL_ODDS=sgo`, `nfl-props/odds-sgo.js`). A call costs markets × regions, and asking for ≤ 10 named bookmakers counts as one region. So by default the bot pulls **PRA only** (`NBA_PROP_MARKETS` = `pra`, 1 credit a game); `pra,pts,reb,ast,fg3m` pulls all five (5 a game). It keeps a monthly budget (`NBA_ODDS_BUDGET` 450) and stops at `NBA_ODDS_RESERVE` (25) credits left on the key, reading the API's remaining-credits header. Usage is in `.cache/odds-usage-<YYYY-MM>.json` and in the run log. In October 2026 the NBA bot spent about 140 credits in 5 days before this guard, so on the free tier the NBA props are thin; a paid Odds API plan lifts all of this.
  - **Books:** the sharp book (`ODDS_SHARP`, Pinnacle first), your books (`MY_BOOKS`, repo Variable = `fanduel`) and `NBA_LINE_BOOKS` (DraftKings, BetMGM, Caesars, Fanatics, BetRivers, ESPN BET) for the median line.
  - **💰 stale prices** (`nfl-props/sharp.js`, shared read-only with the NFL bots): the sharp book's two-way price with its margin removed is the fair probability; that's shifted to the exact number your book offers (normal approximation, spread = the model's own `sdOf`) and any offer worth `MIN_EV_PROPS` (3%) or more is flagged, at most `EV_MAX_GAP` (2) points from the sharp number. The pregame push leads with up to `EV_TOP` (5), e.g. `Domantas Sabonis (SAC) PRA o36.5 -110 at FanDuel: fair 56%, +7.1% EV vs Pinnacle 37.5 -120/+100; model 59%`. They're logged as `kind:"ev"` and graded at the price taken, with closing-line value. This is a market-based edge, separate from the model; the model's own probability is shown next to it.
- **Head-to-head boxes:** the last 5 meetings of tonight's two teams (this season and last) from ESPN game summaries, cached as `box-<id>.json` for the `cold vs` tag.

## Settings (env)

`TOP_N` (6), `BOARD_N` (10), `BOARD_HOUR` (13 ET), `BOARD_MIN_GAP` (2.5), `PROPS_TTL_H` (8), `NBA_PROP_MARKETS` (pra), `NBA_ODDS_BUDGET` (450), `NBA_ODDS_RESERVE` (25), `MY_BOOKS`, `ODDS_SHARP`, `NBA_LINE_BOOKS`, `MIN_EV_PROPS` (0.03), `EV_MAX_GAP` (2), `EV_TOP` (5), `BLOW_STARTER_SPREAD` (12), `BLOW_STARTER` (0.96), `BLOW_DOG_SPREAD` (8), `BLOW_DOG_ROTATION` (1.046), `BLOW_DOG_BENCH` (1.126), `H2H_N` (5), `H2H_COLD` (5 PRA), `ZONE_MIN` (99 = shot-zone alerts off; 1.0 to turn them on), `NBA_OUT_MIN_SCALE` (0.25), `NBA_OUT_USAGE` (0.15), `NBA_OUT_MODE` (`minutes`; `uniform` = the old rule), `NBA_OUT_BENCH_SCALE` (0.25), `MIN_PROJ` (10; 20 = starters only), `BOOST_MIN` (0.10), `P_MIN` (0.58), `NBA_CAL` (JSON override of the calibration constants), `PREGAME_MIN` (90), `ODDS_IN_MORNING` (0), `SPREAD_EDGES` (0), `TOTAL_EDGES` (0), `MIN_SPREAD` (4), `MIN_TOTAL` (6), `NBA_LINES_HALF_LIFE` / `_PRIOR_GAMES` / `_REGRESS` / `_HCA` / `_B2B` / `_INJ` / `_INJ_TOTAL` (game-line model, see `lines.js`), `CLOSE_LINES` (1 = pull prop lines again in the last `CLOSE_WINDOW` (45) minutes before tip as the closing line; one Odds API call per game with props), `MODEL_VERSION` (tag on logged picks; bump it on any model change), `DATE` (test a past slate; keeps finished games), `FORCE_ESPN` (1 = skip nba.com), `DVP_RANK` (3), `DVP_MIN_GP` (10), `DEF_MIN_GP` (5), `DRY_RUN`.

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
