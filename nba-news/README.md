# NBA News

Injury-news alerts sent to the same ntfy topic as the other bots. When a regular is newly ruled out, it pushes right away with the teammates who gain, using the `nba-edges` model read-only (`../nba-edges/run.js` projectSide/flagRows and the stats snapshot).

**Why it exists:** the `nba-edges` backtest (`../nba-edges/BACKTEST.md`, 2024–25 and 2025–26) found that bench players who absorb a missing regular's minutes beat their average 70–77% of the time, against a ~48% baseline. Sportsbooks move those lines within minutes of the news, so speed is the whole point. The morning and pregame alerts in `nba-edges` check injuries once; this checks every 2 minutes.

## How a run works (`watch.js`)

1. **Poll.** Every `POLL_SEC` (120 s) it reads ESPN's game summary for each game today that tips more than `MIN_TIP_MIN` (5) minutes from now, and collects the Out/Doubtful players on each team.
2. **Baseline.** The first look at a game (start of day, or a cold cache) records the outs already listed without alerting, because the morning/pregame alerts cover those.
3. **New ruling.** When a new player shows up, he only counts if he's a *regular*: 15+ MPG and playing most of his team's games (a long absence is already in everyone's averages). The bot then projects his team with and without the news (`projectSide`) and lists up to `NEWS_TOP` (5) teammates whose projection boost clears the `nba-edges` bar (`flagRows`), ranked by how much *this news* raised them.
4. **Alert.** Example: `POR: Deni Avdija OUT vs PHI, 6:00 PM ET`, then `Branden Carlson (bench 12 mpg): PTS proj 8.5 vs 5.8 avg (+47%)`. It's priority 5 when someone clears the bar, 3 when no teammate does. The picks are logged to `.cache/picks-<date>.json` (mode `news`) for `results/`.
5. **State.** Seen outs persist across the two daily windows via the Actions cache (`nba-news-` prefix, saved even when a run fails).

## Schedule (`.github/workflows/nba-news-alerts.yml`)

- **Windows.** Two a day, Oct–Jun:
  - 15:30 UTC
  - 21:30 UTC, which runs to about 03:25 UTC and covers late West Coast tips in both EDT and EST
- **Stops early.** Each window polls for `MAX_MINUTES` (355) or stops once every game is within 5 minutes of tip. On days with no games it exits in seconds.
- **Load.** About one ESPN request per game every 2 minutes.

## Settings (env)

`POLL_SEC` (120), `MAX_MINUTES` (350), `NEWS_TOP` (5), `MIN_TIP_MIN` (5), `DATE`, `DRY_RUN`.

The `nba-edges` settings also apply: `BOOST_MIN`, `MIN_PROJ`, `NBA_OUT_*`.

For testing: `POLLS=N` (stop after N polls), `ONCE=1`, `TEST_INJECT="Player Name"` (treat him as ruled out from the 2nd poll on). For example:

```
DRY_RUN=1 DATE=2026-03-15 POLLS=3 POLL_SEC=2 TEST_INJECT="Deni Avdija" node nba-news/watch.js
```

## Limits

- **ESPN's feed lag.** ESPN's injury list is the source, and it can trail the official NBA report or a reporter's tweet by a few minutes. A faster feed (the NBA's official injury report PDFs, or a news API) would be the next upgrade.
- **Snapshot data.** Stats come from the `nba-edges` snapshot (`nba-edges/data/nba-stats.json`). If it's stale, projections fall back the same way the NBA bot's do.
- **Questionable players aren't alerted.** Only Out/Doubtful rulings trigger an alert.
- **Returns aren't alerted.** A player coming back from an injury doesn't trigger an alert.
- **Unproven live.** The backtest knew every absence in advance, so the live hit rate will be lower by however much late scratches and line moves cost. The results tracker will measure it.
