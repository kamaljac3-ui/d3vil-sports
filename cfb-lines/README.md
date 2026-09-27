# CFB Lines

College football **spread and total** edges, sent as ntfy alerts to Kamal's phone. It never touches the Kit newsletter.
It covers game lines only. For NFL props see `nfl-props/`, and for NFL lines see `nfl-lines/`.

**Not betting advice.** Read the backtest section before trusting a ✅.

## Alerts

`MODE=auto` runs from cron every 15 minutes and decides from Eastern time (via `Intl`, so the DST change needs no edits) what's due.

| Card | When | Contents |
|---|---|---|
| **First look** | Sunday from 2 PM ET, once lines cover 60% of the week's FBS games; Monday 10 AM ET at the latest | Every game in the coming CFBD week (Tuesday/Wednesday MACtion included) |
| **Update** | Noon ET, 2 days before Saturday games (Thursday) or the day before a weeknight game | Midweek availability reports and the kickoff forecast |
| **Final** | 9 AM ET on game day | Updated weather, availability reports and current lines |
| **Game day** | 75–110 min before each kickoff, **only if something changed materially** since the last card | See below |

A game-day alert fires when any of these changed since the last card:
- QB news
- a wind shift of 7+ mph, or crossing 15 mph
- the line moved through our number
- an edge appeared or disappeared
- our number moved 1.5+ points

A card lists only the games with an edge (✅), biggest first. Each shows:
- the line
- our number
- the edge
- the reasons, for example "wind 18 mph; UCF QB Alonza Barnett III out; travel KSU +0.6"

The full slate goes to the run's step summary. Edges bigger than `MAX_EDGE` (14) get ⚠️ instead of ✅, since a gap that size usually means news the model hasn't seen.

Manual modes (workflow_dispatch): `probe` (checks every data source from the runner), `backtest`, `first`, `update`, `final` and `gameday`. The last four build that card now; use them with `dry_run=1`.

## Data (all free)

| Source | Used for | Notes |
|---|---|---|
| **CollegeFootballData.com** (`CFBD_API_KEY` secret) | games, venues (location, dome, elevation, capacity), FBS teams, opponent-adjustable box stats (EPA/play, success rate, explosiveness, plays; garbage time excluded), betting lines from several books (opening + current/closing), talent, returning production, passing box scores (QB starters), player usage, tackles | Free tier: **1,000 calls/month**, shared with CFBD's basketball API; going over can disable the key until the 1st. The bot stops itself at `CFBD_MONTHLY_BUDGET` (700). |
| **ESPN scoreboard** | the current DraftKings line on game day, when ESPN has it (~12 featured games a week) | No key. Falls back to CFBD's consensus. |
| **Open-Meteo** | forecast for the 3 hours from kickoff at the venue (skipped for domes); the archive API for backtest weather | No key |
| **Conference availability reports** | SEC, Big Ten, ACC and Big 12 conference games | See below |

### CFBD call budget

Every response is cached (gzipped) in `cfb-lines/.cache/cfbd`, which persists via actions/cache. A finished season is cached forever.

Live use comes to about **150–250 calls/month**:
- schedule twice a day
- stats once a day
- one lines call per card/kickoff slot
- one box-score call per new week
- a few per-season files

The first backtest costs about 120 calls, one time only. `node cfb-lines/run.js` with `MODE=probe` prints the key's remaining calls.

### Availability reports: what's actually reliable

- **SEC, Big Ten, ACC, Big 12:** official reports for **conference games only**. They post several times in the days before the game, plus a final one 90 min–2 h before kickoff.
  - Statuses: available / probable / questionable / doubtful / out / out 1st half / game-time decision.
  - All four come from the same vendor feed the conference websites embed (HD Intelligence, a public JSON endpoint with no login).
  - The endpoint is **undocumented**, so any failure is treated as "no report". SEC replies are about 10 MB because the logos are inline, so it's only called for the conferences playing and cached for 45 min (`AVAIL_TTL_MIN`).
- **Not available:**
  - non-conference games
  - Group of 5 teams (the Mountain West and Pac-12 publish, but their feed codes aren't reachable)
  - CFBD (no injury endpoint)
  - ESPN (its CFB injury data is empty)
- **Starting QB** = most pass attempts (8+) in the team's last 3 games, from CFBD box scores. When the report lists him as out, doubtful or GTD, his team takes the QB penalty. If a report exists but doesn't list him, the card flags it.

## The model

1. **Opponent-adjusted efficiency.** For each of EPA/play, success rate, explosiveness and plays per game, it solves
   `metric = league avg + offense[team] + defense[opponent] + home` as a ridge regression over this season's games.
2. **Preseason prior.** Each team's prior is its final adjusted value from last season, regressed toward average,
   shifted by returning production (offense) and 247 talent. It enters as `PRIOR_GAMES` pseudo-games, so it dominates
   in week 1 and fades as real games are played.
3. **Expected points** for each side come from a map fitted on actual games (points ~ EPA×plays, success rate,
   explosiveness, plays). Margin = home − away; total = the sum.
4. **Adjustments**, each fitted by the backtest and pulled toward a sensible default:
   - **Home field** by situation: neutral site = 0, more for bigger crowds, reduced when the "home" team plays away from its own stadium
   - **Travel:** miles, relative to the opponent
   - **Time zones** crossed
   - **Rest:** days since the last game, byes included
   - **Altitude:** a home venue above 1,500 m against a lowland visitor
   - **Weather** (totals): wind above 15 mph, heavy rain, cold; lower scoring also shrinks the margin a little
   - **Availability:**
     - QB out, weighted by status likelihood (doubtful 0.75, GTD/questionable 0.35)
     - skill players by usage share
     - defenders by share of team tackles
     - Only the QB weight is backtested (from box-score starter changes). The others have no history to test and are conservative defaults.
5. **Edge** = our number minus the market's. ✅ when edge ≥ `MIN_SPREAD` / `MIN_TOTAL`.

Fitted values live in `params.json`, written by the backtest. Env vars override it.

## Settings (repo variables → env)

| Variable | Env | Default |
|---|---|---|
| `CFB_MIN_SPREAD` / `CFB_MIN_TOTAL` | `MIN_SPREAD` / `MIN_TOTAL` | 4 / 8 |
| `CFB_SPREAD_EDGES` / `CFB_TOTAL_EDGES` | on/off | 1 / 0 |
| `CFB_MAX_EDGE` | `MAX_EDGE` | 14 |
| `CFB_MIN_WEEK` | no ✅ before this week | 4 |
| `CFB_FIRST_HOUR` / `CFB_UPDATE_HOUR` / `CFB_FINAL_HOUR` | ET hours | 14 / 12 / 9 |
| `CFB_GD_MIN` / `CFB_GD_MAX` | game-day window (min before kickoff) | 75 / 110 |
| `CFB_CFBD_BUDGET` | `CFBD_MONTHLY_BUDGET` | 700 |

Model coefficients (`HFA`, `WIND`, `QB_OUT`, `PRIOR_GAMES`, …) can be overridden by env too; see `model.js`.

## State

State lives in `cfb-lines/.cache` (actions/cache, prefix `cfb-state-`). It is saved only when a run changes something. It holds:
- sent markers
- per-game snapshots (for the game-day comparison)
- the CFBD response cache and call counter
- trimmed availability reports

Dry runs never mark anything as sent or snapshot anything. A cold cache is safe: the data is re-downloaded, and at worst one duplicate alert goes out.

## Backtest

Run `node cfb-lines/backtest.js`, or trigger the workflow with `mode=backtest`. Locally, put the key in `CFBD_API_KEY` or alone in `~/.cfbd_key`.

How it scores:
- It fits params on the **train** seasons (2021–22), then grades every season. **Test seasons (2023–25) are never seen by the fit.**
- The ratings for week W use only games before W.
- Lines are the median across CFBD's books.
- "Win% vs close" = our side covered the closing number (edge measured against the close).
- "Win% vs open" = the same against the opener (the Sunday first look).
- "Line moved our way" = how often the market moved toward our number between open and close (closing-line value).
- Breakeven at −110 is 52.4%.

### Verdict (read before trusting a ✅)

- **Spreads, bet at the first-look number: a small edge, strongest as the closing-line value.**
  - On the test seasons, edges ≥ 4 went 54.5% against the opener, and the market moved toward our number 57% of the time (avg +0.8 pts).
  - At edge ≥ 5 those figures are 55.0%, 59% and +0.9.
  - The line moving our way grows steadily with edge size in both train and test. That's the best sign the model knows something the opener doesn't.
  - The win% alone is only about 1 standard error above breakeven, so it isn't proof by itself.
- **Spreads, bet at the closing number: no edge** (about 52% at every threshold). The market catches up by kickoff.
  So the Sunday first look is where the value is, and the game-day alerts are for news, not new bets.
- **Totals: no reliable edge.** Test results sit around breakeven (52–53% against the opener at edges of 2–6 pts). Edges ≥ 8 look good (55%) but on only about 230 bets.
  Totals ✅ are **off** by default (`TOTAL_EDGES=0`, threshold 8 if turned on).
- **Weeks 1–3 lose** (46–50%), so there's no ✅ before week 4 (`MIN_WEEK=4`).
- The model's own error is a bit worse than the closing line's (MAE 12.4 vs 12.0). It's a second opinion on early numbers, not a better line.

Defaults picked from this: spread edge ≥ **4**, totals off, week ≥ 4.

**Fitted coefficients** (`params.json`, from 2021–22):
- home field 1.6 pts, plus 1.4 per 25k seats above 50k
- visitor travel +0.7 per 1,000 extra miles
- time zones +0.1 each
- rest +0.14 per day
- altitude +0.35
- wind −1.2 per mph above 15 (59 games)
- rain −1.8 (only 4 games, so weak)
- cold −1.1
- QB change −5.3 on the margin and −2.1 on the total

Train (params fitted on): 2021, 2022. Test (never seen by the fit): 2023, 2024, 2025. Weeks ≥ 4, FBS vs FBS, regular season, consensus (median) line across CFBD's books. Breakeven at -110 is 52.4%.

- 2021: margin MAE model 12.92 vs closing line 12.54; total MAE model 13.09 vs close 12.35 (585 games)
- 2022: margin MAE model 12.02 vs closing line 12.06; total MAE model 13.04 vs close 12.23 (584 games)
- 2023: margin MAE model 12.57 vs closing line 12.13; total MAE model 13.07 vs close 12.61 (597 games)
- 2024: margin MAE model 12.40 vs closing line 11.97; total MAE model 13.60 vs close 13.01 (612 games)
- 2025: margin MAE model 12.34 vs closing line 11.77; total MAE model 12.86 vs close 12.21 (617 games)

#### Spreads, TEST 2023+2024+2025

| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |
|---|---|---|---|---|---|---|
| 0 | 1785 | 51.9% | 1802 | 52.6% | 50.8% | 0.42 |
| 1 | 1497 | 52.3% | 1549 | 52.9% | 52.1% | 0.51 |
| 2 | 1224 | 52.1% | 1267 | 53.4% | 53.1% | 0.59 |
| 3 | 977 | 52.2% | 1004 | 54.4% | 55.3% | 0.71 |
| 4 | 742 | 51.8% | 772 | 54.5% | 57.2% | 0.82 |
| 5 | 539 | 51.4% | 578 | 55.0% | 59.1% | 0.90 |
| 6 | 376 | 51.6% | 405 | 54.8% | 60.5% | 1.05 |
| 8 | 172 | 49.4% | 185 | 56.2% | 62.9% | 1.46 |
| 10 | 81 | 55.6% | 94 | 54.3% | 63.8% | 1.65 |

#### Totals, TEST 2023+2024+2025

| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |
|---|---|---|---|---|---|---|
| 0 | 1802 | 51.5% | 1812 | 51.6% | 51.8% | 0.32 |
| 1 | 1523 | 52.0% | 1556 | 51.7% | 52.6% | 0.36 |
| 2 | 1241 | 51.5% | 1258 | 52.4% | 54.1% | 0.44 |
| 3 | 991 | 51.3% | 1002 | 52.8% | 54.0% | 0.45 |
| 4 | 778 | 51.3% | 778 | 53.1% | 55.0% | 0.52 |
| 5 | 588 | 50.9% | 587 | 52.0% | 56.4% | 0.58 |
| 6 | 432 | 50.7% | 425 | 52.7% | 57.8% | 0.67 |
| 8 | 212 | 54.7% | 227 | 55.1% | 60.3% | 0.78 |
| 10 | 92 | 57.6% | 93 | 55.9% | 59.1% | 0.70 |

#### Spreads, train 2021+2022

| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |
|---|---|---|---|---|---|---|
| 0 | 1154 | 53.1% | 1148 | 54.4% | 49.4% | 0.30 |
| 1 | 953 | 53.8% | 975 | 54.7% | 49.7% | 0.32 |
| 2 | 790 | 53.8% | 788 | 54.8% | 51.4% | 0.39 |
| 3 | 626 | 52.6% | 618 | 55.3% | 53.7% | 0.46 |
| 4 | 476 | 53.8% | 477 | 57.4% | 56.3% | 0.57 |
| 5 | 352 | 55.1% | 359 | 59.1% | 56.4% | 0.64 |
| 6 | 241 | 54.8% | 258 | 61.2% | 59.6% | 0.77 |
| 8 | 121 | 54.5% | 135 | 58.5% | 60.9% | 0.86 |
| 10 | 53 | 64.2% | 57 | 64.9% | 62.7% | 1.08 |

#### Totals, train 2021+2022

| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |
|---|---|---|---|---|---|---|
| 0 | 1157 | 49.6% | 1159 | 50.7% | 55.3% | 0.55 |
| 1 | 970 | 50.1% | 1002 | 50.7% | 57.0% | 0.64 |
| 2 | 803 | 50.1% | 825 | 52.2% | 59.3% | 0.75 |
| 3 | 660 | 49.1% | 660 | 52.7% | 61.3% | 0.88 |
| 4 | 497 | 48.9% | 515 | 53.2% | 64.7% | 1.01 |
| 5 | 368 | 48.6% | 403 | 52.6% | 67.7% | 1.17 |
| 6 | 260 | 50.8% | 286 | 52.1% | 69.5% | 1.32 |
| 8 | 128 | 51.6% | 158 | 59.5% | 74.2% | 1.71 |
| 10 | 50 | 46.0% | 69 | 59.4% | 77.8% | 2.11 |

#### Spreads, TEST weeks 1-3 only (priors-heavy)

| edge ≥ | bets (close) | win% vs close | bets (open) | win% vs open | line moved our way | avg move (pts) |
|---|---|---|---|---|---|---|
| 0 | 432 | 50.2% | 435 | 51.5% | 47.5% | 0.13 |
| 1 | 375 | 50.1% | 373 | 52.3% | 50.5% | 0.26 |
| 2 | 311 | 50.2% | 313 | 51.4% | 51.9% | 0.35 |
| 3 | 252 | 48.0% | 249 | 49.0% | 54.0% | 0.45 |
| 4 | 203 | 48.3% | 195 | 50.3% | 53.3% | 0.49 |
| 5 | 162 | 46.3% | 156 | 48.1% | 55.1% | 0.55 |
| 6 | 121 | 47.1% | 117 | 51.3% | 55.1% | 0.72 |
| 8 | 65 | 46.2% | 73 | 47.9% | 52.7% | 0.68 |
| 10 | 34 | 47.1% | 32 | 46.9% | 62.5% | 1.23 |

