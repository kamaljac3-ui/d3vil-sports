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
| Wind threshold 8 mph, 0.9%/mph (was 12 mph, 1.2%/mph) | 2025 backtest with recorded wind | Slightly better on every stat | ⚠️ Fit and tested on 2025 only; check on 2026 | **In model**: needs out-of-sample check |
| Wind direction multiplier (crosswind 1.3×, along-field 0.8× at 12+ mph) | `nfl-lines/research/wind-direction.js`, 1999–2025 passing yards | Crosswind −43 vs along −26 combined pass yds at 12+ mph (~2 SE) | ❌ **Not backtested in the props model** (history has no direction) | **In model: breaks the rule.** Downgrade to a tag unless a backtest with ERA5 direction supports it |
| Man/zone coverage split (2025 participation) | Built in | Effects are tiny (mz ≈ 1.00) | — | In model; contributes almost nothing |
| Defense missing a starting CB → opposing top WR/TE | `nfl-lines/research/cb-replacement.js` | +2 yds over baseline, noise | — | **Rejected** for props |
| A CB who got torched the last 2 games | 2023–25 proxy (PBU/tackler) | Regresses almost fully next game (58.5 → 28.3 vs 26.0 average) | — | **Rejected** |

## Live record (graded by `nfl-lines/grade.js`, ledger `bot-results:nfl/`)

As of Oct 24, 2026, model picks vs a real FanDuel line went 23-20 (−0.66u). Unders 20-15, overs 3-5. 💰 stale props 1-3.
Note that picks before Oct 24 were priced at the best book pulled, sometimes a sharp book, so those prices are not FanDuel's.

## Open questions for the weekly review

1. **Wind:** does the 8 mph threshold hold on 2026 games? Is the direction multiplier justified? Backtest it with ERA5
   wind direction (the archive cache in `nfl-lines/research/.cache`), or downgrade it.
2. **Overs vs unders:** is the under lean real, or produced by the lognormal median plus calibration? Check calibration
   by side.
3. **Teammate out:** with `teammate_out` now logged, do bumped players beat the line more than the no-tag baseline?
   Wait for 50+ picks.
4. **Role reads:** projected vs actual snap share (in SUMMARY.md). Are misreads concentrated on returning or new players?
5. **Passing yards:** still under-projected? Is it QB-specific (new starters) or league-wide?
