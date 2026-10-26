# CFB Lines: weekly review (2026, updated 2026-10-26)

Every pick the bot sent, graded by `cfb-lines/review.js`. Ledger: `cfb/picks.json`. Lessons so far: `cfb-lines/LEARNINGS.md` on main.

- **Bet** = a first-look ✅ spread (the backtest edge is against the opener). **Lean** = our side of every priced game in a card.
- Units assume -110 (CFBD has no prices). Breakeven 52.4%.
- **CLV** = points the closing consensus line moved toward our side (positive = beat the close). It's the early signal: about 50 bets show whether there's an edge, W-L needs hundreds.

## Week 8

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| bets (first-look ✅ spreads) | 22 | 12-10 | 54.5% | +0.91u | 68% (15/22) | +1.19 ± 0.47 |
| all first-look leans | 53 | 24-29 | 45.3% | -7.18u | 60% (32/53) | +0.56 ± 0.30 |

## Season to date

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **bets (first-look ✅ spreads)** | 81 | 42-37-2 | 53.2% | +1.18u | 59% (48/81) | +0.75 ± 0.23 |
| all first-look leans | 194 | 91-101-2 | 47.4% | -18.28u | 52% (100/194) | +0.36 ± 0.14 |
| totals leans, edge 4+ (no ✅: totals are off) | 86 | 48-38 | 55.8% | +5.63u | 69% (59/86) | +1.05 ± 0.22 |

### By model version

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| v1 bets | 81 | 42-37-2 | 53.2% | +1.18u | 59% (48/81) | +0.75 ± 0.23 |
| v1 first-look leans | 194 | 91-101-2 | 47.4% | -18.28u | 52% (100/194) | +0.36 ± 0.14 |

### First-look leans by edge size

The backtest's best sign: the line moving our way should grow with the edge.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| edge 0-2 | 54 | 22-32 | 40.7% | -12.00u | 44% (24/54) | -0.10 ± 0.26 |
| edge 2-4 | 57 | 27-30 | 47.4% | -5.46u | 46% (26/57) | +0.17 ± 0.21 |
| edge 4-6 | 44 | 27-16-1 | 62.8% | +8.54u | 55% (24/44) | +0.66 ± 0.29 |
| edge 6-8 | 22 | 7-15 | 31.8% | -8.64u | 59% (13/22) | +0.47 ± 0.48 |
| edge 8+ | 17 | 8-8-1 | 50.0% | -0.73u | 76% (13/17) | +1.54 ± 0.52 |

### Bets by tag (angle tags, first-look ✅ spreads)

Tags are informational: an angle only goes into the model if it beats an out-of-sample backtest (LEARNINGS.md). Compare each row with the no-tags baseline; a CLV gap smaller than about 2 standard errors is noise.

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 26 | 14-11-1 | 56.0% | +1.73u | 58% (15/26) | +0.75 ± 0.30 |
| rest: we're off a bye, they aren't | 10 | 5-4-1 | 55.6% | +0.55u | 60% (6/10) | +0.65 ± 0.72 |
| small home crowd: we're the visitor | 17 | 8-9 | 47.1% | -1.73u | 71% (12/17) | +0.99 ± 0.67 |

Rare tags (under 10 graded): altitude climb: helps us (3-1); altitude climb: hurts us (0-2); coming down from altitude: hurts us (3-1); rest: they're off a bye, we aren't (4-3); rest: they're on a short week (1-2); rest: we're on a short week (1-2); small home crowd: we're home (4-4); time zones (2+): helps us (2-2); time zones (2+): hurts us (2-1); travel (1,000+ mi more): helps us (3-4); travel (1,000+ mi more): hurts us (3-5-1); weather: muggy (dew 68°F+) (4-1); weather: rain (3-1); weather: wind 15+ mph (4-5); weeknight (Fri) (3-1); weeknight (Thu) (2-4); weeknight (Tue) (1-1).

### All first-look leans by tag (bigger sample)

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| **no tags (baseline)** | 51 | 25-25-1 | 50.0% | -2.28u | 51% (26/51) | +0.32 ± 0.22 |
| rest: they're off a bye, we aren't | 19 | 6-13 | 31.6% | -7.55u | 58% (11/19) | +0.38 ± 0.53 |
| rest: we're off a bye, they aren't | 19 | 7-11-1 | 38.9% | -4.64u | 42% (8/19) | +0.22 ± 0.40 |
| small home crowd: we're home | 28 | 16-12 | 57.1% | +2.54u | 46% (13/28) | +0.32 ± 0.40 |
| small home crowd: we're the visitor | 38 | 16-22 | 42.1% | -7.46u | 58% (22/38) | +0.37 ± 0.39 |
| time zones (2+): helps us | 13 | 8-5 | 61.5% | +2.27u | 38% (5/13) | +0.46 ± 0.51 |
| time zones (2+): hurts us | 16 | 6-10 | 37.5% | -4.55u | 38% (6/16) | -0.22 ± 0.56 |
| travel (1,000+ mi more): helps us | 22 | 11-11 | 50.0% | -1.00u | 50% (11/22) | +0.69 ± 0.45 |
| travel (1,000+ mi more): hurts us | 28 | 9-18-1 | 33.3% | -9.82u | 43% (12/28) | -0.08 ± 0.41 |
| weather: muggy (dew 68°F+) | 13 | 9-4 | 69.2% | +4.18u | 69% (9/13) | +1.42 ± 0.46 |
| weather: rain | 10 | 6-4 | 60.0% | +1.45u | 70% (7/10) | +1.15 ± 0.80 |
| weather: wind 15+ mph | 23 | 13-10 | 56.5% | +1.82u | 57% (13/23) | +0.78 ± 0.41 |
| weeknight (Fri) | 15 | 7-8 | 46.7% | -1.64u | 20% (3/15) | -0.22 ± 0.43 |
| weeknight (Thu) | 12 | 3-9 | 25.0% | -6.27u | 58% (7/12) | +0.83 ± 0.63 |

Rare tags (under 10 graded): altitude climb: helps us (7-1); altitude climb: hurts us (2-5); coming down from altitude: helps us (2-1); coming down from altitude: hurts us (3-4); neutral site (1-0); rest: they're on a short week (2-5); rest: we're on a short week (1-5); weather: hot (88°F+) (0-3); weeknight (Tue) (3-2); weeknight (Wed) (3-1).

### Bets by situation

| | graded | W-L-P | win % | units (-110) | beat the close | avg CLV (pts) |
|---|---|---|---|---|---|---|
| we're home | 39 | 22-17 | 56.4% | +3.00u | 51% (20/39) | +0.59 ± 0.31 |
| we're the visitor | 42 | 20-20-2 | 50.0% | -1.82u | 67% (28/42) | +0.90 ± 0.34 |
| favorite | 20 | 10-10 | 50.0% | -0.91u | 40% (8/20) | +0.19 ± 0.42 |
| underdog | 61 | 32-27-2 | 54.2% | +2.09u | 66% (40/61) | +0.93 ± 0.27 |
| line under 7 | 31 | 20-10-1 | 66.7% | +8.18u | 65% (20/31) | +1.08 ± 0.36 |
| line 7-13.5 | 28 | 12-16 | 42.9% | -5.09u | 54% (15/28) | +0.35 ± 0.38 |
| line 14+ | 22 | 10-11-1 | 47.6% | -1.91u | 59% (13/22) | +0.80 ± 0.49 |
| conference game | 76 | 39-35-2 | 52.7% | +0.45u | 59% (45/76) | +0.72 ± 0.24 |
| non-conference | 5 | 3-2 | 60.0% | +0.73u | 60% (3/5) | +1.25 ± 1.04 |

### By week (bets)

| week | W-L-P | units | beat the close | avg CLV | leans beat the close |
|---|---|---|---|---|---|
| 5 | 11-7 | +3.00u | 50% | +0.40 ± 0.51 | 43% |
| 6 | 6-6-1 | -0.55u | 62% | +0.63 ± 0.71 | 56% |
| 7 | 13-14-1 | -2.18u | 57% | +0.68 ± 0.33 | 49% |
| 8 | 12-10 | +0.91u | 68% | +1.19 ± 0.47 | 60% |

## Week 8 bets

- L COLO @ OKST: COLO +13.5 (edge 11.2), final COLO 24-57 OKST, CLV +0.5 [coming down from altitude: hurts us]
- W M-OH @ CMU: M-OH +1.5 (edge 10), final M-OH 28-27 CMU, CLV +5 [small home crowd: we're the visitor]
- W UNT @ NAVY: UNT -2.5 (edge 9.2), final UNT 49-39 NAVY, CLV +0.5 [rest: we're off a bye, they aren't, travel (1,000+ mi more): hurts us]
- L RUTG @ NU: RUTG +16.5 (edge 8.4), final RUTG 14-42 NU, CLV +1
- W ECU @ MEM: ECU +9.5 (edge 8.1), final ECU 34-41 MEM, CLV -1 [weeknight (Thu)]
- L SJSU @ NEV: SJSU +5.5 (edge 7.8), final SJSU 13-28 NEV, CLV -0.25 [altitude climb: hurts us, small home crowd: we're the visitor]
- L ODU @ LT: ODU +8.5 (edge 7.4), final ODU 0-26 LT, CLV -5 [travel (1,000+ mi more): hurts us, small home crowd: we're the visitor]
- L WVU @ TCU: TCU -7 (edge 6.5), final WVU 24-20 TCU, CLV +3 [travel (1,000+ mi more): helps us]
- W IU @ MICH: MICH +8.5 (edge 6.1), final IU 13-6 MICH, CLV +1
- W SDSU @ CSU: CSU +3 (edge 5.6), final SDSU 49-56 CSU, CLV +2.75 [altitude climb: helps us]
- L MASS @ CONN: MASS +16.5 (edge 5.1), final MASS 16-35 CONN, CLV +3.75 [rest: they're off a bye, we aren't, weeknight (Fri)]
- L LIB @ KENN: KENN +10.5 (edge 5), final LIB 34-6 KENN, CLV +2 [rest: they're off a bye, we aren't, small home crowd: we're home, weeknight (Thu)]
- W ULM @ TROY: ULM +17.5 (edge 5), final ULM 21-14 TROY, CLV +4 [small home crowd: we're the visitor]
- W MSU @ UCLA: UCLA -13.5 (edge 4.9), final MSU 10-28 UCLA, CLV +3 [travel (1,000+ mi more): helps us, time zones (2+): helps us]
- L VAN @ UK: VAN +11.5 (edge 4.9), final VAN 17-34 UK, CLV +1.5
- W MISS @ TEX: TEX -3 (edge 4.9), final MISS 27-34 TEX, CLV +0
- W UL @ USM: USM +10.5 (edge 4.8), final UL 31-35 USM, CLV -1
- W AF @ WYO: WYO +7 (edge 4.7), final AF 14-28 WYO, CLV +0 [small home crowd: we're home, weather: wind 15+ mph, weeknight (Fri)]
- L IOWA @ MINN: IOWA -6 (edge 4.7), final IOWA 10-13 MINN, CLV +1.75
- L BOIS @ WSU: WSU +14 (edge 4.7), final BOIS 31-10 WSU, CLV -0.75 [rest: they're off a bye, we aren't]
- W USA @ MRSH: MRSH +3 (edge 4.1), final USA 13-20 MRSH, CLV +1.5 [rest: they're off a bye, we aren't, weeknight (Tue)]
- W BAY @ KU: KU +1.5 (edge 4), final BAY 24-25 KU, CLV +3

Weeks with "seeded" picks were rebuilt from run logs (our number rounded to 0.5, no availability or kickoff-weather fields).
