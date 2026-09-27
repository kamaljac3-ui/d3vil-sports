# NBA Edges backtest

Generated 2026-09-27 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## 2024-25 (fit season)

15,317 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Shot-zone edge (PTS) | 112 | 47.3% | +4.80 | **+0.19** | 0.04 |
| Projection boost: PTS | 6,257 | 52.1% | +3.53 | **+0.83** | 0.24 |
| Projection boost: REB | 3,799 | 47.7% | +1.59 | **+0.14** | 0.09 |
| Projection boost: AST | 2,005 | 51.8% | +1.55 | **+0.35** | 0.23 |
| Projection boost: 3PM | 2,026 | 46.6% | +0.69 | **+0.07** | 0.11 |
| *(no flag) all rotation players, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) all rotation players, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) all rotation players, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) all rotation players, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Error of plain average | Error of projection | Better by | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,317 | 5.377 | 5.639 | -4.9% | 0.20 ± 0.02 |
| full model | REB | 15,317 | 2.066 | 2.204 | -6.7% | 0.09 ± 0.02 |
| full model | AST | 15,317 | 1.585 | 1.654 | -4.3% | 0.24 ± 0.02 |
| full model | 3PM | 15,317 | 1.062 | 1.103 | -3.9% | 0.12 ± 0.03 |
| without shot zones | PTS | 15,317 | 5.377 | 5.646 | -5.0% | 0.18 ± 0.02 |
| without shot zones | REB | 15,317 | 2.066 | 2.204 | -6.7% | 0.09 ± 0.02 |
| without shot zones | AST | 15,317 | 1.585 | 1.654 | -4.3% | 0.24 ± 0.02 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.103 | -3.9% | 0.10 ± 0.04 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.640 | -4.9% | 0.19 ± 0.02 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.206 | -6.8% | 0.08 ± 0.02 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.655 | -4.4% | 0.23 ± 0.02 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.104 | -4.0% | 0.11 ± 0.04 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.638 | -4.9% | 0.19 ± 0.02 |
| without game total / pace | REB | 15,317 | 2.066 | 2.204 | -6.7% | 0.09 ± 0.02 |
| without game total / pace | AST | 15,317 | 1.585 | 1.652 | -4.3% | 0.24 ± 0.02 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.103 | -3.9% | 0.12 ± 0.04 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.639 | -4.9% | 0.20 ± 0.02 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.204 | -6.7% | 0.07 ± 0.02 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.654 | -4.4% | 0.18 ± 0.03 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.103 | -3.9% | 0.12 ± 0.03 |
| without blowout trim | PTS | 15,317 | 5.377 | 5.639 | -4.9% | 0.20 ± 0.02 |
| without blowout trim | REB | 15,317 | 2.066 | 2.204 | -6.7% | 0.09 ± 0.02 |
| without blowout trim | AST | 15,317 | 1.585 | 1.654 | -4.3% | 0.24 ± 0.02 |
| without blowout trim | 3PM | 15,317 | 1.062 | 1.103 | -3.9% | 0.12 ± 0.03 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.366 | 0.2% | 0.85 ± 0.10 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.065 | 0.0% | 0.63 ± 0.09 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.579 | 0.4% | 0.76 ± 0.06 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.062 | -0.0% | 0.52 ± 0.12 |

## 2025-26 (out of sample)

15,530 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Shot-zone edge (PTS) | 261 | 51.0% | +4.96 | **+0.27** | 0.05 |
| Projection boost: PTS | 5,714 | 52.7% | +3.51 | **+0.81** | 0.23 |
| Projection boost: REB | 3,619 | 49.4% | +1.53 | **+0.20** | 0.13 |
| Projection boost: AST | 1,696 | 52.2% | +1.51 | **+0.36** | 0.24 |
| Projection boost: 3PM | 1,679 | 47.9% | +0.68 | **+0.08** | 0.12 |
| *(no flag) all rotation players, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) all rotation players, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) all rotation players, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) all rotation players, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Error of plain average | Error of projection | Better by | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,530 | 5.367 | 5.645 | -5.2% | 0.18 ± 0.02 |
| full model | REB | 15,530 | 2.036 | 2.154 | -5.8% | 0.13 ± 0.02 |
| full model | AST | 15,530 | 1.583 | 1.644 | -3.8% | 0.25 ± 0.03 |
| full model | 3PM | 15,530 | 1.049 | 1.087 | -3.7% | 0.10 ± 0.04 |
| without shot zones | PTS | 15,530 | 5.367 | 5.645 | -5.2% | 0.17 ± 0.02 |
| without shot zones | REB | 15,530 | 2.036 | 2.154 | -5.8% | 0.13 ± 0.02 |
| without shot zones | AST | 15,530 | 1.583 | 1.644 | -3.8% | 0.25 ± 0.03 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.087 | -3.7% | 0.06 ± 0.04 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.648 | -5.2% | 0.17 ± 0.02 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.155 | -5.9% | 0.12 ± 0.02 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.646 | -4.0% | 0.24 ± 0.03 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.088 | -3.7% | 0.08 ± 0.04 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.653 | -5.3% | 0.16 ± 0.02 |
| without game total / pace | REB | 15,530 | 2.036 | 2.154 | -5.8% | 0.13 ± 0.02 |
| without game total / pace | AST | 15,530 | 1.583 | 1.643 | -3.8% | 0.22 ± 0.03 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.090 | -3.9% | 0.05 ± 0.04 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.645 | -5.2% | 0.18 ± 0.02 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.161 | -6.1% | 0.06 ± 0.03 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.641 | -3.6% | 0.21 ± 0.03 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.087 | -3.7% | 0.10 ± 0.04 |
| without blowout trim | PTS | 15,530 | 5.367 | 5.671 | -5.7% | 0.16 ± 0.02 |
| without blowout trim | REB | 15,530 | 2.036 | 2.160 | -6.1% | 0.12 ± 0.02 |
| without blowout trim | AST | 15,530 | 1.583 | 1.648 | -4.1% | 0.23 ± 0.02 |
| without blowout trim | 3PM | 15,530 | 1.049 | 1.089 | -3.8% | 0.09 ± 0.04 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.356 | 0.2% | 0.54 ± 0.06 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.026 | 0.5% | 0.80 ± 0.07 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.577 | 0.4% | 0.56 ± 0.05 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.047 | 0.2% | 0.59 ± 0.09 |

### Games with a posted total/spread only (12,192 player-games)

| Model | Stat | Player-games | Error of plain average | Error of projection | Better by | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 12,192 | 5.314 | 5.592 | -5.2% | 0.21 ± 0.02 |
| full model | REB | 12,192 | 2.020 | 2.131 | -5.5% | 0.18 ± 0.03 |
| full model | AST | 12,192 | 1.576 | 1.637 | -3.9% | 0.26 ± 0.03 |
| full model | 3PM | 12,192 | 1.048 | 1.088 | -3.8% | 0.12 ± 0.04 |
| without game total / pace | PTS | 12,192 | 5.314 | 5.602 | -5.4% | 0.19 ± 0.03 |
| without game total / pace | REB | 12,192 | 2.020 | 2.131 | -5.5% | 0.18 ± 0.03 |
| without game total / pace | AST | 12,192 | 1.576 | 1.637 | -3.8% | 0.23 ± 0.03 |
| without game total / pace | 3PM | 12,192 | 1.048 | 1.092 | -4.2% | 0.07 ± 0.04 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Error of raw projection | Error of shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PTS | 0.20 | 5.377 | 5.639 | 5.375 |
| 2024-25 | REB | 0.09 | 2.066 | 2.204 | 2.069 |
| 2024-25 | AST | 0.24 | 1.585 | 1.654 | 1.588 |
| 2024-25 | 3PM | 0.12 | 1.062 | 1.103 | 1.064 |
| 2025-26 | PTS | 0.20 | 5.367 | 5.645 | 5.368 |
| 2025-26 | REB | 0.09 | 2.036 | 2.154 | 2.038 |
| 2025-26 | AST | 0.24 | 1.583 | 1.644 | 1.586 |
| 2025-26 | 3PM | 0.12 | 1.049 | 1.087 | 1.051 |
