# CFB Lines: weekly review (2026, updated 2026-11-09)

Every pick the bot sent, graded by `cfb-lines/review.js`. Ledger: `cfb/picks.json`. Lessons so far: `cfb-lines/LEARNINGS.md` on main.

- **Bet** = a first-look ✅ spread (the backtest edge is against the opener). **Lean** = our side of every priced game in a card.
- Units assume -110 (CFBD has no prices). Breakeven 52.4%.
- **CLV** = points the closing consensus line moved toward our side (positive = beat the close). It's the early signal: about 50 bets show whether there's an edge, W-L needs hundreds.

## Week 10

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| bets (first-look ✅ spreads) | 24 | 12-11-1 | 52.2% | -0.09u | 67% (16/24) | +0.77 ± 0.37 |
| all first-look leans | 61 | 29-31-1 | 48.3% | -4.64u | 56% (34/61) | +0.33 ± 0.21 |
| update card ✅ | 19 | 11-8 | 57.9% | +2.00u | 53% (10/19) | +0.62 ± 0.31 |
| final card ✅ | 21 | 10-11 | 47.6% | -1.91u | 38% (8/21) | +0.15 ± 0.13 |

## Season to date

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **bets (first-look ✅ spreads)** | 105 | 54-48-3 | 52.9% | +1.09u | 61% (64/105) | +0.75 ± 0.20 |
| all first-look leans | 255 | 120-132-3 | 47.6% | -22.92u | 53% (134/255) | +0.35 ± 0.12 |
| update card ✅ | 41 | 24-17 | 58.5% | +4.82u | 56% (23/41) | +0.61 ± 0.20 |
| final card ✅ | 44 | 24-20 | 54.5% | +1.82u | 48% (21/44) | +0.38 ± 0.14 |
| gameday card ✅ | 2 | 1-1 | 50.0% | -0.09u | 50% (1/2) | +1.00 ± 1.00 |
| totals leans, edge 4+ (no ✅: totals are off) | 120 | 64-56 | 53.3% | +2.18u | 66% (79/120) | +0.80 ± 0.19 |

### By model version

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| v1 bets | 105 | 54-48-3 | 52.9% | +1.09u | 61% (64/105) | +0.75 ± 0.20 |
| v1 first-look leans | 255 | 120-132-3 | 47.6% | -22.92u | 53% (134/255) | +0.35 ± 0.12 |

### First-look leans by edge size

The backtest's best sign: the line moving our way should grow with the edge.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| edge 0-2 | 75 | 31-44 | 41.3% | -15.82u | 44% (33/75) | -0.08 ± 0.21 |
| edge 2-4 | 73 | 35-38 | 47.9% | -6.19u | 48% (35/73) | +0.16 ± 0.18 |
| edge 4-6 | 57 | 34-21-2 | 61.8% | +9.91u | 56% (32/57) | +0.66 ± 0.26 |
| edge 6-8 | 32 | 11-21 | 34.4% | -11.00u | 63% (20/32) | +0.61 ± 0.36 |
| edge 8+ | 18 | 9-8-1 | 52.9% | +0.18u | 78% (14/18) | +1.51 ± 0.49 |

### Bets by tag (angle tags, first-look ✅ spreads)

Tags are informational: an angle only goes into the model if it beats an out-of-sample backtest (LEARNINGS.md). Compare each row with the no-tags baseline; a CLV gap smaller than about 2 standard errors is noise.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 26 | 14-11-1 | 56.0% | +1.73u | 58% (15/26) | +0.75 ± 0.30 |
| out: 3+ players (ours) | 11 | 4-7 | 36.4% | -3.36u | 82% (9/11) | +0.91 ± 0.57 |
| out: 3+ players (theirs) | 11 | 4-7 | 36.4% | -3.36u | 82% (9/11) | +0.91 ± 0.57 |
| out: no report found | 12 | 7-4-1 | 63.6% | +2.36u | 50% (6/12) | +0.48 ± 0.51 |
| rest: we're off a bye, they aren't | 11 | 5-5-1 | 50.0% | -0.45u | 64% (7/11) | +0.61 ± 0.65 |
| small home crowd: we're home | 12 | 7-5 | 58.3% | +1.36u | 50% (6/12) | +0.35 ± 0.61 |
| small home crowd: we're the visitor | 22 | 11-11 | 50.0% | -1.00u | 64% (14/22) | +0.75 ± 0.57 |
| travel (1,000+ mi more): helps us | 13 | 7-6 | 53.8% | +0.36u | 62% (8/13) | +1.06 ± 0.52 |
| travel (1,000+ mi more): hurts us | 10 | 4-5-1 | 44.4% | -1.36u | 40% (4/10) | -0.70 ± 0.68 |

Rare tags (under 10 graded): altitude climb: helps us (4-2); altitude climb: hurts us (0-2); coming down from altitude: hurts us (3-1); heat vs home: hurts us (1-0); out: DB (ours) (3-5); out: DB (theirs) (4-5); out: OL (ours) (4-5); out: OL (theirs) (1-6); out: QB (ours) (0-4); out: QB (theirs) (1-3); rest: they're off a bye, we aren't (5-4); rest: they're on a short week (1-2); rest: we're on a short week (2-2); time zones (2+): helps us (5-3); time zones (2+): hurts us (2-1); weather: muggy (dew 68°F+) (5-1); weather: rain (3-1); weather: wind 15+ mph (4-5); weeknight (Fri) (5-1); weeknight (Thu) (2-4); weeknight (Tue) (1-2); weeknight (Wed) (1-0).

### All first-look leans by tag (bigger sample)

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 52 | 25-26-1 | 49.0% | -3.28u | 50% (26/52) | +0.30 ± 0.22 |
| altitude climb: helps us | 11 | 9-2 | 81.8% | +6.18u | 73% (8/11) | +0.89 ± 0.42 |
| out: 3+ players (ours) | 27 | 10-17 | 37.0% | -7.91u | 63% (17/27) | +0.67 ± 0.26 |
| out: 3+ players (theirs) | 28 | 10-18 | 35.7% | -8.91u | 57% (16/28) | +0.54 ± 0.26 |
| out: DB (ours) | 21 | 8-13 | 38.1% | -5.73u | 62% (13/21) | +0.67 ± 0.33 |
| out: DB (theirs) | 23 | 8-15 | 34.8% | -7.73u | 61% (14/23) | +0.65 ± 0.29 |
| out: no report found | 29 | 17-11-1 | 60.7% | +4.45u | 52% (15/29) | +0.01 ± 0.36 |
| out: OL (ours) | 21 | 8-13 | 38.1% | -5.73u | 67% (14/21) | +0.76 ± 0.32 |
| out: OL (theirs) | 18 | 4-14 | 22.2% | -10.36u | 67% (12/18) | +0.64 ± 0.37 |
| rest: they're off a bye, we aren't | 28 | 10-18 | 35.7% | -8.91u | 54% (15/28) | +0.22 ± 0.40 |
| rest: we're off a bye, they aren't | 24 | 7-16-1 | 30.4% | -9.64u | 46% (11/24) | +0.11 ± 0.35 |
| small home crowd: we're home | 38 | 23-15 | 60.5% | +5.91u | 47% (18/38) | +0.30 ± 0.31 |
| small home crowd: we're the visitor | 47 | 22-25 | 46.8% | -5.00u | 57% (27/47) | +0.37 ± 0.33 |
| time zones (2+): helps us | 19 | 11-8 | 57.9% | +2.00u | 47% (9/19) | +0.64 ± 0.37 |
| time zones (2+): hurts us | 18 | 8-10 | 44.4% | -2.73u | 44% (8/18) | -0.01 ± 0.52 |
| travel (1,000+ mi more): helps us | 32 | 16-16 | 50.0% | -1.46u | 53% (17/32) | +0.81 ± 0.32 |
| travel (1,000+ mi more): hurts us | 34 | 14-19-1 | 42.4% | -6.27u | 47% (16/34) | +0.07 ± 0.35 |
| weather: muggy (dew 68°F+) | 14 | 10-4 | 71.4% | +5.09u | 64% (9/14) | +1.30 ± 0.45 |
| weather: rain | 10 | 6-4 | 60.0% | +1.45u | 70% (7/10) | +1.15 ± 0.80 |
| weather: wind 15+ mph | 23 | 13-10 | 56.5% | +1.82u | 57% (13/23) | +0.78 ± 0.41 |
| weeknight (Fri) | 26 | 12-14 | 46.2% | -3.09u | 46% (12/26) | +0.31 ± 0.33 |
| weeknight (Thu) | 14 | 4-10 | 28.6% | -6.36u | 57% (8/14) | +0.79 ± 0.54 |

Rare tags (under 10 graded): altitude climb: hurts us (2-5); coming down from altitude: helps us (3-2); coming down from altitude: hurts us (4-4); heat vs home: helps us (1-2); heat vs home: hurts us (1-0); humidity vs home: helps us (1-0); humidity vs home: hurts us (1-0); neutral site (1-1); out: QB (ours) (0-5); out: QB (theirs) (2-7); rest: they're on a short week (2-5); rest: we're on a short week (2-6); weather: hot (88°F+) (0-3); weeknight (Tue) (4-3); weeknight (Wed) (5-2).

### Bets by situation

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| we're home | 52 | 28-24 | 53.8% | +1.45u | 58% (30/52) | +0.71 ± 0.24 |
| we're the visitor | 53 | 26-24-3 | 52.0% | -0.37u | 64% (34/53) | +0.80 ± 0.31 |
| favorite | 26 | 12-14 | 46.2% | -3.09u | 50% (13/26) | +0.39 ± 0.34 |
| underdog | 79 | 42-34-3 | 55.3% | +4.18u | 65% (51/79) | +0.87 ± 0.24 |
| line under 7 | 44 | 27-16-1 | 62.8% | +8.54u | 66% (29/44) | +1.07 ± 0.30 |
| line 7-13.5 | 34 | 15-18-1 | 45.5% | -4.37u | 59% (20/34) | +0.46 ± 0.32 |
| line 14+ | 27 | 12-14-1 | 46.2% | -3.09u | 56% (15/27) | +0.61 ± 0.43 |
| conference game | 99 | 50-46-3 | 52.1% | -0.55u | 61% (60/99) | +0.71 ± 0.20 |
| non-conference | 6 | 4-2 | 66.7% | +1.64u | 67% (4/6) | +1.50 ± 0.89 |

### By week (bets)

| week | W-L-P | units | beat the close | avg CLV | leans beat the close |
|---|---|---|---|---|---|
| 5 | 11-7 | +3.00u | 50% | +0.40 ± 0.51 | 43% |
| 6 | 6-6-1 | -0.55u | 62% | +0.63 ± 0.71 | 56% |
| 7 | 13-14-1 | -2.18u | 57% | +0.68 ± 0.33 | 49% |
| 8 | 12-10 | +0.91u | 68% | +1.19 ± 0.47 | 60% |
| 9 | 0-0 | +0.00u | - | - | - |
| 10 | 12-11-1 | -0.09u | 67% | +0.77 ± 0.37 | 56% |

## Week 10 bets

- W ODU @ CCU: ODU +7.5 (edge 9.7), final ODU 21-8 CCU, CLV +1 [small home crowd: we're the visitor, out: no report found]
- L OKST @ KSU: KSU +6 (edge 7.7), final OKST 66-28 KSU, CLV -1 [out: QB (ours), out: DB (ours), out: 3+ players (ours), out: 3+ players (theirs)]
- L DUKE @ NCSU: NCSU +6 (edge 7.6), final DUKE 41-3 NCSU, CLV +1.5 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- L ORE @ OSU: OSU -7 (edge 7.5), final ORE 41-28 OSU, CLV +0.75 [travel (1,000+ mi more): helps us, time zones (2+): helps us, out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W TOL @ SAC: SAC +25.5 (edge 7.4), final TOL 20-17 SAC, CLV +0 [rest: we're on a short week, travel (1,000+ mi more): helps us, time zones (2+): helps us, small home crowd: we're home, out: no report found, weeknight (Wed)]
- L BOIS @ CSU: CSU +18.5 (edge 7.3), final BOIS 64-38 CSU, CLV +2.25 [altitude climb: helps us, out: no report found]
- L TA&M @ SC: TA&M +7 (edge 7.2), final TA&M 9-17 SC, CLV +0.25 [rest: we're off a bye, they aren't, out: OL (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W IOWA @ NU: IOWA +1.5 (edge 6.6), final IOWA 24-10 NU, CLV +4.25 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- L SHSU @ JXST: SHSU +15.5 (edge 6.5), final SHSU 14-47 JXST, CLV -1.5 [small home crowd: we're the visitor, out: no report found]
- W UK @ TENN: TENN -5.5 (edge 6.3), final UK 6-34 TENN, CLV +0.75 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs)]
- W HAW @ UTEP: UTEP +9.5 (edge 6.3), final HAW 17-14 UTEP, CLV +2 [rest: they're off a bye, we aren't, travel (1,000+ mi more): helps us, time zones (2+): helps us, out: no report found]
- W MIA @ ND: ND -4.5 (edge 5.7), final MIA 24-31 ND, CLV +2.75 [travel (1,000+ mi more): helps us]
- L WKU @ MTSU: WKU +1.5 (edge 5.4), final WKU 42-51 MTSU, CLV +3.5 [small home crowd: we're the visitor, out: no report found]
- L BUF @ M-OH: M-OH -6.5 (edge 5.3), final BUF 34-31 M-OH, CLV +0 [small home crowd: we're home, out: no report found, weeknight (Tue)]
- L UCF @ KU: KU -3 (edge 5.3), final UCF 33-32 KU, CLV +1.75 [travel (1,000+ mi more): helps us, out: OL (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W TCU @ ARIZ: TCU +9.5 (edge 5.2), final TCU 28-29 ARIZ, CLV +2.75 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- W GAST @ APP: GAST +3.5 (edge 5.1), final GAST 39-23 APP, CLV -3 [small home crowd: we're the visitor, out: no report found]
- W MD @ PUR: MD +6.5 (edge 5), final MD 34-29 PUR, CLV +1.5 [out: OL (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs)]
- W DEL @ KENN: KENN +2.5 (edge 4.9), final DEL 40-42 KENN, CLV +1.25 [small home crowd: we're home, out: no report found]
- W MOST @ FIU: MOST +4.5 (edge 4.7), final MOST 20-23 FIU, CLV -0.25 [heat vs home: hurts us, travel (1,000+ mi more): hurts us, small home crowd: we're the visitor, weather: muggy (dew 68°F+), out: no report found]
- W LIB @ NMSU: NMSU +16.5 (edge 4.7), final LIB 30-14 NMSU, CLV +1.25 [altitude climb: helps us, travel (1,000+ mi more): helps us, time zones (2+): helps us, small home crowd: we're home, out: no report found]
- P TEM @ NAVY: TEM +7 (edge 4.5), final TEM 35-42 NAVY, CLV -0.75 [out: no report found]
- L VAN @ MSST: MSST -2.5 (edge 4.1), final VAN 25-23 MSST, CLV +0.5 [rest: they're off a bye, we aren't, out: QB (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: 3+ players (theirs)]
- L RUTG @ WIS: RUTG +16.5 (edge 4), final RUTG 10-31 WIS, CLV -3 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]

Weeks with "seeded" picks were rebuilt from run logs (our number rounded to 0.5, no availability or kickoff-weather fields).
