# nfl-lines: what we've learned

Read this before changing the model, adding a tag or testing an angle, so nothing gets re-tested or forgotten.
The weekly review (scheduled task `nfl-bots-weekly-review`) updates it every Tuesday.

## The rule

An angle goes **into the model** only if it beats an **out-of-sample** backtest: tuned on one stretch, then tested on
games it never saw (e.g. fit 1999–2012, hold out 2013–2025; or fit through 2025, hold out 2026). Otherwise it can be
an informational ⚠️ tag at most. Tags never change the numbers or flag a ✅.

Grade game lines on **closing-line value** first: did the close move toward the pick? CLV shows an edge, or the lack
of one, in about 50 picks. Win-loss needs hundreds.

## Model versions

Logged as `ctx.model_version` on every pick since Oct 25, 2026 (`nfl-props/context.js`).

| Version | Date | What changed |
|---|---|---|
| (before versioning) | Sep 26 – Oct 24, 2026 | Port of nfl-edge-finder's rating model; ✅ edges on |
| `lines-2026.10.24` | Oct 24, 2026 | ✅ model edges OFF (`MODEL_EDGES=0`); game-day window 80→10 min |

## The rating model (margin-based power ratings, nfl-edge-finder port)

| Test | Result | Status |
|---|---|---|
| Backtest vs closing lines 2023/2024/2025 wk 4–18 | Spread 3+ pts off: 48.9% / 54.4% / 50.4% (about 51% overall; break-even 52.4%). ML: −6% / +0.4% / +19.6% ROI. Totals 4+ off: 42% / 32% / 47% | No edge |
| `RATING=srs` (schedule-adjusted) | 50.0% / 51.3% / 50.8% | Rejected |
| Live 2026 ✅ picks | Spreads 9-11-1, ML 12-11-1 (−4.2u). The close moved against 21 of 24 ML picks | ✅ **off since Oct 24**; numbers shown as info only |
| Totals model | Runs about a point above the market every season; big "overs" miss | Totals edges off |
| Re-check Oct 27: 2026 wk 4–7 | Spread 3+ pts off 14-23-2 (37.8%), every game 24-32-3, ML 6+ pts 18-22-1, totals 26-33. Model margin error 11.2 vs closing spread 8.6 | Confirms ✅ off |

## Situational angles (research scripts in `research/`, vs. closing lines)

| Angle | Result | Out of sample? | Status |
|---|---|---|---|
| Altitude: visitors at Denver | Denver's home edge is real (+1.4 pts) but priced in: visitors cover 52.3% (230 games) | — | Rejected |
| Coming down from altitude; week after Denver | 48.6% / 50.6% | — | Rejected |
| Dry-climate teams in humidity | Only DEN/LV qualify, 22 games | — | Too few to test |
| Warm/dome visitor outdoors Dec–Jan | 45.6% ATS (668 games). 1999–2011: 43.2%; **2012–2025: 47.6% (about break-even to fade)** | Era split: fading in the recent era | ⚠️ tag only |
| Freezing temperature beyond time of year; cold or muggy totals | Nothing | — | Rejected |
| Division underdogs / primetime / Thursday | 52.1% / ~50% / nothing; primetime unders 53.5% since 2012 but overs before | Era-inconsistent | Rejected |
| Team or QB records in division or primetime games | First-half vs second-half correlation ≈ 0 (0.03, −0.04, 0.02) | Yes (split-half) | Rejected |
| Defense missing a starting CB | Offenses 54.2% ATS in 2020–25 (650 games) but 48.1% in 2013–19. **2026: 11-15 (42%)** as of week 7 | Fails on 2013–19 and on 2026 so far | ⚠️ tag only; **candidate to drop** (26 games: one more bad stretch and it goes) |
| Offense missing 2+ starting O-linemen | Covered 43.9% (364): 45.2% in 2013–19, 42.9% in 2020–25; −9 pass yds, +0.2 sacks. **2026: 2-6** | Holds in both eras and in 2026 (**2-7** as of week 7) | ⚠️ tag. Strongest angle; candidate for the model only with a proper fit/holdout test |
| Defense missing a DL/LB vs a run-heavy offense | Offense +8 rush yds, +1.4 pts over the implied team total (507 games), 49.3% ATS. 2026: 5-6 ATS | Era split not checked for the team-total effect | ⚠️ tag (team-total angle) |
| Single missing O-lineman, safety, WR, TE or RB; DL alone | Small or era-inconsistent | — | Rejected |
| Wind (`research/wind-direction.js`): unders at 12+ mph | 55–58% unders; **crosswind 16+ 64.1% (66 games)** | ⚠️ Measured on actual wind (ERA5), not the forecast: partly hindsight | ⚠️ tag |
| 💰 Stale prices vs Pinnacle's no-vig price | Live 2026: 3 lines picks, 2 beat the close | Not enough picks | Kept: the sound idea |

## Open questions for the weekly review

1. **Tags by side:** no tagged pick has `ctx` yet (logging began after week 7's games). Grade "on the tagged team /
   against it" separately once there are 30+ tagged picks.
2. **Missing-CB tag:** 11-15 in 2026. Drop it if it is still below 50% at 40 games.
3. **O-line tag:** 2-7 in 2026. The fit-early/test-late margin test only matters if the rating model comes back; it's off,
   so this stays a tag.
4. **💰 stale prices:** still 3 picks (2 beat the close); week 7 found none (odds were pulled for each slot, nothing
   cleared the bar). At this rate 50 picks takes more than a season: consider whether `MIN_EV` is too strict, but
   only with closing-line evidence.
5. **Delivery:** week 7 7/7 slots, alerts landed 80 min before kickoff. Note the Tuesday review cron did not fire on
   Oct 27 (started by hand at 11:43 AM ET).
