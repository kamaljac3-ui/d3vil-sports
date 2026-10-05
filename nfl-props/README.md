# NFL Props Edges

Weekly NFL player projections and ntfy phone alerts for:
- receiving yards
- receptions
- rushing yards
- passing yards

It runs free on GitHub Actions using nflverse, Sleeper and Open-Meteo data. Sportsbook lines are optional (The Odds API free tier).
Alerts go **only to ntfy**, never to the Kit newsletter.

**Not betting advice.** The bot never places a bet. It points out numbers worth a second look.

## When it alerts

**Schedule:** `.github/workflows/nfl-props-alerts.yml` starts a run every 2 hours.
- Each run stays up to 5 hours (`LOOP_MIN=300`) and sleeps until the next alert window, rechecking every 5 minutes
  while one is open.
- It exits early when nothing is due before it would end.
- This replaced a 15-minute cron that GitHub only ran about every 3 hours on Sunday Sep 27, 2026, missing 3 of 4
  game-day windows.
- The script converts the time to Eastern itself with `Intl`, so the Nov 1 daylight-saving change needs no cron edits.
- Manual runs check once and exit.

| When (Eastern) | Alert |
|---|---|
| Wednesday from 11 AM (`WED_HOUR`) | First projections for the week: top edges, usage bumps, QB changes, windy games |
| Friday from 5 PM (`FRI_HOUR`) | Update after the final injury reports. Pulls sportsbook lines if `ODDS_API_KEY` is set |
| 75–110 min before each kickoff (`GD_MIN`/`GD_MAX`) | **One alert per game**, when inactives are known: who's out, whose usage jumps, how the weather changed since Friday, any edges |

- A game-day alert is only sent if something changed or there's an edge. Set `GD_ALWAYS=1` to always send.
- Tapping an alert opens the Actions run, whose summary has the full projection table.
- "Sent" markers are keyed per season, week and game, so each alert goes out once.
- **Dry runs never write them.** A run is live only when `DRY_RUN` isn't `1` and `NTFY_TOPIC` is set.

## The model

Each player's projection is **opportunity × matchup × environment**.

**Opportunity**
- Team plays come from the team's own pace and the opponent's pace allowed. The implied team total nudges the count.
  The implied total is (total ± spread) / 2, using nflverse's `spread_line`, where positive means the home team is favored.
- Pass rate = the team's pass rate, adjusted for the opponent and for game script (−0.6% per point the team is favored).
- Each player's share = recent snap share × his target (or carry) share per snap. Snap share reacts fastest, so a role
  change shows up after about one game.
- **Usage boost:** when a player is ruled out, 85% of his share goes to teammates, weighted toward his position.
  - This only applies if he played in the team's last game or two. Older absences are already baked into teammates' shares.
  - A team's total share is capped at 95%.
- If the starting QB is out, the next QB takes his dropbacks with his own efficiency, and receivers are scaled by the
  change in QB efficiency.

**Matchup.** Every rate is pulled toward the league average in proportion to sample size.
- **Receivers:** yards per target and catch rate, against what the defense allows to that position (WR, TE or RB).
- **Man vs zone:** each receiver's man and zone splits against the defense's man rate. Coverage data is only published
  for the previous season, so this uses 2025.
- **QB, pass rush vs offensive line:** expected pressure combines the line's pressure allowed with the defense's
  pressure rate. Yards on clean dropbacks and on pressured dropbacks are projected separately. Pressure here means a
  sack or QB hit, because 2026 play-by-play has no pressure field. There's also a blitz split from FTN charting
  (how the QB does when blitzed, against how often this defense blitzes).
- **RBs:** yards per carry against the defense's run efficiency allowed, plus a stacked-box split (8+ in the box, from FTN).

**Environment**
- Open-Meteo forecast at kickoff for outdoor stadiums only. Domes and closed roofs are indoor. Retractable roofs are
  treated as closed, the same as `nfl-edge-finder`.
- **Wind:** above 8 mph it cuts passing efficiency by 0.9% per mph (more for deep targets) and pass rate by 0.3% per mph.
  - **Direction:** at 12+ mph a crosswind counts 1.3× and wind along the field 0.8×.
  - **Direction data:** each stadium's field bearing comes from OpenStreetMap; the forecast gives the wind direction.
  - **Evidence:** combined passing drops about 16 yds at 8–12 mph and about 53 at 16+; at 12+ mph it's about 43 with a crosswind vs about 26 along the field (`nfl-lines/research/wind-direction.js`).
  - **Backtest:** the new thresholds were slightly better on every stat. The direction multiplier itself can't be backtested, because the history only records wind speed.
- Rain cuts passing efficiency by 4%.

**Availability**
- Sleeper's injury status (Out, IR, PUP, Suspended and so on) and team, refreshed at most hourly on game days and
  every 12 h otherwise.
- The nflverse injury report and roster status.
- Doubtful counts as out (`DOUBTFUL_OUT=1`). Questionable players are projected and tagged `[Q]`.

**Probabilities**
- sd = A·mean^B per stat, fitted on 2025. The chance of going over uses a skewed (lognormal) distribution, because
  yardage medians sit below the averages.
- It's then pulled halfway to 50% (`PROB_CAL=0.5`), because raw backtest probabilities were about twice as confident as reality.

## What counts as an edge

| | Rule |
|---|---|
| **With a line** (`ODDS_API_KEY` set) | projection − line ≥ `MIN_EDGE_*` (10 rec yds, 0.8 rec, 10 rush yds, 20 pass yds) **and** calibrated chance of that side ≥ `MIN_PROB` (0.56) |
| **Projections only** (default) | projection is ≥ `MIN_EDGE_PCT` (20%) away from his last-4-game average, with ≥ `MIN_BASE_GAMES` (3) games this season **and** chance ≥ `MIN_PROB`. The recent average only stands in for where books hang the line; compare with your app's actual number |

## Backtest (2025, weeks 4–18)

Run it with `node nfl-props/backtest.js`, or trigger the workflow with `mode=backtest`.

The backtest projects each week using only earlier data. It assumes perfect inactive info and uses closing
spread/total and recorded wind. So it measures the model, not the injury feed.

| stat | player-games | MAE model | MAE last-4 avg | bias | calls ≥15% off avg | right side |
|---|---|---|---|---|---|---|
| rec yds | 2,633 | 20.4 | 21.8 | +0.1 | 1,181 | 68% |
| receptions | 2,902 | 1.45 | 1.53 | +0.04 | 987 | 66% |
| rush yds | 1,097 | 21.4 | 23.1 | −1.2 | 525 | 69% |
| pass yds | 414 | 60.4 | 67.1 | +0.1 | 137 | 69% |

Read the "right side" column carefully. It's measured against a naive recent average, not a sportsbook line. Books
already correct for most of that pull back toward the typical result, so the edge against real lines will be much smaller.
That's why the optional Odds API mode exists.

## Prop lines (optional): The Odds API

1. Get a free key at the-odds-api.com. The free tier is 500 credits a month.
2. Add it as the repo secret `ODDS_API_KEY`.

**Credit use:**
- Listing events is free.
- Each game's props call costs one credit per market (per region), for example 3 credits for rec yds + receptions + rush yds.

**How the bot stays within the free tier:**
- Friday only.
- Only the games holding the top `ODDS_TOP_PLAYERS` (20) candidates, at most `ODDS_MAX_EVENTS` (8) games.
- Only the markets those candidates need.
- The bot stops at `ODDS_MONTHLY_BUDGET` (350) credits used (`nfl-lines` keeps its own 100), or when fewer than `ODDS_RESERVE` (25) remain,
  reading the API's own remaining-credits header.
- Friday's lines are stored and reused by the game-day alerts. Set `ODDS_ON_GAMEDAY=1` to re-pull on game day,
  which costs more credits.

**Line and price:** the line is the median across books. The price shown is the best available at that number.

**Not yet verified:** whether the free tier includes player-prop markets. The first Friday run will log either the
lines or the API's error message.

## Stale prices: your books vs. the sharp book (needs `ODDS_API_KEY`)

The most reliable edge for a regular bettor isn't out-modeling the market. It's catching a book that hasn't moved yet.
Each Odds API pull asks for the sharp book plus your books in one request (up to 10 books, billed as one region).

- **Fair price:** the sharp book's two-way price with its margin removed. The sharp book is `ODDS_SHARP`, default
  `pinnacle`, falling back to `lowvig`, then `betonlineag`.
- **Different numbers:** if your book has a different number than the sharp book, the fair probability is shifted to
  your number with a normal approximation.
  - Spread σ is 13.5 and total σ is 13; for props it's the model's fitted spread for that stat.
  - This is conservative at the key numbers 3 and 7.
  - It's only done within a small gap (`STALE_GAP`), never extrapolated far.
- **Flagging:** any price at your books (`MY_BOOKS`) worth at least `MIN_EV_PROPS` (3%) is flagged with 💰, for example:
  "DraftKings LAC +7.5 (-110): fair 54.0%, +3.2% EV vs Pinnacle LAC +6.5 -115".
- **Your books:** `MY_BOOKS` defaults to `draftkings,fanduel,betmgm,williamhill_us,espnbet,fanatics,betrivers`
  (`williamhill_us` = Caesars). Set the repo Variable `MY_BOOKS` to just the books you have accounts at.
- **Pick log:** only live alerts are logged. Each flagged pick is written to `.cache/picks-<date>.json` with the
  price, fair probability, EV and the sharp line at the time (`sport:"nfl"`). That's the raw material for grading
  and closing-line value. `results/track.js` doesn't grade NFL yet.
- **Caveat:** Pinnacle's props are sharper than US books' but not perfect, and a thinly traded prop can be off
  at Pinnacle too. Game-line flags are the more trustworthy of the two.

Stale props come from the Friday pull, covering every priced player in those games, not just the model's picks, with at most `STALE_N` (6) per alert. Game-day alerts only show stale props when `ODDS_ON_GAMEDAY=1`, since Friday's prices are too old by Sunday.

## Settings

Every threshold is an env var with a default in code. To change one without touching code, add a repo **Variable**
(Settings → Secrets and variables → Actions → Variables) named `NP_<SETTING>`, e.g. `NP_MIN_PROB=0.58`.
The workflow passes these through:

- **Edges:** `MIN_PROB`, `MIN_EDGE_PCT`, `MIN_BASE_GAMES`, `MIN_EDGE_RECYDS/REC/RUSHYDS/PASSYDS`, `TOP_N`
- **Timing:** `WED_HOUR`, `FRI_HOUR`, `GD_MIN`, `GD_MAX`, `GD_ALWAYS`
- **Odds:** `ODDS_MONTHLY_BUDGET`, `ODDS_MAX_EVENTS`, `ODDS_ON_GAMEDAY`, `ODDS_BOOKMAKERS`

Model constants (half-lives, shrinkage `K_*`, `SCRIPT_K`, `WIND_*`, `SD_*`, `PROB_CAL`) are also env-overridable.
They're listed at the top of `model.js`.

## Secrets

- `NTFY_TOPIC_NFL`: the NFL-only ntfy topic, shared with `nfl-lines`. If it isn't set, alerts go to the shared
  `NTFY_TOPIC`. `NTFY_TOKEN` and `NTFY_SERVER` are optional and shared with the other bots.
- `ODDS_API_KEY`: optional.

## Running it by hand

Actions → **NFL Props Edges** → Run workflow:
- `mode`: `wed`, `fri`, `gameday` (optionally a `game` id) or `backtest`.
- `dry_run` defaults to **1** for manual runs.

Locally:
```
MODE=wed DRY_RUN=1 node nfl-props/run.js
MODE=gameday GAME=2026_04_TEN_BAL DRY_RUN=1 node nfl-props/run.js
node nfl-props/backtest.js
```

## Files

| File | What it does |
|---|---|
| `run.js` | Scheduling, availability, picks, alerts |
| `model.js` | The projection model |
| `data.js` | nflverse / Sleeper loaders |
| `weather.js` | Stadiums + Open-Meteo |
| `odds.js` | The Odds API |
| `lib.js` | CSV, fetch, state, Eastern time, ntfy |
| `backtest.js` | Season replay |

**State** is kept in `nfl-props/.cache/`: sent markers, Wed/Fri snapshots, schedule, trimmed Sleeper and odds usage.
It persists between runs through `actions/cache`. A new cache entry is saved only when a run changed state. Raw
nflverse files (~100 MB, a few seconds to download) are re-downloaded each run rather than cached, so this bot never
crowds the MLB bot's cache out of the repo's 10 GB quota.

## Known gaps

- **No slot/outside alignment, and no current-season man/zone.** Neither is published free. Man/zone uses last season's charting.
- **"Pressure" means sack or QB hit.** Hurries aren't in free play-by-play.
- **No official inactives feed.** Game-day availability comes from Sleeper's status, which usually flips to Out within minutes of the inactives list.
- **Players new to a team get no projection until they've played a game there.** Their old share doesn't carry over.
  Teammates whose usage they take are still adjusted once the new player shows up.
- **Weeks 1–2 lean on last season's data for the same team.** Projection-only edges need 3 games this season, so expect quiet alerts before week 4.
