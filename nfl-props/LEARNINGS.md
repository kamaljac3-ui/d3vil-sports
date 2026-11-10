# nfl-props: what we've learned

Read this before changing the model or testing an angle, so nothing gets re-tested or forgotten. The weekly review
(scheduled task `nfl-bots-weekly-review`) updates it every Tuesday.

## The rule

An angle goes **into the model** only if it beats an **out-of-sample** backtest: tuned on one stretch, then tested on
games it never saw. In practice that means fitting on 2025 and holding out 2026 to date, or the reverse. Otherwise it
can be an informational tag at most. Win-loss on live picks needs hundreds of picks to mean anything.

Props have no free closing lines, so they can't be graded on closing-line value. Grade them on the projection's miss
(MAE) and on the share of edge calls that landed on the right side. Live W-L counts only once a group has 100+ picks.

## Model versions

Logged as `ctx.model_version` on every pick since Oct 25, 2026 (`nfl-props/context.js`). Bump it whenever the numbers change.

| Version | Date | What changed |
|---|---|---|
| (before versioning) | Sep 26 – Oct 24, 2026 | First model, plus the fixes below |
| `props-2026.10.24` | Oct 24, 2026 | League baselines follow the current season within about 2 weeks (`LG_PRIOR_GAMES=64`); game-day window 80→10 min; lines and prices from your book only |

## Angles tested

| Angle | Test | Result | Out of sample? | Status |
|---|---|---|---|---|
| Opportunity (snap share × share per snap) × matchup × environment | Backtest 2025 wk 4–18 | Beat last-4-game average MAE on every stat (rec yds 20.4 vs 21.8, rush 21.4 vs 23.1, pass 60.4 vs 67.1) | 2026 wk 4–7: still beats it (rec yds 22.7 vs 24.3) | **In model** |
| Teammate out → usage redistribution (85% to teammates, same position first, only if he played in the last 1–2 games, team cap 95%) | Backtest 2025 | Fixed a +8 yd overshoot from redistributing long-gone players | Held on 2026 (bias ≈ −1 yd) | **In model** |
| Probability calibration (pull halfway to 50%, `PROB_CAL=0.5`) | 2025 calibration buckets | Raw probabilities were about 2× overconfident | 2026 buckets roughly calibrated (0.58–0.70 → 64%) | **In model** |
| Lognormal outcome distribution | 2025 | Medians sit below means; normal overstated overs | — | **In model** |
| Prior-season weight (`PRIOR_W` 0.35 vs 0.2 vs 0.1) | 2025 + 2026 | No meaningful difference | Both seasons | Left at 0.35 |
| League baseline follows current season (`LG_PRIOR_GAMES=64`) | 2026 passing ran +10 yds/team-game over 2025 | Pass-yds bias −12.4 → −11.6 (2026), 2025 unchanged | Tested on both, but the gain is small | **In model** (weak) |
| Wind threshold 8 mph, 0.9%/mph (was 12 mph, 1.2%/mph) | 2025 backtest with recorded wind | Slightly better on every stat | Oct 27 review, 2026 wk 4–7: the old 12 mph / 1.2% setting did as well or slightly better (pass yds MAE 62.1 vs 62.5, rec yds 22.47 vs 22.48). **Not confirmed out of sample**; the difference is noise | In model; **not confirmed**: watch. Revert to 12 mph if 2026 keeps favouring it |
| Wind direction multiplier (crosswind 1.3×, along-field 0.8× at 12+ mph) | `nfl-lines/research/wind-direction.js`, 1999–2025 passing yards | Crosswind −43 vs along −26 combined pass yds at 12+ mph (~2 SE) | ❌ **Not backtested in the props model** (the backtest's recorded weather has no direction, so turning it off changes no backtest number) | **In model: breaks the rule.** Oct 27 review proposed turning it off (`DIR_CROSS=1`, `DIR_ALONG=1`) unless an ERA5 backtest supports it |
| Man/zone coverage split (2025 participation) | Built in | Effects are tiny (mz ≈ 1.00) | — | In model; contributes almost nothing |
| Defense missing a starting CB → opposing top WR/TE | `nfl-lines/research/cb-replacement.js` | +2 yds over baseline, noise | — | **Rejected** for props |
| Probability calibration by side (open question 2) | 2026 wk 4–7 backtest buckets | P(over) 0.30–0.42 → 34.7% overs; 0.58–0.70 → 64.8%. Calibrated on both sides | 2026 is out of sample for the calibration | The under lean is structural (skewed stats: medians sit below means), not miscalibration. Keep |
| Drop injury-shortened games (snap share under half his median) from the snap-share average (Nov 3 review, after McConkey 39% projected → 90% actual) | Test switch `PARTIAL_SNAP=0.5`, all players and starters-only (median 60%+) | Worse on changed players in 2025 wk 4–18 (rec yds MAE 13.51 → 14.01; starters 15.57 → 16.11) | 2026 wk 4–8 also worse or flat (15.74 → 16.02; starters 18.79 → 18.96) | **Rejected** as a model change: partial games carry real role information. Proposed as a ⚠️ "snap dip" tag (info only) |
| Players with fewer than 2 games this season (Nov 10 review, after Tank Dell U1.5 rec: projected 0.65 with no 2026 snap history, caught 4) | Throwaway backtest dump: projection error as % of the player's average, <2 games vs 2+ games | 2025 wk 4–18: rec yds 86% vs 62%, rec 93% vs 50%, rush 73% vs 50%, pass 36% vs 28% (n 12–32) | 2026 wk 4–9: 75% vs 62%, 53% vs 50%, 56% vs 54%, 54% vs 28% (n 7–24). Worse in both seasons; direction of the miss not consistent | **Proposed** as a pick filter (`MIN_PICK_GAMES=2` in `run.js` `evaluate()` for line-priced picks; the backtest never grades these players). Not applied yet |
| A CB who got torched the last 2 games | 2023–25 proxy (PBU/tackler) | Regresses almost fully next game (58.5 → 28.3 vs 26.0 average) | — | **Rejected** |

## Live record (graded by `nfl-lines/grade.js`, ledger `bot-results:nfl/`)

As of Oct 24, 2026, model picks vs a real FanDuel line went 23-20 (−0.66u). Unders 20-15, overs 3-5. 💰 stale props 1-3.
Note that picks before Oct 24 were priced at the best book pulled, sometimes a sharp book, so those prices are not FanDuel's.

**Oct 27 review (through week 7):** the ledger says 35-28 (+2.84u), but that counts a pick twice when the Friday alert
and the game-day alert repeat it. Counted once per game: **29-25 (+0.57u)**. Unders 23-18, overs 6-7. By the book on the
pick: FanDuel 13-14 (−2.76u), BetOnline 8-7, Pinnacle 8-4 (+3.54u): the profit so far sits on prices he can't bet.
Week 7 game-day picks were still priced at BetOnline/Pinnacle because game day reuses Friday's stored lines, and
Friday's (Oct 23) were saved before the your-book fix; `evaluate()` treats a missing `atMyBook` as yours.
No pick has `ctx` yet (context logging went live Oct 25 23:27 UTC, after the Sunday games).

Backtest 2026 wk 4–7 (Oct 27): rec yds MAE 22.5 vs 24.2 recent avg, rec 1.57 vs 1.63, rush 21.9 vs 22.7, pass 62.5 vs
67.0. Pass-yds bias −6.8 (was −11.6 on Oct 24): improving as the baselines catch up. Edge-call hit rates 60–64%
(vs the recent average, not real lines).

**Nov 3 review (week 8, first week with `ctx`):** ledger 24-23 (−2.77u), counted once per game **22-19 (−0.48u)**.
Season once per game **51-44 (+0.09u)**; FanDuel-priced only **35-33 (−3.24u)**. Every week-8 model pick showed FanDuel.
Unders 16-15, overs 6-4. Role misreads (snap share off 15+ points) 7-8, the rest 15-11. Tags (game day): teammate_out
7-6 (overs on the gaining player 5-4, unders 2-4), questionable 2-3, no tags 14-11. 💰 stale props 1-5 (season 4-10): the
fair price may now come from SportsGameOdds' own consensus (no Pinnacle on SGO since Oct 29); the ledger doesn't keep
which. Mayfield 0 pass yds / Godwin 0 rec were real (TB threw 3 passes).

Backtest 2026 wk 4–8 (Nov 3): rec yds 22.45 vs 23.98, rec 1.56 vs 1.63, rush 22.41 vs 23.42 (bias +0.2), pass 63.9 vs
69.8 (bias **−2.7**, was −6.8). Edge-call hit rates 63–78%. Buckets still calibrated (0.58–0.70 → 62.8%).

**Nov 10 review (week 9):** ledger 24-21 (−0.70u) but that includes the Sunday parlay and 3 Friday repeats; counted once
per game **21-20 (−2.34u)**. A Friday pick flipped on game day (Singletary Under → Over after two teammates were ruled
out) and the ledger logged both sides. Season once per game **72-64 (−2.24u)**; FanDuel-priced only **56-53 (−5.58u)**.
Pass-yds Unders 0-5 this week (season 4-6 on 10 picks). Rec yds 9-5. Tags (season, deduped): teammate_out 15-10 (Overs 9-8,
Unders 6-2), no tags 27-27. Role misreads (snap share off 15+) 9-12 vs the rest 34-26. 💰 stale props 5-1 (season 9-11:
Unders 7-4, Overs 2-7).

Backtest 2026 wk 4–9 (Nov 10): rec yds 22.05 vs 23.55, rec 1.52 vs 1.60, rush 22.08 vs 22.99 (bias **+1.14**; week 9
alone +5.9), pass 63.6 vs 67.2 (bias −2.6). Edge-call hit rates 62–73%. Buckets calibrated (0.58–0.70 → 62.4%).

## Open questions for the weekly review

1. **Wind direction:** still in the model; Oct 27 proposal to turn it off still waiting. Wind threshold 8 vs 12 mph:
   **re-check now that week 10 is in** (run the backtest with the 12 mph / 1.2% setting on 2026 wk 4–10).
2. **Your book only:** FanDuel on every pick weeks 8–9. The `atMyBook===true` safety fix is still optional.
3. **Duplicates, flips, parlay in the model row:** still miscounted (week 9: 24-21 → 21-20). Re-proposed Nov 10; dedupe by hand until applied.
4. **Teammate out / role reads:** teammate_out 25 picks 15-10; role misreads 9-12 (21 picks). Grade at 50+. "Snap dip" tag still proposed.
5. **Passing yards:** backtest bias −2.6 (settled), but live pass-yds picks are 4-6, all Unders, and week 9 went 0-5.
   Not a bias on all games, so it's selection or variance. Watch to 25 live picks; if still under 45%, test a larger
   `MIN_EDGE_PASSYDS` out of sample (there are no free closing prop lines, so the test needs the logged lines).
6. **Rushing yards:** bias +1.14 (week 9 alone +5.9); live rush Overs 3-6. Re-check at week 10; if the bias stays above +2, look at it.
7. **💰 stale props:** 9-11 on 20 picks (Overs 2-7). Once the ledger keeps the reference book (`sharp`), split SGO-consensus
   vs real sharp references. Watch until 50 picks.
8. **Thin-data picks:** `MIN_PICK_GAMES=2` proposed Nov 10. If applied, confirm no pick shows up without `proj_snap`.

- **🎯 Parlays (2026-10-29):** Sunday 5-leg props parlay at 11:45 AM ET. Legs are treated as independent (one per game). Grade on the legs first (do the legs win at their blended chance?) and on the price: a parlay only pays if each leg's edge beats the book's cut five times over. Under ~50 parlays the W-L is pure luck (a fair 5-leg hits ~5-10%); judge the legs, not the tickets.
