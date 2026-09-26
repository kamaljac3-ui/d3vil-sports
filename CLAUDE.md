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
- `results/` is the results tracker. It grades the picks `launch-angle/` and `nba-edges/` actually sent (each writes
  `.cache/picks-<date>.json` on real sends) and keeps the ledger on the **`bot-results` branch**, never `main`. See `results/README.md`.

### Workflows (`.github/workflows/`)
| File | Name | Trigger | Notes |
|---|---|---|---|
| `deploy.yml` | Deploy D3vil Sports to GitHub Pages | push to `main` | Deploys the **whole repo root** to Pages. Its `newsletter` job emails Kit subscribers when a push adds or changes *today's* `posts/` file. Its `recap` job runs on Sundays. |
| `send-commentary.yml` | Send commentary broadcast | manual | One-off Kit broadcast. |
| `test-send.yml` | | manual | Newsletter test send. |
| `launch-angle-alerts.yml` | Launch Angle Edges | cron + manual | MLB bot, ntfy only. |
| `nba-edges-alerts.yml` | NBA Edges | cron (Oct–Jun) + manual | NBA bot, ntfy only. |
| `results-tracker.yml` | Bot Results Tracker | cron daily 11:00 UTC + manual | Grades sent picks and pushes the ledger to the `bot-results` branch. Sends a weekly ntfy scorecard on Mondays. |
| `nfl-props-alerts.yml` | NFL Props Edges | cron every 15 min + manual | NFL props bot, ntfy only. |
| `nfl-lines-alerts.yml` | NFL Lines | cron every 15 min + manual | NFL game-lines bot, ntfy only. |

**Consequences of every push to `main`:**
- The Pages deploy re-runs.
- The whole repo, `launch-angle/` included, is published on the site. Never commit secrets or `.cache/` directories.
- A push that touches today's post sends the newsletter. Keep bot commits out of `posts/`.
- The working tree often holds unrelated local changes, such as an in-progress post or a script tweak.
  Stage specific paths and never use `git add -A` or `git add .`.

## ntfy alerts (bots only)

- The bots send phone alerts **only to ntfy, never to Kit/the newsletter.**
- Repo secrets: `NTFY_TOPIC` (required), plus optional `NTFY_TOKEN` (sent as a Bearer header) and `NTFY_SERVER`
  (defaults to `https://ntfy.sh`).
- The bot POSTs JSON `{topic,title,message,priority,tags}` to the server root. Messages are truncated to about 3,900 characters.
- If `NTFY_TOPIC` is missing or `DRY_RUN=1`, the bot prints the alert to the log and doesn't send it.

## MLB bot: `launch-angle/` ("Launch Angle Edges")

- `run.js` handles orchestration, data fetching, caching and ntfy. `model.js` holds the physics and the CSV-to-profile parsing.
- **Model.** Each hitter's attack angle, bat speed and average launch angle come from the Baseball Savant bat-tracking and
  statcast leaderboards. A per-hitter contact offset `D0` is calibrated so a league-average fastball reproduces the hitter's
  own launch angle. That profile is then run against the opposing probable starter's pitch mix: vertical approach angle
  (VAA) and plate velocity for each pitch type, computed from Savant pitch-level `vy0/vz0/ay/az`. The model is a 2D
  bat–ball collision (COR 0.5, with spin) followed by a drag-and-Magnus flight integration to a 380 ft fence (`FENCE`).
  The outputs are the "window" (25–35° launch share) and the "HR contact" share. The edge is the matchup minus the same
  hitter against a league-average fastball.
- **Environment isn't modeled yet.** The flight model uses a fixed air density (ρ = 1.2), no wind, no park
  dimensions and no roof handling. Weather (Open-Meteo, the ballpark wind reading, air density) is a future
  upgrade, not current behavior. The Open-Meteo stadium-weather code that does exist is in the separate Python repo
  `nfl-edge-finder` (`providers/weather.py`, `stadiums.py`).
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

## NFL bot: `nfl-props/` ("NFL Props Edges")

**`nfl-props/README.md` is the full reference.** In short:
- **Data:** nflverse (play-by-play, snaps, FTN, participation, rosters, depth charts, injuries, schedule with lines),
  Sleeper injury status, Open-Meteo, and optionally The Odds API (`ODDS_API_KEY`, with a monthly credit budget).
- **Model:** opportunity (snap share × share per snap, plus redistribution when a teammate is out) × matchup
  (defense by position, man/zone, pressure vs. the offensive line, blitz, stacked box) × environment (implied total,
  game script, wind/rain).
- **Backtest:** `node nfl-props/backtest.js` (2025, weeks 4–18). Rerun it after any model change and update the README table.
- **Schedule:** the cron runs every 15 min from 11:00 to 01:59 UTC. `MODE=auto` decides from Eastern time:
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
- **ESPN returns 403 to the custom browser User-Agent**, so ESPN requests go out with no custom User-Agent.

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
7. Scheduled workflows can start several minutes late, and brand-new schedules sometimes take a while to first fire.
   Use windows ("is kickoff 75–120 min away") rather than exact times.
8. Each bot lives in its own folder with its own workflow, README, cache prefix and concurrency group.
   Don't change a working bot while building another.

## Tooling

- The `gh` CLI is used to read Actions runs and logs, for example:
  - `gh run list -R kamaljac3-ui/d3vil-sports`
  - `gh run view <id> --log-failed`
- Node 20 with no npm dependencies. The bots use global `fetch` and a hand-rolled CSV parser. Keep it dependency-free
  unless there's a strong reason not to.
- Commits: end messages with the Claude co-author line. Push to `main` only when Kamal has asked for it.
