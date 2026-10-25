# NBA Edges backtest

Generated 2026-10-25 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## Teammate-out settings

Squared error relative to the plain season average, averaged over PTS/REB/AST (**below 1.000 = the projection beats the average**; squared error because box scores are right-skewed and average-miss rewards the median). "Slope" is got ÷ said for points in games where someone was out (1 = right size). "Games with someone out" is the subset where the rule actually does anything. Picked on 2024-25: **minutes 0.25, usage 0.15**.

| Setting | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| old rule (everyone +70% × lost/remaining) | 1.0167 | 1.0271 | 0.45 | 1.0244 | 1.0375 | 0.33 |
| none | 0.9948 | 0.9940 | 0.88 | 0.9961 | 0.9952 | 0.55 |
| minutes 0.25, usage 0 | 0.9888 | 0.9850 | 1.32 | 0.9930 | 0.9906 | 0.79 |
| **minutes 0.25, usage 0.15** | 0.9874 | 0.9829 | 1.09 | 0.9937 | 0.9917 | 0.74 |
| minutes 0.25, usage 0.3 | 0.9903 | 0.9874 | 0.82 | 0.9985 | 0.9988 | 0.60 |
| minutes 0.25, usage 0.5 | 1.0009 | 1.0034 | 0.60 | 1.0111 | 1.0176 | 0.45 |
| minutes 0.5, usage 0 | 0.9902 | 0.9872 | 0.92 | 0.9972 | 0.9968 | 0.66 |
| minutes 0.5, usage 0.15 | 0.9936 | 0.9924 | 0.76 | 1.0028 | 1.0052 | 0.56 |
| minutes 0.5, usage 0.3 | 1.0017 | 1.0046 | 0.61 | 1.0128 | 1.0201 | 0.46 |
| minutes 0.5, usage 0.5 | 1.0198 | 1.0320 | 0.47 | 1.0329 | 1.0502 | 0.35 |
| minutes 0.75, usage 0 | 0.9992 | 1.0009 | 0.66 | 1.0087 | 1.0140 | 0.50 |
| minutes 0.75, usage 0.15 | 1.0080 | 1.0142 | 0.56 | 1.0197 | 1.0305 | 0.42 |
| minutes 0.75, usage 0.3 | 1.0220 | 1.0353 | 0.47 | 1.0356 | 1.0542 | 0.35 |
| minutes 0.75, usage 0.5 | 1.0486 | 1.0754 | 0.39 | 1.0643 | 1.0970 | 0.29 |
| minutes 1, usage 0 | 1.0158 | 1.0259 | 0.51 | 1.0274 | 1.0420 | 0.39 |
| minutes 1, usage 0.15 | 1.0307 | 1.0484 | 0.44 | 1.0445 | 1.0676 | 0.33 |
| minutes 1, usage 0.3 | 1.0511 | 1.0793 | 0.38 | 1.0670 | 1.1011 | 0.29 |
| minutes 1, usage 0.5 | 1.0872 | 1.1336 | 0.32 | 1.1051 | 1.1580 | 0.24 |

The sections below use the picked setting.

## 2024-25 (fit season)

15,512 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 154 | 72.1% | +2.56 | **+4.91** | 1.92 |
| Projection boost: REB | 18 | 72.2% | +1.19 | **+2.90** | 2.43 |
| Projection boost: AST | 7 | 71.4% | +1.11 | **+2.57** | 2.31 |
| Projection boost: 3PM | 1 | 100.0% | +0.56 | **+0.10** | 0.18 |
| *(no flag) everyone in this group, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) everyone in this group, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) everyone in this group, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) everyone in this group, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,317 | 5.377 | 5.349 | -2.0% | 1.05 ± 0.06 |
| full model | REB | 15,317 | 2.066 | 2.076 | -0.3% | 0.56 ± 0.05 |
| full model | AST | 15,317 | 1.585 | 1.583 | -1.5% | 0.78 ± 0.05 |
| full model | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.69 ± 0.08 |
| calibrated (what alerts use) | PTS | 15,317 | 5.377 | 5.333 | -2.2% | 1.52 ± 0.08 |
| calibrated (what alerts use) | REB | 15,317 | 2.066 | 2.051 | -1.2% | 1.28 ± 0.09 |
| calibrated (what alerts use) | AST | 15,317 | 1.585 | 1.574 | -2.1% | 1.43 ± 0.08 |
| calibrated (what alerts use) | 3PM | 15,317 | 1.062 | 1.065 | -0.9% | 1.38 ± 0.11 |
| without shot zones | PTS | 15,317 | 5.377 | 5.358 | -1.8% | 1.09 ± 0.06 |
| without shot zones | REB | 15,317 | 2.066 | 2.076 | -0.3% | 0.56 ± 0.05 |
| without shot zones | AST | 15,317 | 1.585 | 1.583 | -1.5% | 0.78 ± 0.05 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.83 ± 0.10 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.352 | -1.9% | 1.09 ± 0.06 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.078 | -0.0% | 0.51 ± 0.06 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.584 | -1.3% | 0.76 ± 0.05 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.067 | -0.3% | 0.67 ± 0.08 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.350 | -1.9% | 1.08 ± 0.06 |
| without game total / pace | REB | 15,317 | 2.066 | 2.076 | -0.3% | 0.56 ± 0.05 |
| without game total / pace | AST | 15,317 | 1.585 | 1.582 | -1.7% | 0.90 ± 0.05 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.72 ± 0.08 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.349 | -2.0% | 1.05 ± 0.06 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.075 | -0.3% | 0.61 ± 0.07 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.586 | -1.1% | 1.02 ± 0.08 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.69 ± 0.08 |
| without blowout trim | PTS | 15,317 | 5.377 | 5.349 | -2.0% | 1.05 ± 0.06 |
| without blowout trim | REB | 15,317 | 2.066 | 2.076 | -0.3% | 0.56 ± 0.05 |
| without blowout trim | AST | 15,317 | 1.585 | 1.583 | -1.5% | 0.78 ± 0.05 |
| without blowout trim | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.69 ± 0.08 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.366 | -0.5% | 0.85 ± 0.10 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.065 | -0.2% | 0.63 ± 0.09 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.579 | -0.9% | 0.76 ± 0.06 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.062 | -0.0% | 0.52 ± 0.12 |

## 2025-26 (out of sample)

15,818 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 200 | 63.0% | +2.65 | **+3.15** | 1.19 |
| Projection boost: REB | 6 | 66.7% | +1.17 | **+2.54** | 2.17 |
| Projection boost: AST | 11 | 45.5% | +1.24 | **+0.25** | 0.20 |
| Projection boost: 3PM | 1 | 100.0% | +0.52 | **+1.10** | 2.12 |
| *(no flag) everyone in this group, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) everyone in this group, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) everyone in this group, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) everyone in this group, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 15,530 | 5.367 | 5.353 | -1.0% | 0.70 ± 0.05 |
| full model | REB | 15,530 | 2.036 | 2.042 | -0.4% | 0.59 ± 0.05 |
| full model | AST | 15,530 | 1.583 | 1.585 | -0.4% | 0.57 ± 0.05 |
| full model | 3PM | 15,530 | 1.049 | 1.053 | -0.1% | 0.55 ± 0.07 |
| calibrated (what alerts use) | PTS | 15,530 | 5.367 | 5.320 | -2.1% | 1.15 ± 0.06 |
| calibrated (what alerts use) | REB | 15,530 | 2.036 | 2.020 | -1.7% | 1.44 ± 0.08 |
| calibrated (what alerts use) | AST | 15,530 | 1.583 | 1.575 | -1.5% | 1.05 ± 0.07 |
| calibrated (what alerts use) | 3PM | 15,530 | 1.049 | 1.052 | -0.9% | 1.22 ± 0.10 |
| without shot zones | PTS | 15,530 | 5.367 | 5.354 | -1.1% | 0.80 ± 0.06 |
| without shot zones | REB | 15,530 | 2.036 | 2.042 | -0.4% | 0.59 ± 0.05 |
| without shot zones | AST | 15,530 | 1.583 | 1.585 | -0.4% | 0.57 ± 0.05 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.053 | -0.2% | 0.64 ± 0.09 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.356 | -0.9% | 0.68 ± 0.05 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.043 | -0.3% | 0.57 ± 0.05 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.587 | -0.3% | 0.55 ± 0.05 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.054 | -0.0% | 0.52 ± 0.08 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.350 | -1.3% | 0.86 ± 0.06 |
| without game total / pace | REB | 15,530 | 2.036 | 2.042 | -0.4% | 0.59 ± 0.05 |
| without game total / pace | AST | 15,530 | 1.583 | 1.584 | -0.8% | 0.70 ± 0.06 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.055 | 0.1% | 0.43 ± 0.08 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.353 | -1.0% | 0.70 ± 0.05 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.049 | 0.1% | 0.46 ± 0.07 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.585 | -0.7% | 0.81 ± 0.07 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.053 | -0.1% | 0.55 ± 0.07 |
| without blowout trim | PTS | 15,530 | 5.367 | 5.366 | -0.6% | 0.62 ± 0.05 |
| without blowout trim | REB | 15,530 | 2.036 | 2.044 | -0.2% | 0.55 ± 0.05 |
| without blowout trim | AST | 15,530 | 1.583 | 1.587 | -0.3% | 0.54 ± 0.04 |
| without blowout trim | 3PM | 15,530 | 1.049 | 1.054 | 0.0% | 0.50 ± 0.07 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.356 | -0.1% | 0.54 ± 0.06 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.026 | -0.8% | 0.80 ± 0.07 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.577 | -0.3% | 0.56 ± 0.05 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.047 | -0.2% | 0.59 ± 0.09 |

### Games with a posted total/spread only (12,427 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PTS | 12,192 | 5.314 | 5.297 | -1.4% | 0.73 ± 0.05 |
| full model | REB | 12,192 | 2.020 | 2.025 | -0.7% | 0.62 ± 0.06 |
| full model | AST | 12,192 | 1.576 | 1.577 | -0.8% | 0.61 ± 0.05 |
| full model | 3PM | 12,192 | 1.048 | 1.053 | -0.2% | 0.58 ± 0.08 |
| without game total / pace | PTS | 12,192 | 5.314 | 5.293 | -1.7% | 0.93 ± 0.06 |
| without game total / pace | REB | 12,192 | 2.020 | 2.025 | -0.7% | 0.62 ± 0.06 |
| without game total / pace | AST | 12,192 | 1.576 | 1.576 | -1.1% | 0.77 ± 0.06 |
| without game total / pace | 3PM | 12,192 | 1.048 | 1.055 | 0.1% | 0.45 ± 0.08 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Avg miss, raw projection | Avg miss, shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PTS | 1.05 | 5.377 | 5.349 | 5.350 |
| 2024-25 | REB | 0.56 | 2.066 | 2.076 | 2.067 |
| 2024-25 | AST | 0.78 | 1.585 | 1.583 | 1.580 |
| 2024-25 | 3PM | 0.69 | 1.062 | 1.066 | 1.064 |
| 2025-26 | PTS | 1.05 | 5.367 | 5.353 | 5.356 |
| 2025-26 | REB | 0.56 | 2.036 | 2.042 | 2.034 |
| 2025-26 | AST | 0.78 | 1.583 | 1.585 | 1.581 |
| 2025-26 | 3PM | 0.69 | 1.049 | 1.053 | 1.051 |

## Prop probabilities (calibration)

The prop alert needs an honest probability, not just a projection. `model.calibrate` shrinks a starter's projected gap from his average by k, pulls every projection toward m by beta (a high season average is partly luck), and `model.sdOf` sets the spread as a + b·√projection. Fit on 2024-25, checked on the rest. Real prop lines aren't available historically, so each player-game gets a **stand-in line: his average rounded to x.5**. Books' real lines are sharper than that, so these hit rates run higher than live ones; the point is whether "the model says 70%" means 70%. "Picks" are the ones the alert would send (P_MIN 0.58, minimum gaps {"pts":2,"reb":1,"ast":1,"fg3m":0.5}). Rotation and bench players (10+ MPG) who played.

| Season | Probabilities | Said 55-60% → hit | Said 60-65% → hit | Said 65-75% → hit | Said 75%+ → hit | Picks | Pick hit rate | Log loss |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-25 (fit) | old fixed spreads, raw projection | 57.4% → 54.7% | 62.2% → 58.2% | 68.4% → 62.3% | 80.5% → 75.0% | 5,081 | 65.1% | 0.6856 |
| 2024-25 (fit) | calibrated (fit on 2024-25) | 57.2% → 57.2% | 62.1% → 60.6% | 67.8% → 66.2% | 78.7% → 79.6% | 3,918 | 69.5% | 0.6817 |
| 2025-26 | old fixed spreads, raw projection | 57.4% → 54.8% | 62.3% → 57.8% | 68.4% → 62.3% | 80.1% → 74.9% | 5,749 | 63.6% | 0.6858 |
| 2025-26 | calibrated (fit on 2024-25) | 57.3% → 56.6% | 62.2% → 61.3% | 67.6% → 64.7% | 78.9% → 87.3% | 4,370 | 67.0% | 0.6818 |

Fit on all seasons (this goes in `model.js` CAL, or set `NBA_CAL`):

```
{"pts":{"k":0.842,"m":9.37,"beta":0.931,"a":1.524,"b":1.398},"reb":{"k":0.575,"m":2.59,"beta":0.938,"a":-0.027,"b":1.233},"ast":{"k":0.666,"m":2.366,"beta":0.937,"a":-0.036,"b":1.17},"fg3m":{"k":0.612,"m":1.198,"beta":0.906,"a":-0.081,"b":1.164}}
```

## Bench players (10–20 MPG)

Same replay with players averaging 10–20 minutes also projected. Starters keep the picked setting; the bench gets its own share of a missing teammate's minutes (bench scale). Coach's-decision DNPs aren't treated as known before the game: those players are projected and count as "didn't play". Picked on 2024-25 by squared error in games where someone was out: **bench scale 0.25**.

| Bench scale | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 0.9699 | 0.9660 | 2.20 | 0.9765 | 0.9723 | 1.66 |
| **0.25** | 0.9342 | 0.9220 | 1.44 | 0.9403 | 0.9269 | 1.61 |
| 0.5 | 0.9347 | 0.9229 | 0.90 | 0.9298 | 0.9139 | 1.07 |
| 0.75 | 0.9716 | 0.9686 | 0.65 | 0.9450 | 0.9334 | 0.78 |
| 1 | 1.0447 | 1.0591 | 0.50 | 0.9860 | 0.9852 | 0.61 |
| 1.25 | 1.1540 | 1.1945 | 0.41 | 1.0527 | 1.0695 | 0.50 |

### Bench, 2024-25: 7,715 player-games; 736 flagged, 5.6% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 543 | 77.0% | +3.04 | **+4.84** | 1.59 |
| Projection boost: REB | 427 | 71.0% | +1.50 | **+1.97** | 1.31 |
| Projection boost: AST | 113 | 80.5% | +1.42 | **+1.95** | 1.38 |
| Projection boost: 3PM | 125 | 67.2% | +0.69 | **+0.91** | 1.32 |
| *(no flag) everyone in this group, PTS* | 7,715 | 47.9% | – | +0.72 | – |
| *(no flag) everyone in this group, REB* | 7,715 | 46.0% | – | +0.25 | – |
| *(no flag) everyone in this group, AST* | 7,715 | 45.1% | – | +0.15 | – |
| *(no flag) everyone in this group, 3PM* | 7,715 | 35.6% | – | +0.10 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 533 | 77.1% | +3.05 | **+4.88** | 1.60 |
| Projection boost: REB | 426 | 70.9% | +1.50 | **+1.96** | 1.30 |
| Projection boost: AST | 112 | 80.4% | +1.42 | **+1.96** | 1.38 |
| Projection boost: 3PM | 125 | 67.2% | +0.69 | **+0.91** | 1.32 |
| *(no flag) everyone in this group, PTS* | 5,756 | 51.4% | – | +1.20 | – |
| *(no flag) everyone in this group, REB* | 5,756 | 49.6% | – | +0.45 | – |
| *(no flag) everyone in this group, AST* | 5,756 | 48.1% | – | +0.27 | – |
| *(no flag) everyone in this group, 3PM* | 5,756 | 38.7% | – | +0.16 | – |

### Bench, 2025-26: 8,218 player-games; 537 flagged, 8.6% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 363 | 76.3% | +3.05 | **+5.45** | 1.79 |
| Projection boost: REB | 304 | 72.0% | +1.53 | **+2.32** | 1.52 |
| Projection boost: AST | 75 | 72.0% | +1.33 | **+2.51** | 1.89 |
| Projection boost: 3PM | 83 | 59.0% | +0.75 | **+0.68** | 0.90 |
| *(no flag) everyone in this group, PTS* | 8,218 | 48.5% | – | +0.80 | – |
| *(no flag) everyone in this group, REB* | 8,218 | 46.9% | – | +0.26 | – |
| *(no flag) everyone in this group, AST* | 8,218 | 45.3% | – | +0.19 | – |
| *(no flag) everyone in this group, 3PM* | 8,218 | 35.5% | – | +0.08 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PTS | 357 | 76.2% | +3.06 | **+5.44** | 1.78 |
| Projection boost: REB | 302 | 72.5% | +1.53 | **+2.36** | 1.54 |
| Projection boost: AST | 75 | 72.0% | +1.33 | **+2.51** | 1.89 |
| Projection boost: 3PM | 82 | 58.5% | +0.75 | **+0.67** | 0.90 |
| *(no flag) everyone in this group, PTS* | 5,974 | 52.7% | – | +1.35 | – |
| *(no flag) everyone in this group, REB* | 5,974 | 50.5% | – | +0.49 | – |
| *(no flag) everyone in this group, AST* | 5,974 | 48.6% | – | +0.31 | – |
| *(no flag) everyone in this group, 3PM* | 5,974 | 38.0% | – | +0.14 | – |
