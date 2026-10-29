# NBA Edges backtest

Generated 2026-10-29 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## Teammate-out settings

Squared error relative to the plain season average, averaged over PTS/REB/AST (**below 1.000 = the projection beats the average**; squared error because box scores are right-skewed and average-miss rewards the median). "Slope" is got ÷ said for points in games where someone was out (1 = right size). "Games with someone out" is the subset where the rule actually does anything. Picked on 2024-25: **minutes 0.25, usage 0.15**.

| Setting | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| old rule (everyone +70% × lost/remaining) | 1.0221 | 1.0326 | 0.42 | 1.0282 | 1.0413 | 0.33 |
| none | 0.9993 | 0.9981 | 0.43 | 0.9967 | 0.9942 | 0.60 |
| minutes 0.25, usage 0 | 0.9940 | 0.9901 | 0.76 | 0.9946 | 0.9910 | 0.78 |
| **minutes 0.25, usage 0.15** | 0.9928 | 0.9884 | 0.78 | 0.9959 | 0.9931 | 0.71 |
| minutes 0.25, usage 0.3 | 0.9959 | 0.9931 | 0.68 | 1.0014 | 1.0012 | 0.58 |
| minutes 0.25, usage 0.5 | 1.0066 | 1.0094 | 0.54 | 1.0149 | 1.0214 | 0.44 |
| minutes 0.5, usage 0 | 0.9963 | 0.9936 | 0.69 | 0.9999 | 0.9990 | 0.63 |
| minutes 0.5, usage 0.15 | 0.9999 | 0.9991 | 0.63 | 1.0062 | 1.0084 | 0.54 |
| minutes 0.5, usage 0.3 | 1.0082 | 1.0117 | 0.55 | 1.0170 | 1.0246 | 0.44 |
| minutes 0.5, usage 0.5 | 1.0266 | 1.0395 | 0.45 | 1.0384 | 1.0564 | 0.34 |
| minutes 0.75, usage 0 | 1.0062 | 1.0087 | 0.56 | 1.0126 | 1.0180 | 0.48 |
| minutes 0.75, usage 0.15 | 1.0153 | 1.0224 | 0.50 | 1.0245 | 1.0358 | 0.41 |
| minutes 0.75, usage 0.3 | 1.0295 | 1.0439 | 0.44 | 1.0414 | 1.0610 | 0.34 |
| minutes 0.75, usage 0.5 | 1.0564 | 1.0846 | 0.37 | 1.0715 | 1.1059 | 0.28 |
| minutes 1, usage 0 | 1.0237 | 1.0352 | 0.46 | 1.0328 | 1.0481 | 0.38 |
| minutes 1, usage 0.15 | 1.0389 | 1.0582 | 0.41 | 1.0509 | 1.0752 | 0.32 |
| minutes 1, usage 0.3 | 1.0598 | 1.0896 | 0.37 | 1.0745 | 1.1104 | 0.28 |
| minutes 1, usage 0.5 | 1.0963 | 1.1446 | 0.31 | 1.1142 | 1.1697 | 0.23 |

The sections below use the picked setting.

## 2024-25 (fit season)

15,512 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 191 | 74.3% | +3.93 | **+6.25** | 1.59 |
| Projection boost: PTS | 235 | 66.8% | +2.60 | **+3.53** | 1.36 |
| Projection boost: REB | 24 | 75.0% | +1.23 | **+3.06** | 2.48 |
| Projection boost: AST | 9 | 66.7% | +1.11 | **+1.99** | 1.79 |
| Projection boost: 3PM | 1 | 100.0% | +0.65 | **+0.10** | 0.15 |
| *(no flag) everyone in this group, PRA* | 15,317 | 48.7% | – | +0.19 | – |
| *(no flag) everyone in this group, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) everyone in this group, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) everyone in this group, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) everyone in this group, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,317 | 6.834 | 6.799 | -1.9% | 0.72 ± 0.04 |
| full model | PTS | 15,317 | 5.377 | 5.374 | -1.2% | 0.71 ± 0.05 |
| full model | REB | 15,317 | 2.066 | 2.078 | -0.2% | 0.54 ± 0.05 |
| full model | AST | 15,317 | 1.585 | 1.589 | -0.8% | 0.60 ± 0.04 |
| full model | 3PM | 15,317 | 1.062 | 1.068 | -0.3% | 0.61 ± 0.07 |
| calibrated (what alerts use) | PRA | 15,317 | 6.834 | 6.757 | -2.6% | 1.10 ± 0.05 |
| calibrated (what alerts use) | PTS | 15,317 | 5.377 | 5.345 | -1.8% | 0.99 ± 0.06 |
| calibrated (what alerts use) | REB | 15,317 | 2.066 | 2.052 | -1.2% | 1.17 ± 0.09 |
| calibrated (what alerts use) | AST | 15,317 | 1.585 | 1.575 | -1.9% | 1.12 ± 0.06 |
| calibrated (what alerts use) | 3PM | 15,317 | 1.062 | 1.065 | -1.0% | 1.24 ± 0.10 |
| without shot zones | PRA | 15,317 | 6.834 | 6.803 | -2.0% | 0.77 ± 0.04 |
| without shot zones | PTS | 15,317 | 5.377 | 5.374 | -1.3% | 0.79 ± 0.05 |
| without shot zones | REB | 15,317 | 2.066 | 2.078 | -0.2% | 0.54 ± 0.05 |
| without shot zones | AST | 15,317 | 1.585 | 1.589 | -0.8% | 0.60 ± 0.04 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.067 | -0.5% | 0.79 ± 0.08 |
| without last-10 minutes | PRA | 15,317 | 6.834 | 6.803 | -1.7% | 0.72 ± 0.04 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.376 | -1.1% | 0.70 ± 0.05 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.080 | 0.0% | 0.49 ± 0.05 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.590 | -0.6% | 0.58 ± 0.04 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.068 | -0.3% | 0.59 ± 0.07 |
| without game total / pace | PRA | 15,317 | 6.834 | 6.764 | -2.8% | 1.00 ± 0.05 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.346 | -2.0% | 1.07 ± 0.06 |
| without game total / pace | REB | 15,317 | 2.066 | 2.078 | -0.2% | 0.54 ± 0.05 |
| without game total / pace | AST | 15,317 | 1.585 | 1.582 | -1.7% | 0.87 ± 0.05 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.066 | -0.5% | 0.76 ± 0.08 |
| without opponent REB/AST allowed | PRA | 15,317 | 6.834 | 6.794 | -2.0% | 0.78 ± 0.04 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.374 | -1.2% | 0.71 ± 0.05 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.078 | -0.2% | 0.54 ± 0.06 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.587 | -1.0% | 0.83 ± 0.06 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.068 | -0.3% | 0.61 ± 0.07 |
| without blowout minutes | PRA | 15,317 | 6.834 | 6.808 | -1.6% | 0.69 ± 0.04 |
| without blowout minutes | PTS | 15,317 | 5.377 | 5.381 | -0.9% | 0.66 ± 0.05 |
| without blowout minutes | REB | 15,317 | 2.066 | 2.076 | -0.3% | 0.56 ± 0.05 |
| without blowout minutes | AST | 15,317 | 1.585 | 1.589 | -0.7% | 0.59 ± 0.04 |
| without blowout minutes | 3PM | 15,317 | 1.062 | 1.069 | -0.2% | 0.56 ± 0.07 |
| without teammate-out boost | PRA | 15,317 | 6.834 | 6.835 | -0.0% | 0.51 ± 0.05 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.389 | 0.3% | 0.41 ± 0.06 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.065 | -0.3% | 0.64 ± 0.08 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.584 | -0.2% | 0.54 ± 0.05 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.064 | 0.0% | 0.48 ± 0.09 |

### Games with a posted total/spread only (15,463 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,275 | 6.780 | 6.745 | -2.0% | 0.73 ± 0.04 |
| full model | PTS | 15,275 | 5.343 | 5.340 | -1.3% | 0.72 ± 0.05 |
| full model | REB | 15,275 | 2.059 | 2.071 | -0.2% | 0.54 ± 0.05 |
| full model | AST | 15,275 | 1.578 | 1.582 | -0.8% | 0.61 ± 0.04 |
| full model | 3PM | 15,275 | 1.060 | 1.066 | -0.3% | 0.62 ± 0.07 |
| without game total / pace | PRA | 15,275 | 6.780 | 6.710 | -3.0% | 1.01 ± 0.05 |
| without game total / pace | PTS | 15,275 | 5.343 | 5.312 | -2.1% | 1.08 ± 0.06 |
| without game total / pace | REB | 15,275 | 2.059 | 2.071 | -0.2% | 0.54 ± 0.05 |
| without game total / pace | AST | 15,275 | 1.578 | 1.575 | -1.7% | 0.88 ± 0.05 |
| without game total / pace | 3PM | 15,275 | 1.060 | 1.064 | -0.5% | 0.77 ± 0.08 |

## 2025-26 (out of sample)

15,818 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 175 | 70.3% | +3.98 | **+5.50** | 1.38 |
| Projection boost: PTS | 249 | 64.7% | +2.66 | **+3.17** | 1.19 |
| Projection boost: REB | 8 | 62.5% | +1.12 | **+0.92** | 0.82 |
| Projection boost: AST | 13 | 46.2% | +1.23 | **+0.30** | 0.24 |
| Projection boost: 3PM | 1 | 100.0% | +0.52 | **+1.10** | 2.11 |
| *(no flag) everyone in this group, PRA* | 15,530 | 47.1% | – | -0.25 | – |
| *(no flag) everyone in this group, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) everyone in this group, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) everyone in this group, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) everyone in this group, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,530 | 6.829 | 6.814 | -1.3% | 0.65 ± 0.04 |
| full model | PTS | 15,530 | 5.367 | 5.364 | -0.8% | 0.64 ± 0.05 |
| full model | REB | 15,530 | 2.036 | 2.045 | -0.2% | 0.55 ± 0.05 |
| full model | AST | 15,530 | 1.583 | 1.589 | -0.2% | 0.52 ± 0.04 |
| full model | 3PM | 15,530 | 1.049 | 1.055 | 0.1% | 0.48 ± 0.07 |
| calibrated (what alerts use) | PRA | 15,530 | 6.829 | 6.744 | -3.0% | 1.16 ± 0.05 |
| calibrated (what alerts use) | PTS | 15,530 | 5.367 | 5.321 | -2.1% | 1.04 ± 0.06 |
| calibrated (what alerts use) | REB | 15,530 | 2.036 | 2.021 | -1.7% | 1.41 ± 0.08 |
| calibrated (what alerts use) | AST | 15,530 | 1.583 | 1.576 | -1.4% | 0.98 ± 0.07 |
| calibrated (what alerts use) | 3PM | 15,530 | 1.049 | 1.053 | -0.9% | 1.16 ± 0.10 |
| without shot zones | PRA | 15,530 | 6.829 | 6.808 | -1.4% | 0.70 ± 0.04 |
| without shot zones | PTS | 15,530 | 5.367 | 5.364 | -0.9% | 0.72 ± 0.05 |
| without shot zones | REB | 15,530 | 2.036 | 2.045 | -0.2% | 0.55 ± 0.05 |
| without shot zones | AST | 15,530 | 1.583 | 1.589 | -0.2% | 0.52 ± 0.04 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.055 | -0.1% | 0.54 ± 0.09 |
| without last-10 minutes | PRA | 15,530 | 6.829 | 6.823 | -1.0% | 0.64 ± 0.04 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.367 | -0.6% | 0.62 ± 0.05 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.046 | -0.1% | 0.53 ± 0.05 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.591 | -0.0% | 0.51 ± 0.04 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.055 | 0.1% | 0.45 ± 0.07 |
| without game total / pace | PRA | 15,530 | 6.829 | 6.792 | -1.8% | 0.80 ± 0.05 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.357 | -1.2% | 0.82 ± 0.06 |
| without game total / pace | REB | 15,530 | 2.036 | 2.045 | -0.2% | 0.55 ± 0.05 |
| without game total / pace | AST | 15,530 | 1.583 | 1.586 | -0.7% | 0.67 ± 0.06 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.056 | 0.2% | 0.41 ± 0.07 |
| without opponent REB/AST allowed | PRA | 15,530 | 6.829 | 6.811 | -1.4% | 0.71 ± 0.04 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.364 | -0.8% | 0.64 ± 0.05 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.053 | 0.3% | 0.39 ± 0.06 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.588 | -0.6% | 0.70 ± 0.07 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.055 | 0.1% | 0.48 ± 0.07 |
| without blowout minutes | PRA | 15,530 | 6.829 | 6.833 | -0.8% | 0.59 ± 0.04 |
| without blowout minutes | PTS | 15,530 | 5.367 | 5.373 | -0.4% | 0.56 ± 0.05 |
| without blowout minutes | REB | 15,530 | 2.036 | 2.044 | -0.2% | 0.55 ± 0.05 |
| without blowout minutes | AST | 15,530 | 1.583 | 1.589 | -0.0% | 0.50 ± 0.04 |
| without blowout minutes | 3PM | 15,530 | 1.049 | 1.055 | 0.2% | 0.44 ± 0.07 |
| without teammate-out boost | PRA | 15,530 | 6.829 | 6.817 | -0.6% | 0.62 ± 0.05 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.361 | -0.1% | 0.52 ± 0.06 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.027 | -0.8% | 0.80 ± 0.07 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.580 | -0.1% | 0.53 ± 0.05 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.048 | -0.1% | 0.53 ± 0.08 |

### Games with a posted total/spread only (15,741 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,456 | 6.742 | 6.721 | -1.8% | 0.70 ± 0.04 |
| full model | PTS | 15,456 | 5.310 | 5.303 | -1.1% | 0.69 ± 0.05 |
| full model | REB | 15,456 | 2.025 | 2.033 | -0.4% | 0.58 ± 0.05 |
| full model | AST | 15,456 | 1.573 | 1.578 | -0.3% | 0.55 ± 0.04 |
| full model | 3PM | 15,456 | 1.047 | 1.052 | 0.0% | 0.50 ± 0.07 |
| without game total / pace | PRA | 15,456 | 6.742 | 6.699 | -2.3% | 0.87 ± 0.05 |
| without game total / pace | PTS | 15,456 | 5.310 | 5.296 | -1.6% | 0.90 ± 0.06 |
| without game total / pace | REB | 15,456 | 2.025 | 2.033 | -0.4% | 0.58 ± 0.05 |
| without game total / pace | AST | 15,456 | 1.573 | 1.575 | -0.8% | 0.70 ± 0.06 |
| without game total / pace | 3PM | 15,456 | 1.047 | 1.054 | 0.2% | 0.43 ± 0.07 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Avg miss, raw projection | Avg miss, shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PRA | 0.72 | 6.834 | 6.799 | 6.781 |
| 2024-25 | PTS | 0.71 | 5.377 | 5.374 | 5.359 |
| 2024-25 | REB | 0.54 | 2.066 | 2.078 | 2.067 |
| 2024-25 | AST | 0.60 | 1.585 | 1.589 | 1.581 |
| 2024-25 | 3PM | 0.61 | 1.062 | 1.068 | 1.064 |
| 2025-26 | PRA | 0.72 | 6.829 | 6.814 | 6.789 |
| 2025-26 | PTS | 0.71 | 5.367 | 5.364 | 5.348 |
| 2025-26 | REB | 0.54 | 2.036 | 2.045 | 2.035 |
| 2025-26 | AST | 0.60 | 1.583 | 1.589 | 1.581 |
| 2025-26 | 3PM | 0.61 | 1.049 | 1.055 | 1.051 |

## Prop probabilities (calibration)

The prop alert needs an honest probability, not just a projection. `model.calibrate` shrinks a starter's projected gap from his average by k, pulls every projection toward m by beta (a high season average is partly luck), and `model.sdOf` sets the spread as a + b·√projection. Fit on 2024-25, checked on the rest. Real prop lines aren't available historically, so each player-game gets a **stand-in line: his average rounded to x.5**. Books' real lines are sharper than that, so these hit rates run higher than live ones; the point is whether "the model says 70%" means 70%. "Picks" are the ones the alert would send (P_MIN 0.58, minimum gaps {"pra":3,"pts":2,"reb":1,"ast":1,"fg3m":0.5}). Rotation and bench players (10+ MPG) who played.

| Season | Probabilities | Said 55-60% → hit | Said 60-65% → hit | Said 65-75% → hit | Said 75%+ → hit | Picks | Pick hit rate | Log loss |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-25 (fit) | old fixed spreads, raw projection (PTS/REB/AST/3PM) | 57.4% → 53.9% | 62.3% → 57.1% | 68.6% → 60.2% | 80.5% → 72.5% | 7,152 | 62.5% | 0.6897 |
| 2024-25 (fit) | calibrated (fit on 2024-25) (PTS/REB/AST/3PM) | 57.2% → 56.7% | 62.1% → 59.9% | 67.9% → 65.0% | 79.2% → 78.6% | 4,475 | 68.2% | 0.6829 |
| 2024-25 (fit) | calibrated (fit on 2024-25) **PRA** | 57.1% → 55.6% | 62.1% → 60.2% | 68.6% → 72.4% | 81.1% → 85.6% | 1,199 | 73.1% | 0.6820 |
| 2025-26 | old fixed spreads, raw projection (PTS/REB/AST/3PM) | 57.4% → 54.2% | 62.3% → 56.7% | 68.5% → 61.3% | 80.3% → 72.8% | 6,808 | 62.9% | 0.6881 |
| 2025-26 | calibrated (fit on 2024-25) (PTS/REB/AST/3PM) | 57.3% → 56.6% | 62.1% → 61.1% | 67.7% → 64.4% | 79.2% → 85.2% | 4,113 | 68.3% | 0.6820 |
| 2025-26 | calibrated (fit on 2024-25) **PRA** | 57.1% → 56.8% | 61.9% → 60.2% | 68.4% → 75.7% | 81.1% → 89.2% | 1,042 | 75.1% | 0.6814 |

Fit on all seasons (this goes in `model.js` CAL, or set `NBA_CAL`):

```
{"pra":{"k":0.689,"m":10.618,"beta":0.95,"a":3.563,"b":1.065},"pts":{"k":0.672,"m":8.482,"beta":0.938,"a":1.504,"b":1.406},"reb":{"k":0.541,"m":2.079,"beta":0.939,"a":-0.046,"b":1.243},"ast":{"k":0.566,"m":2.156,"beta":0.938,"a":-0.04,"b":1.174},"fg3m":{"k":0.548,"m":1.12,"beta":0.907,"a":-0.081,"b":1.164}}
```

## Bench players (10–20 MPG)

Same replay with players averaging 10–20 minutes also projected. Starters keep the picked setting; the bench gets its own share of a missing teammate's minutes (bench scale). Coach's-decision DNPs aren't treated as known before the game: those players are projected and count as "didn't play". Picked on 2024-25 by squared error in games where someone was out: **bench scale 0.25**.

| Bench scale | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 0.9681 | 0.9613 | 1.57 | 0.9662 | 0.9570 | 1.94 |
| **0.25** | 0.9403 | 0.9271 | 1.14 | 0.9358 | 0.9191 | 1.43 |
| 0.5 | 0.9515 | 0.9412 | 0.77 | 0.9334 | 0.9163 | 0.97 |
| 0.75 | 1.0017 | 1.0036 | 0.58 | 0.9590 | 0.9487 | 0.72 |
| 1 | 1.0910 | 1.1141 | 0.46 | 1.0124 | 1.0163 | 0.57 |
| 1.25 | 1.2193 | 1.2728 | 0.38 | 1.0938 | 1.1191 | 0.47 |

### Bench, 2024-25: 7,715 player-games; 1253 flagged, 7.3% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 980 | 73.0% | +4.64 | **+5.91** | 1.27 |
| Projection boost: PTS | 794 | 71.8% | +3.03 | **+3.88** | 1.28 |
| Projection boost: REB | 699 | 66.8% | +1.55 | **+1.57** | 1.01 |
| Projection boost: AST | 140 | 80.7% | +1.48 | **+2.13** | 1.44 |
| Projection boost: 3PM | 169 | 66.3% | +0.71 | **+0.76** | 1.06 |
| *(no flag) everyone in this group, PRA* | 7,715 | 49.7% | – | +1.12 | – |
| *(no flag) everyone in this group, PTS* | 7,715 | 47.9% | – | +0.72 | – |
| *(no flag) everyone in this group, REB* | 7,715 | 46.0% | – | +0.25 | – |
| *(no flag) everyone in this group, AST* | 7,715 | 45.1% | – | +0.15 | – |
| *(no flag) everyone in this group, 3PM* | 7,715 | 35.6% | – | +0.10 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 964 | 72.7% | +4.65 | **+5.92** | 1.27 |
| Projection boost: PTS | 782 | 71.7% | +3.04 | **+3.90** | 1.29 |
| Projection boost: REB | 693 | 66.7% | +1.56 | **+1.57** | 1.01 |
| Projection boost: AST | 137 | 81.8% | +1.49 | **+2.18** | 1.47 |
| Projection boost: 3PM | 168 | 66.1% | +0.71 | **+0.75** | 1.06 |
| *(no flag) everyone in this group, PRA* | 5,756 | 53.9% | – | +1.92 | – |
| *(no flag) everyone in this group, PTS* | 5,756 | 51.4% | – | +1.20 | – |
| *(no flag) everyone in this group, REB* | 5,756 | 49.6% | – | +0.45 | – |
| *(no flag) everyone in this group, AST* | 5,756 | 48.1% | – | +0.27 | – |
| *(no flag) everyone in this group, 3PM* | 5,756 | 38.7% | – | +0.16 | – |

### Bench, 2025-26: 8,218 player-games; 930 flagged, 8.5% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 731 | 78.5% | +4.57 | **+7.24** | 1.58 |
| Projection boost: PTS | 584 | 76.4% | +2.98 | **+5.05** | 1.69 |
| Projection boost: REB | 493 | 69.2% | +1.57 | **+1.86** | 1.18 |
| Projection boost: AST | 120 | 72.5% | +1.30 | **+2.16** | 1.66 |
| Projection boost: 3PM | 120 | 57.5% | +0.74 | **+0.74** | 1.00 |
| *(no flag) everyone in this group, PRA* | 8,218 | 50.4% | – | +1.25 | – |
| *(no flag) everyone in this group, PTS* | 8,218 | 48.5% | – | +0.80 | – |
| *(no flag) everyone in this group, REB* | 8,218 | 46.9% | – | +0.26 | – |
| *(no flag) everyone in this group, AST* | 8,218 | 45.3% | – | +0.19 | – |
| *(no flag) everyone in this group, 3PM* | 8,218 | 35.5% | – | +0.08 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 724 | 78.7% | +4.58 | **+7.25** | 1.58 |
| Projection boost: PTS | 578 | 76.3% | +2.99 | **+5.04** | 1.69 |
| Projection boost: REB | 490 | 69.4% | +1.57 | **+1.88** | 1.20 |
| Projection boost: AST | 120 | 72.5% | +1.30 | **+2.16** | 1.66 |
| Projection boost: 3PM | 119 | 57.1% | +0.74 | **+0.74** | 1.00 |
| *(no flag) everyone in this group, PRA* | 5,974 | 55.2% | – | +2.15 | – |
| *(no flag) everyone in this group, PTS* | 5,974 | 52.7% | – | +1.35 | – |
| *(no flag) everyone in this group, REB* | 5,974 | 50.5% | – | +0.49 | – |
| *(no flag) everyone in this group, AST* | 5,974 | 48.6% | – | +0.31 | – |
| *(no flag) everyone in this group, 3PM* | 5,974 | 38.0% | – | +0.14 | – |
