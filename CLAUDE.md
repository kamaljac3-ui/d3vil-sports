# CLAUDE.md

Context for Claude sessions working in this repo. Owner: Kamal (GitHub `kamaljac3-ui`).

## What this repo is

A static sports site plus newsletter. The repo is still named `d3vil-sports`, but the site is branded
**48th State Sports** (it was D3vil Sports, then StateForty8, and has been 48th State since 2026-09-16).
It's served by GitHub Pages from `main`.

- `posts/<YYYY-MM-DD>.html` holds the daily roundup. A scheduled cloud routine writes and pushes it every morning.
  **`AGENT_INSTRUCTIONS.md` is the full procedure for the roundup.** Follow that file for anything to do
  with posts, and don't restate or change its rules here.
- `commentary/` holds occasional opinion pieces that Kamal publishes by hand. The daily routine must never touch it.
- `scripts/` has `send-newsletter.js` (Kit), `send-commentary.js` and `generate-recap-audio.js` (ElevenLabs, Sundays).
- `launch-angle/` is the MLB edge bot and `nfl-props/` is the NFL player-props bot (details below). `nba-edges/` is an
  NBA bot built in a separate session, with the same ntfy and cache pattern. Read its `run.js` header and `README.md` before touching it.
- `nba-news/` sends NBA injury-news alerts. It polls ESPN injury reports every 2 min on game days and pushes who gains
  when a regular is newly ruled out. It reuses `nba-edges/run.js` exports (projectSide/flagRows/loadData/slate/roster)
  read-only, so changes to those exports must keep both bots working. See `nba-news/README.md`.
- `mlb-live/` sends in-game pitching-change alerts. It reuses `launch-angle/model.js` read-only, and runs two
  long-polling windows a day. See `mlb-live/README.md`.
- `results/` is the results tracker. It grades the picks `launch-angle/`, `nba-edges/`, `nba-news/` and `mlb-live/` actually sent (each writes
  `.cache/picks-<date>.json` on real sends) and keeps the ledger on the **`bot-results` branch**, never `main`. See `results/README.md`.

### Workflows (`.github/workflows/`)
| File | Name | Trigger | Notes |
|---|---|---|---|
| `deploy.yml` | Deploy D3vil Sports to GitHub Pages | push to `main` | Deploys the **whole repo root** to Pages. Its `newsletter` job emails Kit subscribers when a push adds or changes *today's* `posts/` file. Its `recap` job runs on Sundays. |
| `send-commentary.yml` | Send commentary broadcast | manual | One-off Kit broadcast. |
| `test-send.yml` | | manual | Newsletter test send. |
| `launch-angle-alerts.yml` | Launch Angle Edges | cron + manual | MLB bot, ntfy only. |
| `nba-edges-alerts.yml` | NBA Edges | cron (Oct–Jun) + manual | NBA bot, ntfy only. |
| `nba-news-alerts.yml` | NBA News | cron 15:30 + 21:30 UTC (Oct–Jun) + manual | Polls injury reports for about 6 h per run. Teammate-boost alerts on new Out/Doubtful rulings, ntfy only. |
| `mlb-live-alerts.yml` | MLB Live | cron 17:30 + 23:20 UTC (Mar–Nov) + manual | Polls live games for up to about 6 h per run. Pitching-change alerts, ntfy only. |
| `results-tracker.yml` | Bot Results Tracker | cron daily 11:00 UTC + manual | Grades sent picks and pushes the ledger to the `bot-results` branch. Sends a weekly ntfy scorecard on Mondays. |
| `nfl-props-alerts.yml` | NFL Props Edges | cron every 2 h, each run looping up to 5 h + manual | NFL props bot, ntfy only. |
| `nfl-lines-alerts.yml` | NFL Lines | cron every 2 h, each run looping up to 5 h + manual | NFL game-lines bot, ntfy only. |
| `cfb-lines-alerts.yml` | CFB Lines | cron every 15 min (Aug–Jan) + manual | College football spread/total bot. Sends to its **own** ntfy topic (`NTFY_TOPIC_CFB`), not the shared one. |

**Consequences of every push to `main`:**
- The Pages deploy re-runs.
- The whole repo, `launch-angle/` included, is published on the site. Never commit secrets or `.cache/` directories.
- A push that touches today's post sends the newsletter. Keep bot commits out of `posts/`.
- The working tree often holds unrelated local changes, such as an in-progress post or a script tweak.
  Stage specific paths and never use `git add -A` or `git add .`.

## ntfy alerts (bots only)

- The bots send phone alerts **only to ntfy, never to Kit/the newsletter.**
- Repo secrets: `NTFY_TOPIC` (required; CFB Lines uses its own `NTFY_TOPIC_CFB` instead), plus optional `NTFY_TOKEN` (sent as a Bearer header) and `NTFY_SERVER`
  (defaults to `https://ntfy.sh`).
- The bot POSTs JSON `{topic,title,message,priority,tags}` to the server root. Messages are truncated to about 3,900 characters.
- If `NTFY_TOPIC` is missing or `DRY_RUN=1`, the bot prints the alert to the log and doesn't send it.
- **Per-sport topics.** Each workflow maps its own secret onto the `NTFY_TOPIC` env var:
  - NFL (`nfl-props`, `nfl-lines`): `NTFY_TOPIC_NFL`, falling back to `NTFY_TOPIC` if it isn't set.
  - CFB: `NTFY_TOPIC_CFB`, with no fallback.
  - MLB and NBA: `NTFY_TOPIC`.

## MLB bot: `launch-angle/` ("Launch Angle Edges")

- `run.js` handles orchestration, data fetching, caching and ntfy. `model.js` holds the physics and the CSV-to-profile parsing.
- **Model.** Each hitter's attack angle, bat speed and average launch angle come from the Baseball Savant bat-tracking and
  statcast leaderboards. A per-hitter contact offset `D0` is calibrated so a league-average fastball reproduces the hitter's
  own launch angle. That profile is then run against the opposing probable starter's pitch mix: vertical approach angle
  (VAA) and plate velocity for each pitch type, computed from Savant pitch-level `vy0/vz0/ay/az`. The model is a 2D
  bat–ball collision (COR 0.5, with spin) followed by a drag-and-Magnus flight integration to a 380 ft fence (`FENCE`).
  The outputs are the "window" (25–35° launch share) and the "HR contact" share. The edge is the matchup minus the same
  hitter against a league-average fastball.
- **Park and weather (`env.js`, shown in alerts only).** This is used by `launch-angle/` and `mlb-live/`.
  - **Sources.** MLB venue data gives fence distances by direction, elevation, the home-plate-to-CF azimuth and roof type.
    Game weather is MLB's own first-pitch report ("12 mph, Out To LF", temp, "Roof Closed") once posted. Before that
    it's the Open-Meteo forecast at game time, with the wind projected onto the field by the azimuth.
  - **Physics.** Air density comes from temperature and elevation. The wind is applied along each spray direction, and
    spray is pull-weighted by batting side (switch hitters bat opposite the pitcher's hand).
  - **Why contact quality is spread.** The collision model alone gives every fly ball 105+ mph, which ignores the
    environment. So when an env is passed, `model.js` spreads exit velocity over a contact-quality distribution
    (`LA_QMEAN` 0.90, which gives about 12% HR per 18–45° contact).
  - **Shrinking.** The backtest showed real signal but the physics overstates it, so alerts use
    `(env HR / neutral-park HR)^LA_ENV_B` (0.2) with the reported wind scaled by `LA_WIND_SCALE` (0.5).
  - **No env = old behavior.** Without an env, `model.matchup` is byte-for-byte unchanged.
  - **Not in the edge rule.** Neither the edge rule nor the ranking uses the multiplier yet: it didn't improve picks
    in the backtest.
- **Modes.**
  - `MODE=morning` runs at cron `0 14 * * *`, which is 10 AM EDT and 9 AM EST. It scores probable starters against
    each team's active-roster hitters and sends one "top edges" push per day.
  - `MODE=lineups` runs every 30 min from 15:00 to 02:30 UTC. Once both lineups for a game post, it sends **one push
    per game** and records that game as sent.
- **Settings (env).**
  - `FENCE` (380)
  - `MIN_EDGE` (0.03)
  - `GAP_LO`/`GAP_HI` (5/12°, the attack-angle vs. primary-pitch VAA gap window)
  - `TOP_N` (8)
  - `DATE` (override for "today", in ET)
- **Data sources.** Savant CSV endpoints, which have no key but are slow and occasionally flaky. You can drop
  leaderboard CSVs into `launch-angle/data/` as a manual fallback. Schedules, lineups and rosters come from the
  MLB Stats API.
- **Cache.** Files live in `launch-angle/.cache/`:
  - `hitters.json`: 7 days
  - `p-<id>.json`: 20 h
  - `r-<team>-<date>.json`: 12 h
  - `morning-<date>.json` / `lineups-<date>.json`: the sent markers
- **Errors.** The bot sends an ntfy "Launch Angle bot error" at priority 2 and exits 1.
- **Backtest: no demonstrated edge.** `node launch-angle/backtest.js` covers 2025 and 2026 with prior-season profiles and
  about 157k PA; results are in `launch-angle/BACKTEST.md`. The bot's picks homered 1.05x as often as expected from
  hitter and pitcher HR rates (z +0.6), and the live-bot rule came in at 1.03x. HR-contact deciles show no trend.
  Say so if Kamal asks whether it's an edge. The pitch data is cached in `launch-angle/.cache/bt`, so re-testing
  a model change takes minutes (the park/weather pass adds about 12 min).
- **Park/weather backtest.** The settings were fit on 2025 and checked on 2026 (log-likelihood gain 9.5 out of sample).
  - The bottom decile of the multiplier came in at 0.78x/0.82x actual HR, and the top decile at 1.18x/1.13x.
  - By MLB-reported wind: wind blowing in reduces HRs, and 13+ mph in was 0.47x in 2025. Blowing out is only about
    +0–13%.
  - It doesn't improve the bot's picks: bot rule + multiplier ≥ 1.15 came in at 1.19x/1.10x, not significant.
  - Ranking starters by hitter×pitcher HR rate underperforms (0.81x/0.92x) whether or not weather is added, so the
    expected-rate baseline is overconfident at the top.

## NFL bot: `nfl-props/` ("NFL Props Edges")

**`nfl-props/README.md` is the full reference.** In short:
- **Data:** nflverse (play-by-play, snaps, FTN, participation, rosters, depth charts, injuries, schedule with lines),
  Sleeper injury status, Open-Meteo, and optionally The Odds API (`ODDS_API_KEY`, with a monthly credit budget).
- **Model:** opportunity (snap share × share per snap, plus redistribution when a teammate is out) × matchup
  (defense by position, man/zone, pressure vs. the offensive line, blitz, stacked box) × environment (implied total,
  game script, wind/rain).
- **Backtest:** `node nfl-props/backtest.js` (2025, weeks 4–18). Rerun it after any model change and update the README table.
- **Schedule:** a cron every 2 h starts a run that loops for up to 5 h (see lesson 7). `MODE=auto` decides from Eastern time:
  - Wednesday from 11 AM: first projections
  - Friday from 5 PM: update (plus odds)
  - 75–110 min before each kickoff: one alert per game
- **State:** only small files, saved only when a run changes state (`state_changed` output + `actions/cache/save`).
  Raw data is re-downloaded each run.

## NFL game lines: `nfl-lines/` ("NFL Lines")

One ntfy alert per kickoff slot, 75–110 min out. It shows the current spread, total and moneyline (free from ESPN's
scoreboard, i.e. DraftKings; optionally The Odds API) next to a port of `nfl-edge-finder`'s rating model. See
`nfl-lines/README.md`.
- **The backtest is not profitable:** about 51% ATS over 2023–25, and totals lose, so totals edges are off by default.
  Say so if Kamal asks whether it's an edge.
- **It reuses `nfl-props/` helpers** (`lib`, `data`, `weather`, `odds`), with its state in `nfl-lines/.cache`
  via `NP_CACHE`. Changes to those shared files must keep both bots working.
- **Stale-line finder (`nfl-props/sharp.js`, used by both NFL bots):** compares `MY_BOOKS` against the sharp book's no-vig price and flags +EV offers with 💰. Live alerts log their picks to `.cache/picks-<date>.json` with `sport:"nfl"`. `results/track.js` doesn't grade NFL yet.
- **nfl-lines ⚠️ tags (`nfl-lines/tags.js`) are informational and never change the model:**
  - warm/dome visitor outdoors in Dec–Jan
  - missing starters: defense missing a CB, offense missing 2+ O-linemen, defense missing a DL/LB vs a run-heavy offense
  - windy games (12+ mph), with wind direction relative to the field
  The evidence is in `nfl-lines/research/*-results.md`.
- **Sleeper's trimmed copy** (`nfl-props/data.js`) also keeps defensive backs, keyed `n:<name>|<team>`, because most have no gsis id.
- **ESPN returns 403 to the custom browser User-Agent**, so ESPN requests go out with no custom User-Agent.

## CFB game lines: `cfb-lines/` ("CFB Lines")

College football spreads and totals. **`cfb-lines/README.md` is the full reference.** In short:
- **Data:** CollegeFootballData.com (`CFBD_API_KEY` secret). The free tier is 1,000 calls/month, shared with CFBD
  basketball, and the bot stops at `CFBD_MONTHLY_BUDGET` 700. Every response is cached in `cfb-lines/.cache/cfbd`.
- **Availability:** SEC, Big Ten, ACC and Big 12 conference-game reports come from the HD Intelligence feed that
  the conference sites embed. It's undocumented, so treat it as best-effort.
- **Model and backtest:** `node cfb-lines/backtest.js` refits `params.json` on 2021–22 and grades 2023–25.
  Rerun it after any model change.
- **Modes:** first look (Sunday/Monday), update (Thursday noon), final (9 AM ET on game day) and a game-day
  alert 75–110 min out only on material change. `MODE=probe` checks every source from the runner.

## Conventions and lessons (apply to every bot here)

1. **Dry runs must never mark alerts as sent.** Only write the "sent" state when `!DRY_RUN && NTFY_TOPIC`.
   An early version of the MLB bot wrote the marker on dry runs too (fixed in commit 0b814d9).
2. **State persists between runs through `actions/cache`**, using a unique key per run (`<prefix>-${{ github.run_id }}`)
   plus `restore-keys: <prefix>-` so each run restores the most recent cache. Caches are immutable, which is why the
   key must be unique. Unused caches are evicted after 7 days, so a cold start has to be safe: re-download the data,
   and at worst send one duplicate alert.
3. **First runs are slow** because of the data downloads. Size `timeout-minutes` for a cold cache, not a warm one.
4. Every workflow gets `workflow_dispatch` with a `dry_run` input and a `concurrency` group with `cancel-in-progress: false`.
5. Keep all thresholds and tunables as env settings with defaults in code. Don't hard-code them.
6. **Times.** GitHub cron is UTC only. Compute "today" and kickoff-relative windows in `America/New_York` with
   `Intl`, and don't hard-code a UTC offset. For DST (Nov 1, 2026), schedule cron generously and gate inside the script.
7. **Don't rely on frequent crons for time-critical alerts.** GitHub skips them on busy days. On Sunday Sep 27, 2026,
   the NFL bots' 15-minute crons ran only about every 3 hours, and 3 of 4 game-day windows were missed.
   - **The fix:** schedule a run every 2 hours that stays up to 5 h (`LOOP_MIN`). `tick()` returns how long until the
     next alert window, and the run sleeps until then, rechecking every `LOOP_EVERY` minutes while a window is open.
   - This covers every window with at least two runs. `mlb-live` uses the same long-run idea.
   - Still use windows ("is kickoff 75–110 min away"), never exact times.
8. Each bot lives in its own folder with its own workflow, README, cache prefix and concurrency group.
   Don't change a working bot while building another.

## Tooling

- The `gh` CLI is used to read Actions runs and logs, for example:
  - `gh run list -R kamaljac3-ui/d3vil-sports`
  - `gh run view <id> --log-failed`
- Node 20 with no npm dependencies. The bots use global `fetch` and a hand-rolled CSV parser. Keep it dependency-free
  unless there's a strong reason not to.
- Commits: end messages with the Claude co-author line. Push to `main` only when Kamal has asked for it.
