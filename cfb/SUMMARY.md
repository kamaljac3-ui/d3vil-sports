# CFB Lines: weekly review (2026, updated 2026-11-16)

Every pick the bot sent, graded by `cfb-lines/review.js`. Ledger: `cfb/picks.json`. Lessons so far: `cfb-lines/LEARNINGS.md` on main.

- **Bet** = a first-look ✅ spread (the backtest edge is against the opener). **Lean** = our side of every priced game in a card.
- Units assume -110 (CFBD has no prices). Breakeven 52.4%.
- **CLV** = points the closing consensus line moved toward our side (positive = beat the close). It's the early signal: about 50 bets show whether there's an edge, W-L needs hundreds.

## Week 11

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| bets (first-look ✅ spreads) | 22 | 10-11-1 | 47.6% | -1.91u | 59% (13/22) | +0.17 ± 0.49 |
| all first-look leans | 66 | 27-38-1 | 41.5% | -13.46u | 62% (41/66) | +0.19 ± 0.26 |
| update card ✅ | 22 | 9-12-1 | 42.9% | -3.82u | 55% (12/22) | +0.09 ± 0.32 |
| final card ✅ | 17 | 9-8 | 52.9% | +0.18u | 35% (6/17) | -0.22 ± 0.24 |
| gameday card ✅ | 3 | 3-0 | 100.0% | +2.73u | 33% (1/3) | -0.42 ± 0.36 |

## Season to date

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **bets (first-look ✅ spreads)** | 127 | 64-59-4 | 52.0% | -0.82u | 61% (77/127) | +0.65 ± 0.18 |
| all first-look leans | 321 | 147-170-4 | 46.4% | -36.38u | 55% (175/321) | +0.32 ± 0.11 |
| update card ✅ | 63 | 33-29-1 | 53.2% | +1.00u | 56% (35/63) | +0.43 ± 0.17 |
| final card ✅ | 61 | 33-28 | 54.1% | +2.00u | 44% (27/61) | +0.21 ± 0.13 |
| gameday card ✅ | 5 | 4-1 | 80.0% | +2.64u | 40% (2/5) | +0.15 ± 0.51 |
| totals leans, edge 4+ (no ✅: totals are off) | 151 | 77-74 | 51.0% | -4.01u | 65% (98/151) | +0.74 ± 0.16 |

### By model version

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| v1 bets | 127 | 64-59-4 | 52.0% | -0.82u | 61% (77/127) | +0.65 ± 0.18 |
| v1 first-look leans | 321 | 147-170-4 | 46.4% | -36.38u | 55% (175/321) | +0.32 ± 0.11 |

### First-look leans by edge size

The backtest's best sign: the line moving our way should grow with the edge.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| edge 0-2 | 94 | 38-56 | 40.4% | -21.46u | 48% (45/94) | -0.03 ± 0.18 |
| edge 2-4 | 98 | 45-53 | 45.9% | -12.10u | 52% (51/98) | +0.18 ± 0.17 |
| edge 4-6 | 69 | 39-27-3 | 59.1% | +8.45u | 57% (39/69) | +0.56 ± 0.23 |
| edge 6-8 | 40 | 16-24 | 40.0% | -9.46u | 60% (24/40) | +0.44 ± 0.36 |
| edge 8+ | 20 | 9-10-1 | 47.4% | -1.82u | 80% (16/20) | +1.57 ± 0.45 |

### Bets by tag (angle tags, first-look ✅ spreads)

Tags are informational: an angle only goes into the model if it beats an out-of-sample backtest (LEARNINGS.md). Compare each row with the no-tags baseline; a CLV gap smaller than about 2 standard errors is noise.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 26 | 14-11-1 | 56.0% | +1.73u | 58% (15/26) | +0.75 ± 0.30 |
| out: 3+ players (ours) | 22 | 11-10-1 | 52.4% | -0.00u | 77% (17/22) | +0.89 ± 0.38 |
| out: 3+ players (theirs) | 21 | 10-10-1 | 50.0% | -0.91u | 76% (16/21) | +0.79 ± 0.39 |
| out: DB (ours) | 16 | 8-7-1 | 53.3% | +0.27u | 69% (11/16) | +0.63 ± 0.49 |
| out: DB (theirs) | 16 | 8-7-1 | 53.3% | +0.27u | 81% (13/16) | +1.03 ± 0.48 |
| out: no report found | 23 | 10-12-1 | 45.5% | -2.91u | 48% (11/23) | +0.00 ± 0.46 |
| out: OL (ours) | 16 | 8-7-1 | 53.3% | +0.27u | 81% (13/16) | +1.06 ± 0.48 |
| out: OL (theirs) | 17 | 7-9-1 | 43.8% | -2.64u | 76% (13/17) | +0.88 ± 0.47 |
| rest: they're off a bye, we aren't | 10 | 5-5 | 50.0% | -0.45u | 70% (7/10) | +0.82 ± 0.51 |
| rest: we're off a bye, they aren't | 11 | 5-5-1 | 50.0% | -0.45u | 64% (7/11) | +0.61 ± 0.65 |
| small home crowd: we're home | 13 | 7-6 | 53.8% | +0.36u | 46% (6/13) | +0.27 ± 0.57 |
| small home crowd: we're the visitor | 28 | 13-15 | 46.4% | -3.18u | 61% (17/28) | +0.71 ± 0.45 |
| travel (1,000+ mi more): helps us | 13 | 7-6 | 53.8% | +0.36u | 62% (8/13) | +1.06 ± 0.52 |
| travel (1,000+ mi more): hurts us | 11 | 4-6-1 | 40.0% | -2.36u | 45% (5/11) | -0.52 ± 0.64 |
| weeknight (Fri) | 11 | 9-2 | 81.8% | +6.18u | 64% (7/11) | +1.27 ± 0.58 |

Rare tags (under 10 graded): altitude climb: helps us (5-2); altitude climb: hurts us (0-3); coming down from altitude: helps us (0-1); coming down from altitude: hurts us (3-1); heat vs home: hurts us (1-0); humidity vs home: helps us (0-1); out: QB (ours) (1-6-1); out: QB (theirs) (1-4-1); rest: they're on a short week (1-2); rest: we're on a short week (2-2); time zones (2+): helps us (5-3); time zones (2+): hurts us (2-2); weather: muggy (dew 68°F+) (5-1); weather: rain (3-1); weather: wind 15+ mph (4-5); weeknight (Thu) (2-5); weeknight (Tue) (2-3); weeknight (Wed) (1-1).

### All first-look leans by tag (bigger sample)

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 54 | 26-27-1 | 49.1% | -3.37u | 50% (27/54) | +0.30 ± 0.21 |
| altitude climb: helps us | 13 | 11-2 | 84.6% | +8.00u | 77% (10/13) | +1.06 ± 0.39 |
| coming down from altitude: hurts us | 11 | 4-7 | 36.4% | -3.36u | 73% (8/11) | +0.61 ± 0.43 |
| out: 3+ players (ours) | 56 | 25-30-1 | 45.5% | -7.28u | 68% (38/56) | +0.58 ± 0.24 |
| out: 3+ players (theirs) | 60 | 27-32-1 | 45.8% | -7.46u | 63% (38/60) | +0.48 ± 0.22 |
| out: DB (ours) | 45 | 21-23-1 | 47.7% | -3.91u | 64% (29/45) | +0.46 ± 0.28 |
| out: DB (theirs) | 46 | 20-25-1 | 44.4% | -6.82u | 65% (30/46) | +0.59 ± 0.27 |
| out: no report found | 60 | 25-34-1 | 42.4% | -11.28u | 53% (32/60) | -0.08 ± 0.27 |
| out: OL (ours) | 41 | 18-22-1 | 45.0% | -5.64u | 68% (28/41) | +0.67 ± 0.28 |
| out: OL (theirs) | 45 | 19-25-1 | 43.2% | -7.73u | 69% (31/45) | +0.59 ± 0.28 |
| out: QB (ours) | 14 | 3-10-1 | 23.1% | -7.27u | 57% (8/14) | -0.18 ± 0.59 |
| out: QB (theirs) | 14 | 4-9-1 | 30.8% | -5.36u | 93% (13/14) | +1.30 ± 0.32 |
| rest: they're off a bye, we aren't | 33 | 11-22 | 33.3% | -12.00u | 58% (19/33) | +0.34 ± 0.35 |
| rest: we're off a bye, they aren't | 25 | 8-16-1 | 33.3% | -8.73u | 44% (11/25) | +0.09 ± 0.33 |
| small home crowd: we're home | 47 | 24-23 | 51.1% | -1.18u | 49% (23/47) | +0.31 ± 0.26 |
| small home crowd: we're the visitor | 59 | 24-35 | 40.7% | -13.18u | 59% (35/59) | +0.44 ± 0.27 |
| time zones (2+): helps us | 26 | 12-14 | 46.2% | -3.09u | 54% (14/26) | +0.63 ± 0.30 |
| time zones (2+): hurts us | 22 | 9-13 | 40.9% | -4.82u | 45% (10/22) | -0.01 ± 0.44 |
| travel (1,000+ mi more): helps us | 41 | 18-23 | 43.9% | -6.64u | 56% (23/41) | +0.71 ± 0.28 |
| travel (1,000+ mi more): hurts us | 41 | 16-24-1 | 40.0% | -9.46u | 46% (19/41) | -0.03 ± 0.32 |
| weather: muggy (dew 68°F+) | 15 | 10-5 | 66.7% | +4.09u | 60% (9/15) | +1.15 ± 0.44 |
| weather: rain | 10 | 6-4 | 60.0% | +1.45u | 70% (7/10) | +1.15 ± 0.80 |
| weather: wind 15+ mph | 23 | 13-10 | 56.5% | +1.82u | 57% (13/23) | +0.78 ± 0.41 |
| weeknight (Fri) | 43 | 22-21 | 51.2% | -1.00u | 58% (25/43) | +0.52 ± 0.27 |
| weeknight (Thu) | 16 | 4-12 | 25.0% | -8.36u | 63% (10/16) | +0.83 ± 0.47 |
| weeknight (Tue) | 10 | 5-5 | 50.0% | -0.45u | 70% (7/10) | +0.82 ± 0.37 |
| weeknight (Wed) | 10 | 5-5 | 50.0% | -0.46u | 60% (6/10) | +0.15 ± 0.57 |

Rare tags (under 10 graded): altitude climb: hurts us (3-6); coming down from altitude: helps us (4-4); heat vs home: helps us (1-2); heat vs home: hurts us (1-0); humidity vs home: helps us (1-2); humidity vs home: hurts us (1-0); neutral site (1-1); rest: they're on a short week (2-6); rest: we're on a short week (2-7); weather: hot (88°F+) (0-3).

### Bets by situation

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| we're home | 62 | 31-30-1 | 50.8% | -1.82u | 61% (38/62) | +0.79 ± 0.22 |
| we're the visitor | 65 | 33-29-3 | 53.2% | +1.00u | 60% (39/65) | +0.52 ± 0.29 |
| favorite | 28 | 12-16 | 42.9% | -5.09u | 54% (15/28) | +0.49 ± 0.33 |
| underdog | 99 | 52-43-4 | 54.7% | +4.27u | 63% (62/99) | +0.70 ± 0.22 |
| line under 7 | 53 | 31-20-2 | 60.8% | +8.18u | 68% (36/53) | +0.99 ± 0.25 |
| line 7-13.5 | 42 | 19-22-1 | 46.3% | -4.73u | 57% (24/42) | +0.25 ± 0.35 |
| line 14+ | 32 | 14-17-1 | 45.2% | -4.27u | 53% (17/32) | +0.63 ± 0.38 |
| conference game | 121 | 60-57-4 | 51.3% | -2.46u | 60% (73/121) | +0.61 ± 0.19 |
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
| 11 | 10-11-1 | -1.91u | 59% | +0.17 ± 0.49 | 62% |

## Week 11 bets

- L SAC @ CMU: SAC +18.5 (edge 10.3), final SAC 7-28 CMU, CLV +1.25 [travel (1,000+ mi more): hurts us, time zones (2+): hurts us, small home crowd: we're the visitor, out: no report found, weeknight (Wed)]
- L NU @ OSU: OSU -11.5 (edge 9.6), final NU 19-28 OSU, CLV +3 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W KU @ WVU: KU +2.5 (edge 7.8), final KU 37-14 WVU, CLV +1 [out: OL (ours), out: 3+ players (ours), out: OL (theirs), out: 3+ players (theirs), weeknight (Fri)]
- W HOU @ COLO: COLO +10.5 (edge 7.3), final HOU 32-42 COLO, CLV +3 [altitude climb: helps us, out: DB (ours), out: 3+ players (ours), out: OL (theirs), weeknight (Fri)]
- L ECU @ CLT: ECU -11.5 (edge 7.2), final ECU 17-16 CLT, CLV +0.5 [small home crowd: we're the visitor, out: no report found]
- L WMU @ AKR: AKR +14.5 (edge 7), final WMU 42-14 AKR, CLV -0.75 [small home crowd: we're home, out: no report found, weeknight (Tue)]
- W KENT @ BGSU: KENT +6 (edge 6.9), final KENT 28-33 BGSU, CLV +2.25 [small home crowd: we're the visitor, out: no report found, weeknight (Tue)]
- L USM @ LT: USM +17.5 (edge 6.5), final USM 31-63 LT, CLV +0 [small home crowd: we're the visitor, out: no report found]
- W MTSU @ LIB: MTSU +21.5 (edge 6.1), final MTSU 23-28 LIB, CLV -0.75 [small home crowd: we're the visitor, out: no report found]
- W ORST @ BOIS: ORST +10.5 (edge 6), final ORST 41-46 BOIS, CLV -7 [out: no report found]
- L TENN @ TA&M: TA&M +2.5 (edge 5.9), final TENN 22-7 TA&M, CLV +1.25 [out: OL (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- P SYR @ NCSU: NCSU +3 (edge 5.8), final SYR 34-31 NCSU, CLV +0.25 [out: QB (ours), out: OL (ours), out: DB (ours), out: 3+ players (ours), out: QB (theirs), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W GT @ CLEM: GT +13.5 (edge 5.5), final GT 20-6 CLEM, CLV -2 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- W FLA @ UK: FLA +3.5 (edge 5.2), final FLA 21-14 UK, CLV +0.5 [out: DB (ours), out: 3+ players (ours), out: DB (theirs), out: 3+ players (theirs), weeknight (Fri)]
- W TTU @ OKST: TTU +3.5 (edge 5.1), final TTU 52-27 OKST, CLV -0.75 [out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: 3+ players (theirs), weeknight (Fri)]
- W WIS @ MD: MD +7.5 (edge 5.1), final WIS 21-24 MD, CLV -0.75 [out: OL (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]
- L SJSU @ AF: SJSU +11.5 (edge 5.1), final SJSU 3-24 AF, CLV -3.5 [altitude climb: hurts us, out: no report found]
- L MEM @ USF: USF +5.5 (edge 5), final MEM 52-41 USF, CLV +0.75 [rest: they're off a bye, we aren't, humidity vs home: helps us, out: no report found, weeknight (Thu)]
- L AUB @ MSST: MSST +3 (edge 4.3), final AUB 41-9 MSST, CLV +0.25 [out: QB (ours), out: DB (ours), out: 3+ players (ours), out: OL (theirs), out: 3+ players (theirs)]
- L TROY @ USA: TROY +3 (edge 4.2), final TROY 14-27 USA, CLV +0 [small home crowd: we're the visitor, out: no report found]
- L WYO @ UTEP: UTEP +8.5 (edge 4.2), final WYO 27-15 UTEP, CLV +1.5 [coming down from altitude: helps us, out: no report found]
- W ALA @ VAN: VAN +19.5 (edge 4.1), final ALA 21-6 VAN, CLV +3.75 [out: QB (ours), out: OL (ours), out: 3+ players (ours), out: OL (theirs), out: DB (theirs), out: 3+ players (theirs)]

Weeks with "seeded" picks were rebuilt from run logs (our number rounded to 0.5, no availability or kickoff-weather fields).
