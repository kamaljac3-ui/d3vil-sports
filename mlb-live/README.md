# MLB Live

In-game pitching-change alerts, sent to the same ntfy topic as the other bots. When a team brings in a new pitcher, it re-runs the launch-angle model (`../launch-angle/model.js`, read-only) for the hitters due up against him. It pushes an alert if any of them clear the edge bar, once per pitcher per game.

Starters are handled by `launch-angle/` (morning + lineups). This bot only covers pitchers who enter mid-game.

## How a run works (`live.js`)

1. Every `POLL_SEC` (45 s), it makes one MLB Stats API request (`schedule?hydrate=linescore`) covering every game today. For each live game it reads the fielding team's current pitcher.
2. **New pitcher:** it fetches the box score and skips the pitcher if he's the starter. Otherwise it takes the opponent's next `N_NEXT` (6) hitters due up: from the linescore's current or due-up batter, continuing through the batting order.
3. **Scoring:** each hitter who has a Savant swing profile is scored against the pitcher's arsenal, using the same physics as launch-angle, relative to a league-average fastball. The edge rule is:
   - window gain ≥ `MIN_EDGE`
   - swing/approach gap between `GAP_LO` and `GAP_HI`
   - and, unlike launch-angle, **HR contact at or above his baseline** (`REQUIRE_HR_EDGE`, on by default)
4. **Alert:** e.g. `TB @ PHI, Bot 7: Manuel Rodríguez in`, then `1st up: … HR contact 31% (+9), window 24% (+6) …` and the score. The picks are logged to `.cache/picks-<date>.json` for `results/`, which grades them on the PAs against that pitcher.
5. **Idle time:** between polls it spends up to `PREFETCH_SEC` (20 s) building Savant profiles for every pitcher on today's active rosters, so a reliever's profile is usually ready before he enters. Profiles keep for 72 h. A cold cache (about 400 pitchers) takes the first hour or so of a window.
6. **Cold start:** the first time it sees a game already in progress, it marks the pitchers currently in as seen without alerting. That stops stale alerts after a restart.

## Schedule (`.github/workflows/mlb-live-alerts.yml`)

- Two windows a day, March–November, because Actions jobs cap at 6 h:
  - **Afternoon:** 17:30 UTC
  - **Evening:** 23:20 UTC, which runs to about 05:00 UTC (1 AM EDT)
- Each window polls for `MAX_MINUTES` (345), or stops early once every game is final.
- The two share a concurrency group, so the evening run queues behind the afternoon one.
- The cache is saved even if the poll step fails.

## Settings (env)

`MIN_EDGE` (0.03), `GAP_LO`/`GAP_HI` (5/12), `REQUIRE_HR_EDGE` (1), `N_NEXT` (6), `MIN_PITCHES` (150), `FENCE` (380), `POLL_SEC` (45), `PREFETCH_SEC` (20), `MAX_MINUTES` (345), `DATE`, `DRY_RUN`.

For testing: `ONCE=1` (one poll, then exit) and `ALERT_EXISTING=1` (treat relievers already in the game as new).

## Cost

- $0 while the repo is public, because Actions minutes are free and the MLB Stats API and Savant have no keys.
- About 10–11 runner hours a day in season. On a private repo that would be roughly $100–150 a month, so move it to a VPS rather than pay for that.
- ntfy: it only alerts when an edge clears the bar, so expect roughly 0–30 alerts a day.

## Limits

- Only hitters with a Savant bat-tracking profile (about 200 qualifiers) can be flagged.
- Relievers with fewer than `MIN_PITCHES` tracked pitches are skipped.
- A pitching change is noticed on the next poll after he takes the mound (up to about 45 s, plus the MLB feed's own delay). Lines move fast, so alerts are only useful if you're watching live.
- No park, weather or platoon adjustments. It's the same model as launch-angle.
