# CFB Lines: weekly review (2026, updated 2026-11-23)

Every pick the bot sent, graded by `cfb-lines/review.js`. Ledger: `cfb/picks.json`. Lessons so far: `cfb-lines/LEARNINGS.md` on main.

- **Bet** = a first-look ✅ spread (the backtest edge is against the opener). **Lean** = our side of every priced game in a card.
- Units assume -110 (CFBD has no prices). Breakeven 52.4%.
- **CLV** = points the closing consensus line moved toward our side (positive = beat the close). It's the early signal: about 50 bets show whether there's an edge, W-L needs hundreds.

## Week 12

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| bets (first-look ✅ spreads) | 21 | 13-7-1 | 65.0% | +4.82u | 33% (7/21) | -0.27 ± 0.31 |
| all first-look leans | 65 | 30-33-2 | 47.6% | -5.73u | 38% (25/65) | -0.05 ± 0.21 |
| update card ✅ | 21 | 11-9-1 | 55.0% | +1.00u | 24% (5/21) | -0.55 ± 0.29 |
| final card ✅ | 23 | 12-11 | 52.2% | -0.09u | 35% (8/23) | -0.14 ± 0.24 |
| gameday card ✅ | 5 | 5-0 | 100.0% | +4.54u | 60% (3/5) | +0.25 ± 0.14 |

## Season to date

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **bets (first-look ✅ spreads)** | 148 | 77-66-5 | 53.8% | +3.99u | 57% (84/148) | +0.52 ± 0.17 |
| all first-look leans | 386 | 177-203-6 | 46.6% | -42.11u | 52% (200/386) | +0.26 ± 0.10 |
| update card ✅ | 84 | 44-38-2 | 53.7% | +2.00u | 48% (40/84) | +0.18 ± 0.15 |
| final card ✅ | 84 | 45-39 | 53.6% | +1.90u | 42% (35/84) | +0.12 ± 0.11 |
| gameday card ✅ | 10 | 9-1 | 90.0% | +7.18u | 50% (5/10) | +0.20 ± 0.25 |
| totals leans, edge 4+ (no ✅: totals are off) | 177 | 93-84 | 52.5% | +0.54u | 63% (111/177) | +0.68 ± 0.14 |

### By model version

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| v1 bets | 148 | 77-66-5 | 53.8% | +3.99u | 57% (84/148) | +0.52 ± 0.17 |
| v1 first-look leans | 386 | 177-203-6 | 46.6% | -42.11u | 52% (200/386) | +0.26 ± 0.10 |

### First-look leans by edge size

The backtest's best sign: the line moving our way should grow with the edge.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| edge 0-2 | 120 | 48-71-1 | 40.3% | -27.37u | 47% (56/120) | -0.01 ± 0.17 |
| edge 2-4 | 116 | 52-64 | 44.8% | -16.73u | 50% (58/116) | +0.16 ± 0.16 |
| edge 4-6 | 80 | 45-31-4 | 59.2% | +9.91u | 53% (42/80) | +0.44 ± 0.21 |
| edge 6-8 | 44 | 18-26 | 40.9% | -9.64u | 57% (25/44) | +0.30 ± 0.34 |
| edge 8+ | 26 | 14-11-1 | 56.0% | +1.73u | 73% (19/26) | +1.30 ± 0.37 |

### Bets by tag (angle tags, first-look ✅ spreads)

Tags are informational: an angle only goes into the model if it beats an out-of-sample backtest (LEARNINGS.md). Compare each row with the no-tags baseline; a CLV gap smaller than about 2 standard errors is noise.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 26 | 14-11-1 | 56.0% | +1.73u | 58% (15/26) | +0.75 ± 0.30 |
| out: 3+ players (ours) | 31 | 16-14-1 | 53.3% | +0.54u | 68% (21/31) | +0.73 ± 0.29 |
| out: 3+ players (theirs) | 30 | 15-13-2 | 53.6% | +0.64u | 63% (19/30) | +0.61 ± 0.29 |
| out: DB (ours) | 23 | 11-11-1 | 50.0% | -1.00u | 61% (14/23) | +0.50 ± 0.34 |
| out: DB (theirs) | 23 | 12-10-1 | 54.5% | +0.91u | 65% (15/23) | +0.72 ± 0.35 |
| out: no report found | 33 | 17-15-1 | 53.1% | +0.45u | 42% (14/33) | -0.26 ± 0.37 |
| out: OL (ours) | 24 | 13-10-1 | 56.5% | +1.82u | 67% (16/24) | +0.81 ± 0.34 |
| out: OL (theirs) | 23 | 11-10-2 | 52.4% | -0.00u | 61% (14/23) | +0.68 ± 0.36 |
| out: QB (ours) | 12 | 4-7-1 | 36.4% | -3.36u | 58% (7/12) | +0.40 ± 0.50 |
| rest: they're off a bye, we aren't | 11 | 6-5 | 54.5% | +0.45u | 73% (8/11) | +0.84 ± 0.46 |
| rest: we're off a bye, they aren't | 13 | 7-5-1 | 58.3% | +1.36u | 54% (7/13) | +0.25 ± 0.63 |
| small home crowd: we're home | 14 | 8-6 | 57.1% | +1.27u | 50% (7/14) | +0.29 ± 0.53 |
| small home crowd: we're the visitor | 32 | 15-17 | 46.9% | -3.37u | 53% (17/32) | +0.43 ± 0.42 |
| travel (1,000+ mi more): helps us | 14 | 8-6 | 57.1% | +1.27u | 64% (9/14) | +1.13 ± 0.49 |
| travel (1,000+ mi more): hurts us | 12 | 4-7-1 | 36.4% | -3.36u | 50% (6/12) | -0.44 ± 0.59 |
| weeknight (Fri) | 15 | 12-3 | 80.0% | +7.91u | 47% (7/15) | +0.82 ± 0.47 |

Rare tags (under 10 graded): altitude climb: helps us (5-2); altitude climb: hurts us (0-4); coming down from altitude: helps us (0-1); coming down from altitude: hurts us (4-2); heat vs home: hurts us (1-0); humidity vs home: helps us (0-1); out: QB (theirs) (3-4-1); rest: they're on a short week (1-2); rest: we're on a short week (2-2); time zones (2+): helps us (6-3); time zones (2+): hurts us (2-3); weather: muggy (dew 68°F+) (5-1); weather: rain (3-2); weather: wind 15+ mph (4-5); weeknight (Thu) (2-5); weeknight (Tue) (3-3); weeknight (Wed) (1-1).

### All first-look leans by tag (bigger sample)

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 55 | 26-27-2 | 49.1% | -3.37u | 49% (27/55) | +0.29 ± 0.21 |
| altitude climb: helps us | 14 | 11-3 | 78.6% | +7.00u | 79% (11/14) | +1.09 ± 0.36 |
| altitude climb: hurts us | 12 | 3-9 | 25.0% | -6.27u | 17% (2/12) | -1.04 ± 0.65 |
| coming down from altitude: helps us | 11 | 5-6 | 45.5% | -1.45u | 45% (5/11) | +0.18 ± 0.71 |
| coming down from altitude: hurts us | 13 | 5-8 | 38.5% | -3.46u | 77% (10/13) | +0.60 ± 0.36 |
| out: 3+ players (ours) | 85 | 39-45-1 | 46.4% | -9.55u | 61% (52/85) | +0.54 ± 0.19 |
| out: 3+ players (theirs) | 88 | 41-45-2 | 47.7% | -7.73u | 57% (50/88) | +0.45 ± 0.18 |
| out: DB (ours) | 67 | 30-36-1 | 45.5% | -8.73u | 60% (40/67) | +0.49 ± 0.22 |
| out: DB (theirs) | 71 | 33-37-1 | 47.1% | -7.00u | 56% (40/71) | +0.49 ± 0.21 |
| out: no report found | 92 | 40-51-1 | 44.0% | -14.64u | 47% (43/92) | -0.22 ± 0.20 |
| out: OL (ours) | 65 | 32-32-1 | 50.0% | -2.91u | 57% (37/65) | +0.51 ± 0.22 |
| out: OL (theirs) | 65 | 29-34-2 | 46.0% | -7.64u | 62% (40/65) | +0.60 ± 0.23 |
| out: QB (ours) | 27 | 9-17-1 | 34.6% | -8.82u | 44% (12/27) | +0.05 ± 0.41 |
| out: QB (theirs) | 18 | 8-9-1 | 47.1% | -1.73u | 89% (16/18) | +1.46 ± 0.35 |
| rest: they're off a bye, we aren't | 35 | 12-23 | 34.3% | -12.09u | 57% (20/35) | +0.31 ± 0.33 |
| rest: we're off a bye, they aren't | 27 | 10-16-1 | 38.5% | -6.91u | 41% (11/27) | -0.05 ± 0.34 |
| rest: we're on a short week | 10 | 2-8 | 20.0% | -6.18u | 70% (7/10) | +1.10 ± 0.46 |
| small home crowd: we're home | 52 | 27-25 | 51.9% | -0.46u | 50% (26/52) | +0.34 ± 0.24 |
| small home crowd: we're the visitor | 75 | 31-44 | 41.3% | -15.82u | 53% (40/75) | +0.23 ± 0.23 |
| time zones (2+): helps us | 31 | 15-16 | 48.4% | -2.37u | 58% (18/31) | +0.74 ± 0.28 |
| time zones (2+): hurts us | 25 | 10-15 | 40.0% | -5.91u | 48% (12/25) | +0.11 ± 0.46 |
| travel (1,000+ mi more): helps us | 48 | 21-27 | 43.8% | -7.91u | 56% (27/48) | +0.68 ± 0.26 |
| travel (1,000+ mi more): hurts us | 46 | 17-28-1 | 37.8% | -12.55u | 48% (22/46) | +0.09 ± 0.32 |
| weather: muggy (dew 68°F+) | 18 | 12-6 | 66.7% | +4.91u | 56% (10/18) | +0.96 ± 0.39 |
| weather: rain | 12 | 6-6 | 50.0% | -0.55u | 75% (9/12) | +1.13 ± 0.66 |
| weather: wind 15+ mph | 26 | 14-12 | 53.8% | +0.73u | 62% (16/26) | +0.82 ± 0.37 |
| weeknight (Fri) | 58 | 29-29 | 50.0% | -2.64u | 55% (32/58) | +0.53 ± 0.24 |
| weeknight (Thu) | 17 | 4-13 | 23.5% | -9.36u | 59% (10/17) | +0.74 ± 0.45 |
| weeknight (Tue) | 13 | 8-5 | 61.5% | +2.27u | 62% (8/13) | +0.37 ± 0.44 |
| weeknight (Wed) | 12 | 5-7 | 41.7% | -2.46u | 50% (6/12) | +0.13 ± 0.47 |

Rare tags (under 10 graded): heat vs home: helps us (1-2); heat vs home: hurts us (1-0); humidity vs home: helps us (2-2); humidity vs home: hurts us (2-2); neutral site (1-1); rest: they're on a short week (2-7); weather: cold (<35°F) (0-1); weather: hot (88°F+) (0-3).

### Bets by situation

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| we're home | 70 | 36-32-2 | 52.9% | +0.72u | 59% (41/70) | +0.73 ± 0.20 |
| we're the visitor | 78 | 41-34-3 | 54.7% | +3.27u | 55% (43/78) | +0.34 ± 0.26 |
| favorite | 29 | 12-17 | 41.4% | -6.09u | 55% (16/29) | +0.51 ± 0.32 |
| underdog | 119 | 65-49-5 | 57.0% | +10.08u | 57% (68/119) | +0.53 ± 0.19 |
| line under 7 | 61 | 35-23-3 | 60.3% | +8.82u | 67% (41/61) | +0.94 ± 0.22 |
| line 7-13.5 | 44 | 21-22-1 | 48.8% | -2.91u | 55% (24/44) | +0.23 ± 0.33 |
| line 14+ | 43 | 21-21-1 | 50.0% | -1.91u | 44% (19/43) | +0.23 ± 0.32 |
| conference game | 141 | 72-64-5 | 52.9% | +1.45u | 57% (80/141) | +0.48 ± 0.17 |
| non-conference | 7 | 5-2 | 71.4% | +2.55u | 57% (4/7) | +1.29 ± 0.78 |

### By week (bets)

| week | W-L-P | units | beat the close | avg CLV | leans beat the close |
|---|---|---|---|---|---|
| 5 | 11-7 | +3.00u | 50% | +0.40 ± 0.51 | 43% |
| 6 | 6-6-1 | -0.55u | 62% | +0.63 ± 0.71 | 56% |
| 7 | 13-14-1 | -2.18u | 57% | +0.68 ± 0.33 | 49% |
| 8 | 12-10 | +0.91u | 68% | +1.19 ± 0.47 | 60% |
| 9 | 0-0 | +0.00u | - | - | - |
| 10 | 12-11-1 | -0.09u | 67% | +0.77 ± 0.37 | 56% |
| 11 | 10-11-1 | -1.91u | 59% | +0.17 ± 0.49 | 62% |
| 12 | 13-7-1 | +4.82u | 33% | -0.27 ± 0.31 | 38% |

## Week 12 bets

- W ECU @ ARMY: ECU +5.5 (edge 11.7), final ECU 10-6 ARMY, CLV +1 [rest: they're off a bye, we aren't, out: no report found]
- W CSU @ FRES: CSU +21 (edge 11.6), final CSU 42-49 FRES, CLV +0.5 [coming down from altitude: hurts us, out: no report found]
- L UTEP @ AF: UTEP +22.5 (edge 10.1), final UTEP 3-52 AF, CLV -0.5 [altitude climb: hurts us, out: no report found, weeknight (Fri)]
- W UCLA @ MICH: MICH +5.5 (edge 9.8), final UCLA 16-18 MICH, CLV +2 [travel (1,000+ mi more): helps us, time zones (2+): helps us, out: OL (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: 3+ players (theirs)]
- W ODU @ CONN: ODU +14 (edge 8.6), final ODU 21-29 CONN, CLV +0 [rest: we're off a bye, they aren't]
- W NIU @ NDSU: NIU +24.5 (edge 8.4), final NIU 25-31 NDSU, CLV -0.75 [small home crowd: we're the visitor, out: no report found]
- W RUTG @ PSU: RUTG +24.5 (edge 7.5), final RUTG 25-24 PSU, CLV -0.25 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- L WKU @ LIB: WKU +16.5 (edge 7), final WKU 14-45 LIB, CLV -1.75 [small home crowd: we're the visitor, out: no report found]
- L OSU @ NEB: OSU -2.5 (edge 6.4), final OSU 28-31 NEB, CLV +1 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs)]
- W EMU @ WMU: EMU +14.5 (edge 6.2), final EMU 27-34 WMU, CLV -3.5 [rest: we're off a bye, they aren't, small home crowd: we're the visitor, out: no report found, weeknight (Tue)]
- L STAN @ CAL: CAL +2.5 (edge 5.8), final STAN 44-28 CAL, CLV +0 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W ARIZ @ KSU: KSU +9.5 (edge 5.5), final ARIZ 35-28 KSU, CLV -0.5 [out: QB (ours), out: OL (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- L UGA @ SC: SC +16.5 (edge 5.5), final UGA 34-6 SC, CLV +1 [weather: rain, out: OL (ours), out: DB (ours), out: 3+ players (ours)]
- P OKST @ ASU: ASU +3 (edge 5.4), final OKST 30-27 ASU, CLV -0.25 [out: OL (theirs), out: 3+ players (theirs)]
- W WAKE @ GT: GT +21.5 (edge 4.7), final WAKE 50-29 GT, CLV -0.75 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- W MTSU @ SHSU: SHSU +6.5 (edge 4.7), final MTSU 31-28 SHSU, CLV +0.5 [small home crowd: we're home, out: no report found]
- W CLEM @ DUKE: CLEM +11.5 (edge 4.6), final CLEM 20-10 DUKE, CLV +0 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- L COLO @ CIN: COLO +3.5 (edge 4.4), final COLO 28-35 CIN, CLV +0.5 [coming down from altitude: hurts us, travel (1,000+ mi more): hurts us, time zones (2+): hurts us, out: DB (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs)]
- L ARST @ LT: ARST +14.5 (edge 4.4), final ARST 3-48 LT, CLV +0 [small home crowd: we're the visitor, out: no report found]
- W USA @ USM: USM +5.5 (edge 4.3), final USA 40-35 USM, CLV +0 [out: no report found]
- W SDSU @ BOIS: SDSU +16.5 (edge 4), final SDSU 22-20 BOIS, CLV -4 [out: no report found]

Weeks with "seeded" picks were rebuilt from run logs (our number rounded to 0.5, no availability or kickoff-weather fields).
