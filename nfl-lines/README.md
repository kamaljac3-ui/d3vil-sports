# NFL Lines

A game-day ntfy alert per kickoff slot (for example "Sun 1:00 PM ET"), sent about **75–110 minutes before kickoff**,
after inactives. For every game in the slot it shows:

- the current **spread, total and moneyline**
- the model's spread, total and win probability
- ✅ on any edge that clears the thresholds
- QB availability and bad weather

It's the game-day replacement for `nfl-edge-finder`'s line alerts. It's separate from the props alerts
(`nfl-props/`) and never goes to the Kit newsletter.

Both NFL bots post to the `NTFY_TOPIC_NFL` secret, their own ntfy feed. If that secret isn't set, they fall back to `NTFY_TOPIC`.

**Not betting advice, and the model isn't proven.** See the backtest below before acting on a ✅.

## Lines

| Source | Cost | Notes |
|---|---|---|
| **ESPN scoreboard** (default) | free, no key | DraftKings' current spread, total and moneyline. Unofficial endpoint: it rejects a spoofed browser User-Agent, so the bot sends none |
| The Odds API (needs `ODDS_API_KEY`) | 3 credits per slot | **Used by default once the key is set** (`LINES=auto`): median across the sharp book + your books, plus per-book prices for the stale check. ESPN fills any game it lacks. Own budget, `ODDS_MONTHLY_BUDGET` = 100 |
| nflverse schedule | free | Last resort. Updated about daily |

## The model

A port of `nfl-edge-finder`, with the same defaults:

- **Team rating** = average scoring margin this season, weighted toward recent weeks (`DECAY` 0.90 per week).
  Last season's rating is blended in and fades out over the first 4 games (`BLEND_WEEKS`).
  `RATING=srs` swaps in a strength-of-schedule-adjusted version.
- **Predicted margin** = rating gap + home field (2.0, 0 at neutral sites, 1.0 less in division games)
  + rest (0.5 per day of advantage, capped at 4). The starting QB out costs his team 6 points (doubtful: 3).
  - The starter is whoever started most of the team's last 3 games.
  - His status comes from Sleeper and the nflverse injury report.
  - If nflverse lists a different starter for this game, the alert mentions it but doesn't change the rating
    (that listing is sometimes stale).
- **Win probability** = normal CDF of margin / 13.5.
- **Total** = each team's (points scored + opponent's points allowed) / 2, weighted the same way.
  - Wind ≥ 15 mph: −3. Rain: −2. Capped at −5.
  - Weather applies at outdoor stadiums only, via Open-Meteo.

**Edges:**
- Spread: model vs. line ≥ `MIN_SPREAD` (3 pts).
- Moneyline: model win % minus the market's no-vig % ≥ `MIN_ML` (6 pts).
- Totals: **off** (`TOTAL_EDGES=0`). If turned on, ≥ `MIN_TOTAL` (4 pts).
- No ✅ before week 4 (`MIN_WEEK`), because ratings built on 1–3 games swing wildly.

## Backtest: read this before trusting a ✅

Run `node nfl-lines/backtest.js`, or trigger the workflow with `mode=backtest` to run all three seasons.
It covers weeks 4–18 against nflverse **closing** lines. QB changes use the game's actual starter.

| Season | Spread, cushion ≥ 3 | Moneyline, edge ≥ 6 pts | Total, cushion ≥ 4 |
|---|---|---|---|
| 2023 | 66-69 (48.9%) | 82-74, −6.0% ROI | 26-36 (41.9%) |
| 2024 | 80-67 (54.4%) | 102-68, +0.4% ROI | 18-38 (32.1%) |
| 2025 | 67-66 (50.4%) | 87-54, +19.6% ROI | 22-25 (46.8%) |

- **Spread:** about 51% over three seasons. Break-even at −110 is 52.4%.
- **Moneyline:** one good year, one flat year and one losing year. Inconsistent.
- **Totals:** lose clearly. The model runs about a point above the market every season, and its big "over" calls miss.
  That's why totals edges are off by default.
- **Predicted margin:** off by about 11 points per game, against about 10 for the closing spread.
- **`RATING=srs`** wasn't better: spread 50.0% / 51.3% / 50.8%.

So the ✅ marks are "this model disagrees with the market," not a proven edge. The alert's real value today is the
current line, QB news and weather in one place at the right time. Improving the model means efficiency-based ratings
(EPA per play from play-by-play), market-aware totals, and grading picks against the lines the bot actually saw.

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
- **Flagging:** any price at your books (`MY_BOOKS`) worth at least `MIN_EV_LINES` (2%) is flagged with 💰, for example:
  "DraftKings LAC +7.5 (-110): fair 54.0%, +3.2% EV vs Pinnacle LAC +6.5 -115".
- **Your books:** `MY_BOOKS` defaults to `draftkings,fanduel,betmgm,williamhill_us,espnbet,fanatics,betrivers`
  (`williamhill_us` = Caesars). Set the repo Variable `MY_BOOKS` to just the books you have accounts at.
- **Pick log:** only live alerts are logged. Each flagged pick is written to `.cache/picks-<date>.json` with the
  price, fair probability, EV and the sharp line at the time (`sport:"nfl"`). That's the raw material for grading
  and closing-line value. `results/track.js` doesn't grade NFL yet.
- **Caveat:** Pinnacle's props are sharper than US books' but not perfect, and a thinly traded prop can be off
  at Pinnacle too. Game-line flags are the more trustworthy of the two.

## Situational tags

These come from `research/travel-climate.js`, which tests 1999–2025 results against the closing line.
Full results are in `research/travel-climate-results.md`.

| Tested | Result | In the alert? |
|---|---|---|
| Visitors at Denver (altitude) | Denver's home edge is real (+1.4 pts over a normal home team) but priced in: visitors cover 52.3% | no |
| Denver on the road; the week after visiting Denver | within noise (48.6% / 50.6%) | no |
| Dry-climate teams in humidity | only DEN/LV qualify, 22 games: too few to say | no |
| Warm/dome visitors outdoors in Dec–Jan | **45.6% ATS** (668 games), 43.2% in 1999–2011, **47.6% in 2012–2025** (about break-even to fade now), 38% in playoffs (79 games) | ⚠️ tag, informational only |
| Freezing temps (≤ 32°F) beyond the time of year; totals in cold or muggy games | nothing | no |
| Defense missing a starting CB (`research/cb-replacement.js`, 2013–2025) | opposing offense **54.2% ATS in 2020–25** (650 games, +1.4 pts), but 48.1% in 2013–19; 61.8% with 2+ starters out (103 games). No effect on the top receiver's yards | ⚠️ tag, informational only |
| A CB who got torched the last 2 games | regresses almost fully the next week (58.5 → 28.3 yds vs 26.0 average) | no |
| Team/QB division or primetime records | past records don't predict future ones (correlation ≈ 0) | no |

Tags never change the model's numbers or ✅. They're context to weigh yourself.

**How the missing-CB tag works:**
- **Starters** are the cornerbacks with ≥ 70% of defensive snaps in 2 of the team's last 3 games (nflverse snap counts).
- **Missing** means Sleeper lists him as Out, IR, PUP, Suspended or Doubtful, or he's no longer on the team, or the nflverse injury report lists him as Out or Doubtful.
- **Matching:** Sleeper has no NFL player id for most defensive backs, so they're matched by name and team.
- **Unmatched players** (about 2 of 55, usually nicknames) are never assumed missing.

## Settings

Every setting is an env var. You can also set them as repo **Variables** named `NL_<SETTING>`:
- `MIN_SPREAD`, `MIN_ML`, `MIN_TOTAL`, `TOTAL_EDGES`, `MIN_WEEK`
- `GD_MIN`, `GD_MAX`
- `LINES`, `ODDS_MONTHLY_BUDGET`
- `RATING`

Model constants (`DECAY`, `HFA`, `QB_OUT`, `WIND_*`, and so on) are at the top of `model.js`.

**State:** `nfl-lines/.cache/` holds sent markers per kickoff slot, the schedule and trimmed Sleeper data.
Only a live send (not `DRY_RUN=1`, `NTFY_TOPIC` set) marks a slot as sent.

**Code:** shares its helpers with `nfl-props/` (`lib.js`, `data.js`, `weather.js`, `odds.js`). The workflow sets
`NP_CACHE=nfl-lines/.cache` so the two bots never share state.

Run by hand: Actions → **NFL Lines** → Run workflow (`mode=slate`, `dry_run=1` shows the next slot).
Or locally:
```
MODE=slate DRY_RUN=1 node nfl-lines/run.js
```
