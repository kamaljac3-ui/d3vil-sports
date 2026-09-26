# Bot Results Tracker

Grades every pick the alert bots actually sent and keeps a running scorecard, so you can tell whether an "edge" is real or noise.

## How it works

1. **The bots log what they send.** When `launch-angle/` or `nba-edges/` really sends an alert (not a dry run, `NTFY_TOPIC` set), it appends the picks in that alert to `.cache/picks-<date>.json`.
2. **The tracker grades them daily.** `.github/workflows/results-tracker.yml` runs at 11:00 UTC. It restores both bots' caches (read-only), adds any new picks to the ledger, and grades every pick whose game has finished:
   - **MLB** (MLB Stats API game feed): plate appearances, home runs, HR off the flagged starter, whether he actually started, and batted balls at 25-35°. The baseline is the hitter's own HR rate *before* that day (shrunk toward 3% HR/PA with 100 PA of league average), turned into a chance of homering given the plate appearances he actually got.
   - **NBA** (ESPN box score): minutes, PTS, REB, AST, 3PM against the player's average and projection, or against the posted line for prop picks.
   - Players who don't play are voided, not counted as losses. So are games still not final after `GIVE_UP_DAYS` (3).
3. **The ledger lives on the `bot-results` branch** (`mlb.json`, `nba.json`, `SUMMARY.md`), not `main`. That way it outlives the 7-day Actions cache, doesn't trigger the Pages deploy, and doesn't send the newsletter. Read `SUMMARY.md` on that branch for the scorecard.
4. **Weekly ntfy scorecard** on Mondays (or run the workflow manually with `send_summary: 1`).

## Reading the scorecard

- **MLB:** "Homered in X vs Y expected" is the core test. A ratio above 1.00x means flagged hitters homer more than they normally do. The z-score says how surprising that is: |z| < 1 is noise, and |z| > 2 is worth taking seriously.
- **NBA boosts / zone edges:** "model said +A, got +B". If B is near zero the boost isn't real. If B tracks A, the projections are calibrated.
- **Prop lines:** W-L and units at -110. Break-even is 52.4%.
- Anything under ~100 graded picks is flagged as a small sample. Don't act on it yet.

## Settings (env)

`RECENT_DAYS` (7), `GIVE_UP_DAYS` (3), `SMALL_SAMPLE` (100), `SEND_SUMMARY` (`1` = always, `0` = never, unset = Mondays), `DRY_RUN`, `LEDGER_DIR` (`ledger`), `PICK_DIRS` (`launch-angle/.cache,nba-edges/.cache`), `DATE`.

## Not tracked yet

- **Closing-line value:** prop picks record the line at alert time, but not where it closed.
- **Picks older than the cache:** the bots' caches are evicted after 7 days unused. If the tracker stops running for a week, picks from that week are lost.
