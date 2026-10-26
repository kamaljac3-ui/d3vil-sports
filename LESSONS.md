# Lessons log

This is the running memory between weekly bot reviews. Each row is a hypothesis about one of the bots, opened from
something concrete in a weekly report (`reports/<date>.md` on this branch). It holds **live evidence** from sent
picks; `<bot>/LEARNINGS.md` on `main` holds what each bot's **backtests** have settled. A row here only moves to
`main`'s LEARNINGS.md once it's `supported` by live data AND a backtest confirms the change. Rows are updated in
place every week and never deleted — only marked `supported`, `rejected`, or `fixed in <PR/commit>`.

| id | bot | hypothesis | evidence so far | what would settle it | status | opened | last updated |
|---|---|---|---|---|---|---|---|
| L1 | nba-edges | Closing-line value is never actually being captured for prop picks, even though the plumbing (`captureCloses`, `ODDS_API_KEY`) looks wired up. | 0 of 96 pregame prop picks in the ledger (Sep 26-Oct 24, the bot's whole history) carry a `close` value. `ODDS_API_KEY` is confirmed set in job logs, and the same key prices the props themselves fine. Spot-checked 6 pregame-run job logs (10-24/10-25) and none printed the `"<game>: closing lines for X/Y props"` line `captureCloses()` emits when it finds a pending pick in its 45-min window — [2026-10-26 report](reports/2026-10-26.md). | Check a run's full (untruncated) log during an actual 0-45-min pre-tip window for a game with an already-logged prop pick: does `captureCloses` run at all, and is `mine.length` ever nonzero? If it runs and finds nothing, check whether `TODAY` in `captureCloses` ever disagrees with the `TODAY` the pick was logged under. | watching | 2026-10-26 | 2026-10-26 |
| L2 | nba-edges | A big in-game minutes cut (8+ min below the player's logged `mpg`) predicts a much worse hit rate on props than the model's `po` confidence does. | 27 of 96 graded props (28%) had an 8+ min cut; those went 10-17 (37%) vs 58.3% overall. 6 of 27 landed on one slate (10/21, likely several blowouts — variance). 4 of 27 landed on Deandre Ayton alone, 14-16 min on a ~26 mpg average across 3 straight games (10/23-10/24) — looks like a real role change, not noise. Matches `nba-edges/LEARNINGS.md` open question 5 — [2026-10-26 report](reports/2026-10-26.md). | 100+ picks in the 8+-minute-cut slice, split by whether the cut was a single-game event (tag it `blowout risk`) vs. repeating across a player's last 2-3 games (a role change the model hasn't absorbed). If the repeating-cut group alone underperforms at that sample size, that's a case for using recent (not season) minutes in the projection. | watching | 2026-10-26 | 2026-10-26 |

## Notes for next week

- `nba-edges` picks logged from roughly 2026-10-25 23:24 UTC on (commit `64bf0bb`) finally carry `tags`, `model`, `rest` and `dvp` correctly — before that, `tags` was silently stripped from every pick since Sep 26, and `model` didn't exist before Oct 24. None of today's 126 graded picks have either field. Once next week's ledger has picks graded past 10-25, the full `nba-edges/LEARNINGS.md` "what the weekly review should check" list (b2b voids, DvP, teammate-out CLV, alert timing, model versions) becomes checkable for the first time.
- `nba-review.md` (the NBA-by-tag ledger file `results/track.js` is supposed to write) doesn't exist yet because that code landed after the last tracker run this week. It should appear after the next `results-tracker.yml` run.
- `cfb-lines/review.js` (the weekly CFB grader) landed on `main` 2026-10-25 and hasn't run its first Monday/Tuesday yet, so there's no `cfb/SUMMARY.md` to read this week.
