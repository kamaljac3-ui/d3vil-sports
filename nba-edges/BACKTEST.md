# NBA Edges backtest

Generated 2026-09-27 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## Teammate-out settings

Squared error relative to the plain season average, averaged over PTS/REB/AST (**below 1.000 = the projection beats the average**; squared error because box scores are right-skewed and average-miss rewards the median). "Slope" is got ÷ said for points in games where someone was out (1 = right size). "Games with someone out" is the subset where the rule actually does anything. Picked on 2024-25: **minutes 0.25, usage 0**.

| Setting | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| old rule (everyone +70% × lost/remaining) | 1.0819 | 1.0952 | 0.20 | 1.0723 | 1.0831 | 0.18 |
| none | 0.9948 | 0.9942 | 0.85 | 0.9961 | 0.9965 | 0.54 |
| **minutes 0.25, usage 0** | 0.9941 | 0.9934 | 0.84 | 0.9959 | 0.9963 | 0.64 |
| minutes 0.25, usage 0.15 | 1.0007 | 1.0011 | 0.61 | 1.0032 | 1.0046 | 0.52 |
| minutes 0.25, usage 0.3 | 1.0165 | 1.0194 | 0.44 | 1.0188 | 1.0223 | 0.39 |
| minutes 0.25, usage 0.5 | 1.0515 | 1.0601 | 0.31 | 1.0523 | 1.0604 | 0.27 |
| minutes 0.5, usage 0 | 1.0126 | 1.0149 | 0.48 | 1.0138 | 1.0166 | 0.43 |
| minutes 0.5, usage 0.15 | 1.0307 | 1.0360 | 0.38 | 1.0326 | 1.0380 | 0.34 |
| minutes 0.5, usage 0.3 | 1.0589 | 1.0687 | 0.31 | 1.0607 | 1.0699 | 0.27 |
| minutes 0.5, usage 0.5 | 1.1122 | 1.1306 | 0.24 | 1.1124 | 1.1286 | 0.21 |
| minutes 0.75, usage 0 | 1.0502 | 1.0586 | 0.32 | 1.0498 | 1.0575 | 0.30 |
| minutes 0.75, usage 0.15 | 1.0816 | 1.0951 | 0.27 | 1.0818 | 1.0939 | 0.25 |
| minutes 0.75, usage 0.3 | 1.1242 | 1.1446 | 0.23 | 1.1241 | 1.1420 | 0.21 |
| minutes 0.75, usage 0.5 | 1.1983 | 1.2307 | 0.19 | 1.1966 | 1.2243 | 0.17 |
| minutes 1, usage 0 | 1.1070 | 1.1246 | 0.24 | 1.1039 | 1.1189 | 0.22 |
| minutes 1, usage 0.15 | 1.1534 | 1.1786 | 0.21 | 1.1508 | 1.1722 | 0.19 |
| minutes 1, usage 0.3 | 1.2122 | 1.2469 | 0.18 | 1.2092 | 1.2386 | 0.16 |
| minutes 1, usage 0.5 | 1.3099 | 1.3603 | 0.16 | 1.3050 | 1.3474 | 0.14 |

The sections below use the picked setting.

## 2024-25 (fit season)

15,317 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 419 | 59.9% | +2.56 | **+2.50** | 0.98 |
| Projection boost: REB | 447 | 55.3% | +1.36 | **+0.68** | 0.50 |
| Projection boost: AST | 211 | 57.8% | +1.22 | **+0.70** | 0.57 |
| Projection boost: 3PM | 116 | 52.6% | +0.63 | **+0.50** | 0.80 |
| *(no flag) all rotation players, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) all rotation players, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) all rotation players, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) all rotation players, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,317 | 5.377 | 5.377 | -1.1% | 0.84 ± 0.06 |
| full model | REB | 15,317 | 2.066 | 2.085 | 0.3% | 0.44 ± 0.05 |
| full model | AST | 15,317 | 1.585 | 1.588 | -0.9% | 0.69 ± 0.05 |
| full model | 3PM | 15,317 | 1.062 | 1.068 | -0.1% | 0.57 ± 0.08 |
| without shot zones | PTS | 15,317 | 5.377 | 5.385 | -0.9% | 0.83 ± 0.07 |
| without shot zones | REB | 15,317 | 2.066 | 2.085 | 0.3% | 0.44 ± 0.05 |
| without shot zones | AST | 15,317 | 1.585 | 1.588 | -0.9% | 0.69 ± 0.05 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.068 | -0.2% | 0.66 ± 0.10 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.379 | -1.0% | 0.84 ± 0.07 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.087 | 0.5% | 0.37 ± 0.06 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.589 | -0.7% | 0.65 ± 0.05 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.068 | -0.1% | 0.53 ± 0.09 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.377 | -1.0% | 0.83 ± 0.07 |
| without game total / pace | REB | 15,317 | 2.066 | 2.085 | 0.3% | 0.44 ± 0.05 |
| without game total / pace | AST | 15,317 | 1.585 | 1.587 | -1.1% | 0.78 ± 0.06 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.068 | -0.2% | 0.60 ± 0.09 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.377 | -1.1% | 0.84 ± 0.06 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.083 | 0.2% | 0.43 ± 0.07 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.590 | -0.5% | 0.79 ± 0.08 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.068 | -0.1% | 0.57 ± 0.08 |
| without blowout trim | PTS | 15,317 | 5.377 | 5.377 | -1.1% | 0.84 ± 0.06 |
| without blowout trim | REB | 15,317 | 2.066 | 2.085 | 0.3% | 0.44 ± 0.05 |
| without blowout trim | AST | 15,317 | 1.585 | 1.588 | -0.9% | 0.69 ± 0.05 |
| without blowout trim | 3PM | 15,317 | 1.062 | 1.068 | -0.1% | 0.57 ± 0.08 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.366 | -0.5% | 0.85 ± 0.10 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.065 | -0.2% | 0.63 ± 0.09 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.579 | -0.9% | 0.76 ± 0.06 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.062 | -0.0% | 0.52 ± 0.12 |

## 2025-26 (out of sample)

15,530 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 784 | 55.9% | +2.73 | **+1.81** | 0.66 |
| Projection boost: REB | 374 | 54.0% | +1.31 | **+0.58** | 0.45 |
| Projection boost: AST | 269 | 51.7% | +1.30 | **+0.48** | 0.37 |
| Projection boost: 3PM | 179 | 50.3% | +0.63 | **+0.26** | 0.42 |
| *(no flag) all rotation players, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) all rotation players, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) all rotation players, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) all rotation players, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,530 | 5.367 | 5.368 | -0.7% | 0.64 ± 0.05 |
| full model | REB | 15,530 | 2.036 | 2.043 | -0.4% | 0.57 ± 0.05 |
| full model | AST | 15,530 | 1.583 | 1.589 | -0.2% | 0.53 ± 0.05 |
| full model | 3PM | 15,530 | 1.049 | 1.054 | -0.1% | 0.53 ± 0.07 |
| without shot zones | PTS | 15,530 | 5.367 | 5.370 | -0.8% | 0.71 ± 0.06 |
| without shot zones | REB | 15,530 | 2.036 | 2.043 | -0.4% | 0.57 ± 0.05 |
| without shot zones | AST | 15,530 | 1.583 | 1.589 | -0.2% | 0.53 ± 0.05 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.054 | -0.2% | 0.62 ± 0.09 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.372 | -0.5% | 0.62 ± 0.05 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.045 | -0.2% | 0.55 ± 0.05 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.591 | -0.1% | 0.51 ± 0.05 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.054 | 0.0% | 0.50 ± 0.07 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.363 | -1.0% | 0.83 ± 0.06 |
| without game total / pace | REB | 15,530 | 2.036 | 2.043 | -0.4% | 0.57 ± 0.05 |
| without game total / pace | AST | 15,530 | 1.583 | 1.587 | -0.6% | 0.66 ± 0.06 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.056 | 0.1% | 0.43 ± 0.08 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.368 | -0.7% | 0.64 ± 0.05 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.051 | 0.2% | 0.41 ± 0.07 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.588 | -0.5% | 0.70 ± 0.07 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.054 | -0.1% | 0.53 ± 0.07 |
| without blowout trim | PTS | 15,530 | 5.367 | 5.380 | -0.3% | 0.57 ± 0.05 |
| without blowout trim | REB | 15,530 | 2.036 | 2.046 | -0.2% | 0.54 ± 0.05 |
| without blowout trim | AST | 15,530 | 1.583 | 1.591 | -0.0% | 0.51 ± 0.04 |
| without blowout trim | 3PM | 15,530 | 1.049 | 1.055 | 0.0% | 0.49 ± 0.07 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.356 | -0.1% | 0.54 ± 0.06 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.026 | -0.8% | 0.80 ± 0.07 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.577 | -0.3% | 0.56 ± 0.05 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.047 | -0.2% | 0.59 ± 0.09 |

### Games with a posted total/spread only (12,192 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 12,192 | 5.314 | 5.309 | -1.0% | 0.68 ± 0.05 |
| full model | REB | 12,192 | 2.020 | 2.024 | -0.7% | 0.65 ± 0.06 |
| full model | AST | 12,192 | 1.576 | 1.580 | -0.5% | 0.58 ± 0.05 |
| full model | 3PM | 12,192 | 1.048 | 1.053 | -0.2% | 0.59 ± 0.08 |
| without game total / pace | PTS | 12,192 | 5.314 | 5.302 | -1.5% | 0.93 ± 0.07 |
| without game total / pace | REB | 12,192 | 2.020 | 2.024 | -0.7% | 0.65 ± 0.06 |
| without game total / pace | AST | 12,192 | 1.576 | 1.578 | -1.0% | 0.75 ± 0.07 |
| without game total / pace | 3PM | 12,192 | 1.048 | 1.055 | 0.0% | 0.48 ± 0.09 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Avg miss, raw projection | Avg miss, shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PTS | 0.84 | 5.377 | 5.377 | 5.371 |
| 2024-25 | REB | 0.44 | 2.066 | 2.085 | 2.069 |
| 2024-25 | AST | 0.69 | 1.585 | 1.588 | 1.583 |
| 2024-25 | 3PM | 0.57 | 1.062 | 1.068 | 1.064 |
| 2025-26 | PTS | 0.84 | 5.367 | 5.368 | 5.359 |
| 2025-26 | REB | 0.44 | 2.036 | 2.043 | 2.034 |
| 2025-26 | AST | 0.69 | 1.583 | 1.589 | 1.583 |
| 2025-26 | 3PM | 0.57 | 1.049 | 1.054 | 1.050 |
