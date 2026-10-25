# NBA Edges backtest

Generated 2026-10-25 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## Teammate-out settings

Squared error relative to the plain season average, averaged over PTS/REB/AST (**below 1.000 = the projection beats the average**; squared error because box scores are right-skewed and average-miss rewards the median). "Slope" is got ÷ said for points in games where someone was out (1 = right size). "Games with someone out" is the subset where the rule actually does anything. Picked on 2024-25: **minutes 0.25, usage 0**.

| Setting | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| old rule (everyone +70% × lost/remaining) | 1.0639 | 1.0788 | 0.25 | 1.0578 | 1.0728 | 0.21 |
| none | 0.9948 | 0.9938 | 0.87 | 0.9961 | 0.9963 | 0.53 |
| **minutes 0.25, usage 0** | 0.9914 | 0.9896 | 1.00 | 0.9939 | 0.9935 | 0.70 |
| minutes 0.25, usage 0.15 | 0.9949 | 0.9939 | 0.74 | 0.9985 | 0.9993 | 0.59 |
| minutes 0.25, usage 0.3 | 1.0061 | 1.0078 | 0.53 | 1.0100 | 1.0136 | 0.44 |
| minutes 0.25, usage 0.5 | 1.0333 | 1.0412 | 0.37 | 1.0361 | 1.0458 | 0.32 |
| minutes 0.5, usage 0 | 1.0021 | 1.0028 | 0.61 | 1.0050 | 1.0073 | 0.52 |
| minutes 0.5, usage 0.15 | 1.0146 | 1.0181 | 0.48 | 1.0185 | 1.0241 | 0.41 |
| minutes 0.5, usage 0.3 | 1.0356 | 1.0441 | 0.38 | 1.0396 | 1.0503 | 0.32 |
| minutes 0.5, usage 0.5 | 1.0771 | 1.0951 | 0.29 | 1.0797 | 1.1000 | 0.25 |
| minutes 0.75, usage 0 | 1.0270 | 1.0334 | 0.42 | 1.0294 | 1.0376 | 0.37 |
| minutes 0.75, usage 0.15 | 1.0497 | 1.0615 | 0.35 | 1.0530 | 1.0669 | 0.30 |
| minutes 0.75, usage 0.3 | 1.0820 | 1.1012 | 0.29 | 1.0851 | 1.1067 | 0.25 |
| minutes 0.75, usage 0.5 | 1.1397 | 1.1722 | 0.24 | 1.1411 | 1.1761 | 0.20 |
| minutes 1, usage 0 | 1.0660 | 1.0815 | 0.31 | 1.0671 | 1.0844 | 0.28 |
| minutes 1, usage 0.15 | 1.1004 | 1.1239 | 0.27 | 1.1021 | 1.1278 | 0.23 |
| minutes 1, usage 0.3 | 1.1452 | 1.1790 | 0.23 | 1.1464 | 1.1828 | 0.20 |
| minutes 1, usage 0.5 | 1.2212 | 1.2726 | 0.20 | 1.2202 | 1.2742 | 0.16 |

The sections below use the picked setting.

## 2024-25 (fit season)

15,512 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 71 | 73.2% | +2.47 | **+5.59** | 2.27 |
| Projection boost: REB | 8 | 75.0% | +1.28 | **+3.75** | 2.94 |
| Projection boost: AST | 2 | 100.0% | +1.07 | **+4.50** | 4.22 |
| *(no flag) everyone in this group, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) everyone in this group, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) everyone in this group, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) everyone in this group, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,317 | 5.377 | 5.367 | -1.3% | 0.98 ± 0.07 |
| full model | REB | 15,317 | 2.066 | 2.078 | -0.1% | 0.52 ± 0.06 |
| full model | AST | 15,317 | 1.585 | 1.584 | -1.2% | 0.76 ± 0.05 |
| full model | 3PM | 15,317 | 1.062 | 1.067 | -0.2% | 0.63 ± 0.09 |
| calibrated (what alerts use) | PTS | 15,317 | 5.377 | 5.351 | -1.4% | 1.20 ± 0.08 |
| calibrated (what alerts use) | REB | 15,317 | 2.066 | 2.054 | -0.9% | 1.10 ± 0.09 |
| calibrated (what alerts use) | AST | 15,317 | 1.585 | 1.576 | -1.7% | 1.28 ± 0.08 |
| calibrated (what alerts use) | 3PM | 15,317 | 1.062 | 1.066 | -0.7% | 1.18 ± 0.11 |
| without shot zones | PTS | 15,317 | 5.377 | 5.375 | -1.1% | 1.01 ± 0.08 |
| without shot zones | REB | 15,317 | 2.066 | 2.078 | -0.1% | 0.52 ± 0.06 |
| without shot zones | AST | 15,317 | 1.585 | 1.584 | -1.2% | 0.76 ± 0.05 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.066 | -0.3% | 0.78 ± 0.12 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.369 | -1.2% | 1.00 ± 0.07 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.080 | 0.2% | 0.45 ± 0.06 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.586 | -1.0% | 0.72 ± 0.05 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.067 | -0.1% | 0.59 ± 0.09 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.367 | -1.2% | 1.00 ± 0.07 |
| without game total / pace | REB | 15,317 | 2.066 | 2.078 | -0.1% | 0.52 ± 0.06 |
| without game total / pace | AST | 15,317 | 1.585 | 1.583 | -1.4% | 0.88 ± 0.06 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.066 | -0.2% | 0.66 ± 0.09 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.367 | -1.3% | 0.98 ± 0.07 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.077 | -0.1% | 0.55 ± 0.07 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.586 | -0.8% | 1.02 ± 0.09 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.067 | -0.2% | 0.63 ± 0.09 |
| without blowout trim | PTS | 15,317 | 5.377 | 5.367 | -1.3% | 0.98 ± 0.07 |
| without blowout trim | REB | 15,317 | 2.066 | 2.078 | -0.1% | 0.52 ± 0.06 |
| without blowout trim | AST | 15,317 | 1.585 | 1.584 | -1.2% | 0.76 ± 0.05 |
| without blowout trim | 3PM | 15,317 | 1.062 | 1.067 | -0.2% | 0.63 ± 0.09 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.366 | -0.5% | 0.85 ± 0.10 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.065 | -0.2% | 0.63 ± 0.09 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.579 | -0.9% | 0.76 ± 0.06 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.062 | -0.0% | 0.52 ± 0.12 |

## 2025-26 (out of sample)

15,818 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 133 | 64.7% | +2.56 | **+3.32** | 1.30 |
| Projection boost: REB | 1 | 0.0% | +1.03 | **-1.20** | -1.16 |
| Projection boost: AST | 9 | 55.6% | +1.10 | **+0.71** | 0.64 |
| *(no flag) everyone in this group, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) everyone in this group, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) everyone in this group, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) everyone in this group, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,530 | 5.367 | 5.355 | -0.9% | 0.69 ± 0.05 |
| full model | REB | 15,530 | 2.036 | 2.038 | -0.6% | 0.64 ± 0.06 |
| full model | AST | 15,530 | 1.583 | 1.585 | -0.4% | 0.57 ± 0.05 |
| full model | 3PM | 15,530 | 1.049 | 1.052 | -0.2% | 0.59 ± 0.08 |
| calibrated (what alerts use) | PTS | 15,530 | 5.367 | 5.327 | -1.8% | 1.05 ± 0.06 |
| calibrated (what alerts use) | REB | 15,530 | 2.036 | 2.020 | -1.6% | 1.41 ± 0.09 |
| calibrated (what alerts use) | AST | 15,530 | 1.583 | 1.575 | -1.3% | 0.99 ± 0.07 |
| calibrated (what alerts use) | 3PM | 15,530 | 1.049 | 1.052 | -0.9% | 1.17 ± 0.10 |
| without shot zones | PTS | 15,530 | 5.367 | 5.357 | -0.9% | 0.80 ± 0.06 |
| without shot zones | REB | 15,530 | 2.036 | 2.038 | -0.6% | 0.64 ± 0.06 |
| without shot zones | AST | 15,530 | 1.583 | 1.585 | -0.4% | 0.57 ± 0.05 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.052 | -0.3% | 0.74 ± 0.10 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.359 | -0.7% | 0.67 ± 0.06 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.040 | -0.4% | 0.62 ± 0.06 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.587 | -0.3% | 0.55 ± 0.05 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.052 | -0.1% | 0.56 ± 0.08 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.350 | -1.2% | 0.95 ± 0.07 |
| without game total / pace | REB | 15,530 | 2.036 | 2.038 | -0.6% | 0.64 ± 0.06 |
| without game total / pace | AST | 15,530 | 1.583 | 1.583 | -0.8% | 0.74 ± 0.06 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.053 | 0.0% | 0.49 ± 0.08 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.355 | -0.9% | 0.69 ± 0.05 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.046 | -0.0% | 0.50 ± 0.08 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.584 | -0.7% | 0.83 ± 0.08 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.052 | -0.2% | 0.59 ± 0.08 |
| without blowout trim | PTS | 15,530 | 5.367 | 5.367 | -0.5% | 0.61 ± 0.05 |
| without blowout trim | REB | 15,530 | 2.036 | 2.041 | -0.4% | 0.60 ± 0.05 |
| without blowout trim | AST | 15,530 | 1.583 | 1.587 | -0.3% | 0.54 ± 0.05 |
| without blowout trim | 3PM | 15,530 | 1.049 | 1.053 | -0.1% | 0.54 ± 0.07 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.356 | -0.1% | 0.54 ± 0.06 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.026 | -0.8% | 0.80 ± 0.07 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.577 | -0.3% | 0.56 ± 0.05 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.047 | -0.2% | 0.59 ± 0.09 |

### Games with a posted total/spread only (12,427 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 12,192 | 5.314 | 5.297 | -1.2% | 0.72 ± 0.06 |
| full model | REB | 12,192 | 2.020 | 2.020 | -0.9% | 0.71 ± 0.06 |
| full model | AST | 12,192 | 1.576 | 1.576 | -0.7% | 0.61 ± 0.05 |
| full model | 3PM | 12,192 | 1.048 | 1.051 | -0.3% | 0.63 ± 0.08 |
| without game total / pace | PTS | 12,192 | 5.314 | 5.290 | -1.6% | 1.04 ± 0.07 |
| without game total / pace | REB | 12,192 | 2.020 | 2.020 | -0.9% | 0.71 ± 0.06 |
| without game total / pace | AST | 12,192 | 1.576 | 1.574 | -1.1% | 0.83 ± 0.07 |
| without game total / pace | 3PM | 12,192 | 1.048 | 1.053 | -0.1% | 0.54 ± 0.09 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Avg miss, raw projection | Avg miss, shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PTS | 0.98 | 5.377 | 5.367 | 5.366 |
| 2024-25 | REB | 0.52 | 2.066 | 2.078 | 2.068 |
| 2024-25 | AST | 0.76 | 1.585 | 1.584 | 1.581 |
| 2024-25 | 3PM | 0.63 | 1.062 | 1.067 | 1.064 |
| 2025-26 | PTS | 0.98 | 5.367 | 5.355 | 5.354 |
| 2025-26 | REB | 0.52 | 2.036 | 2.038 | 2.033 |
| 2025-26 | AST | 0.76 | 1.583 | 1.585 | 1.581 |
| 2025-26 | 3PM | 0.63 | 1.049 | 1.052 | 1.049 |

## Prop probabilities (calibration)

The prop alert needs an honest probability, not just a projection. `model.calibrate` shrinks a starter's projected gap from his average by k, pulls every projection toward m by beta (a high season average is partly luck), and `model.sdOf` sets the spread as a + b·√projection. Fit on 2024-25, checked on the rest. Real prop lines aren't available historically, so each player-game gets a **stand-in line: his average rounded to x.5**. Books' real lines are sharper than that, so these hit rates run higher than live ones; the point is whether "the model says 70%" means 70%. "Picks" are the ones the alert would send (P_MIN 0.58, minimum gaps {"pts":2,"reb":1,"ast":1,"fg3m":0.5}). Rotation and bench players (10+ MPG) who played.

| Season | Probabilities | Said 55-60% → hit | Said 60-65% → hit | Said 65-75% → hit | Said 75%+ → hit | Picks | Pick hit rate | Log loss |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-25 (fit) | old fixed spreads, raw projection | 57.3% → 53.9% | 62.2% → 58.3% | 68.3% → 61.2% | 80.2% → 73.8% | 4,378 | 64.2% | 0.6879 |
| 2024-25 (fit) | calibrated (fit on 2024-25) | 57.2% → 56.4% | 62.1% → 60.4% | 67.7% → 64.8% | 78.5% → 81.0% | 3,556 | 68.7% | 0.6838 |
| 2025-26 | old fixed spreads, raw projection | 57.4% → 54.5% | 62.2% → 58.3% | 68.4% → 61.9% | 79.7% → 72.8% | 5,351 | 63.1% | 0.6868 |
| 2025-26 | calibrated (fit on 2024-25) | 57.3% → 56.3% | 62.1% → 61.1% | 67.6% → 63.9% | 78.6% → 86.8% | 4,116 | 66.6% | 0.6830 |

Fit on all seasons (this goes in `model.js` CAL, or set `NBA_CAL`):

```
{"pts":{"k":0.798,"m":9.739,"beta":0.941,"a":1.559,"b":1.394},"reb":{"k":0.58,"m":2.515,"beta":0.941,"a":-0.03,"b":1.237},"ast":{"k":0.651,"m":2.432,"beta":0.942,"a":-0.033,"b":1.17},"fg3m":{"k":0.604,"m":1.213,"beta":0.91,"a":-0.082,"b":1.166}}
```

## Bench players (10–20 MPG)

Same replay with players averaging 10–20 minutes also projected. Starters keep the picked setting; the bench gets its own share of a missing teammate's minutes (bench scale). Coach's-decision DNPs aren't treated as known before the game: those players are projected and count as "didn't play". Picked on 2024-25 by squared error in games where someone was out: **bench scale 0.25**.

| Bench scale | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 0.9854 | 0.9849 | 1.49 | 0.9917 | 0.9915 | 0.59 |
| **0.25** | 0.9436 | 0.9389 | 1.39 | 0.9481 | 0.9424 | 1.45 |
| 0.5 | 0.9535 | 0.9500 | 0.79 | 0.9453 | 0.9394 | 0.89 |
| 0.75 | 1.0151 | 1.0182 | 0.54 | 0.9831 | 0.9823 | 0.62 |
| 1 | 1.1284 | 1.1437 | 0.41 | 1.0615 | 1.0712 | 0.47 |
| 1.25 | 1.2933 | 1.3263 | 0.33 | 1.1806 | 1.2061 | 0.38 |

### Bench, 2024-25: 7,715 player-games; 649 flagged, 5.4% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 488 | 77.7% | +2.91 | **+4.93** | 1.70 |
| Projection boost: REB | 347 | 72.6% | +1.49 | **+2.11** | 1.42 |
| Projection boost: AST | 87 | 78.2% | +1.41 | **+1.92** | 1.36 |
| Projection boost: 3PM | 113 | 69.0% | +0.65 | **+0.91** | 1.40 |
| *(no flag) everyone in this group, PTS* | 7,715 | 47.9% | – | +0.72 | – |
| *(no flag) everyone in this group, REB* | 7,715 | 46.0% | – | +0.25 | – |
| *(no flag) everyone in this group, AST* | 7,715 | 45.1% | – | +0.15 | – |
| *(no flag) everyone in this group, 3PM* | 7,715 | 35.6% | – | +0.10 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 487 | 77.8% | +2.91 | **+4.94** | 1.70 |
| Projection boost: REB | 347 | 72.6% | +1.49 | **+2.11** | 1.42 |
| Projection boost: AST | 87 | 78.2% | +1.41 | **+1.92** | 1.36 |
| Projection boost: 3PM | 113 | 69.0% | +0.65 | **+0.91** | 1.40 |
| *(no flag) everyone in this group, PTS* | 6,714 | 49.5% | – | +0.95 | – |
| *(no flag) everyone in this group, REB* | 6,714 | 47.8% | – | +0.34 | – |
| *(no flag) everyone in this group, AST* | 6,714 | 46.7% | – | +0.20 | – |
| *(no flag) everyone in this group, 3PM* | 6,714 | 37.0% | – | +0.13 | – |

### Bench, 2025-26: 8,218 player-games; 547 flagged, 9.0% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 360 | 68.6% | +2.93 | **+4.42** | 1.51 |
| Projection boost: REB | 286 | 72.4% | +1.49 | **+2.37** | 1.59 |
| Projection boost: AST | 75 | 66.7% | +1.27 | **+1.83** | 1.45 |
| Projection boost: 3PM | 77 | 58.4% | +0.72 | **+0.66** | 0.92 |
| *(no flag) everyone in this group, PTS* | 8,218 | 48.5% | – | +0.80 | – |
| *(no flag) everyone in this group, REB* | 8,218 | 46.9% | – | +0.26 | – |
| *(no flag) everyone in this group, AST* | 8,218 | 45.3% | – | +0.19 | – |
| *(no flag) everyone in this group, 3PM* | 8,218 | 35.5% | – | +0.08 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 356 | 68.5% | +2.93 | **+4.43** | 1.51 |
| Projection boost: REB | 285 | 72.6% | +1.49 | **+2.39** | 1.61 |
| Projection boost: AST | 75 | 66.7% | +1.27 | **+1.83** | 1.45 |
| Projection boost: 3PM | 76 | 57.9% | +0.72 | **+0.66** | 0.91 |
| *(no flag) everyone in this group, PTS* | 7,020 | 50.4% | – | +1.06 | – |
| *(no flag) everyone in this group, REB* | 7,020 | 48.6% | – | +0.37 | – |
| *(no flag) everyone in this group, AST* | 7,020 | 46.9% | – | +0.25 | – |
| *(no flag) everyone in this group, 3PM* | 7,020 | 36.7% | – | +0.11 | – |
