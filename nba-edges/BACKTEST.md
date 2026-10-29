# NBA Edges backtest

Generated 2026-10-29 by `node nba-edges/backtest.js`. The bot's own scoring code (`run.js` projectSide/flagRows) replayed over whole regular seasons with **no look-ahead**: stats are season-to-date as of the day before each weekly bucket, blended with the prior season like the live bot.

**How to read it.** "Error" is the average miss in that stat per player-game. The projection has to beat simply using the player's season average. The **slope** asks: when the model says "+2 over his average", how much of that shows up? 1.00 means it's the right size, 0.50 means the real effect is half as big, and 0 means it's noise. **Got ÷ said** is the same idea for the picks the bot would actually alert on.

**Caveats.** (1) ESPN keeps only *current* injury lists, so "ruled out" is "a regular who didn't play". That's slightly optimistic, because real late scratches are known here. (2) Spreads/totals exist only from Dec 2025 on, so earlier games use the bot's pace fallback. (3) Prop lines aren't available historically, so this can't say whether the bot beats the sportsbooks, only whether its projections beat the player's average.

## Teammate-out settings

Squared error relative to the plain season average, averaged over PTS/REB/AST (**below 1.000 = the projection beats the average**; squared error because box scores are right-skewed and average-miss rewards the median). "Slope" is got ÷ said for points in games where someone was out (1 = right size). "Games with someone out" is the subset where the rule actually does anything. Picked on 2024-25: **minutes 0.25, usage 0**.

| Setting | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| old rule (everyone +70% × lost/remaining) | 1.0171 | 1.0314 | 0.45 | 1.0100 | 1.0269 | 0.44 |
| none | 0.9826 | 0.9793 | 0.69 | 0.9715 | 0.9694 | 0.83 |
| **minutes 0.25, usage 0** | 0.9805 | 0.9761 | 0.73 | 0.9713 | 0.9691 | 0.82 |
| minutes 0.25, usage 0.15 | 0.9816 | 0.9778 | 0.70 | 0.9741 | 0.9733 | 0.75 |
| minutes 0.25, usage 0.3 | 0.9872 | 0.9863 | 0.63 | 0.9810 | 0.9837 | 0.65 |
| minutes 0.25, usage 0.5 | 1.0016 | 1.0082 | 0.53 | 0.9969 | 1.0074 | 0.52 |
| minutes 0.5, usage 0 | 0.9867 | 0.9856 | 0.64 | 0.9790 | 0.9807 | 0.69 |
| minutes 0.5, usage 0.15 | 0.9932 | 0.9954 | 0.59 | 0.9872 | 0.9929 | 0.61 |
| minutes 0.5, usage 0.3 | 1.0046 | 1.0127 | 0.53 | 1.0000 | 1.0119 | 0.52 |
| minutes 0.5, usage 0.5 | 1.0275 | 1.0473 | 0.44 | 1.0242 | 1.0482 | 0.42 |
| minutes 0.75, usage 0 | 1.0012 | 1.0076 | 0.54 | 0.9947 | 1.0041 | 0.56 |
| minutes 0.75, usage 0.15 | 1.0139 | 1.0267 | 0.49 | 1.0089 | 1.0253 | 0.49 |
| minutes 0.75, usage 0.3 | 1.0319 | 1.0539 | 0.44 | 1.0282 | 1.0542 | 0.42 |
| minutes 0.75, usage 0.5 | 1.0644 | 1.1030 | 0.38 | 1.0620 | 1.1045 | 0.35 |
| minutes 1, usage 0 | 1.0242 | 1.0423 | 0.46 | 1.0183 | 1.0394 | 0.46 |
| minutes 1, usage 0.15 | 1.0436 | 1.0717 | 0.41 | 1.0393 | 1.0707 | 0.40 |
| minutes 1, usage 0.3 | 1.0691 | 1.1100 | 0.37 | 1.0659 | 1.1104 | 0.35 |
| minutes 1, usage 0.5 | 1.1123 | 1.1752 | 0.32 | 1.1101 | 1.1764 | 0.29 |

The sections below use the picked setting.

## 2024-25 (fit season)

15,512 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 702 | 68.9% | +4.11 | **+4.79** | 1.16 |
| Projection boost: PTS | 527 | 65.3% | +2.70 | **+3.51** | 1.30 |
| Projection boost: REB | 148 | 62.8% | +1.38 | **+1.96** | 1.42 |
| Projection boost: AST | 81 | 64.2% | +1.23 | **+1.36** | 1.11 |
| Projection boost: 3PM | 24 | 62.5% | +0.58 | **+1.06** | 1.82 |
| *(no flag) everyone in this group, PRA* | 15,317 | 48.7% | – | +0.19 | – |
| *(no flag) everyone in this group, PTS* | 15,317 | 47.8% | – | +0.16 | – |
| *(no flag) everyone in this group, REB* | 15,317 | 45.0% | – | -0.02 | – |
| *(no flag) everyone in this group, AST* | 15,317 | 45.5% | – | +0.04 | – |
| *(no flag) everyone in this group, 3PM* | 15,317 | 39.9% | – | +0.02 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,317 | 6.834 | 6.704 | -3.7% | 0.72 ± 0.03 |
| full model | PTS | 15,317 | 5.377 | 5.329 | -2.1% | 0.69 ± 0.03 |
| full model | REB | 15,317 | 2.066 | 2.059 | -1.8% | 0.66 ± 0.03 |
| full model | AST | 15,317 | 1.585 | 1.576 | -2.0% | 0.68 ± 0.03 |
| full model | 3PM | 15,317 | 1.062 | 1.065 | -0.6% | 0.61 ± 0.05 |
| calibrated (what alerts use) | PRA | 15,317 | 6.834 | 6.665 | -4.5% | 1.00 ± 0.04 |
| calibrated (what alerts use) | PTS | 15,317 | 5.377 | 5.298 | -2.8% | 0.99 ± 0.05 |
| calibrated (what alerts use) | REB | 15,317 | 2.066 | 2.033 | -2.7% | 1.04 ± 0.05 |
| calibrated (what alerts use) | AST | 15,317 | 1.585 | 1.563 | -2.9% | 1.05 ± 0.05 |
| calibrated (what alerts use) | 3PM | 15,317 | 1.062 | 1.061 | -1.3% | 1.06 ± 0.07 |
| without shot zones | PRA | 15,317 | 6.834 | 6.704 | -3.8% | 0.74 ± 0.03 |
| without shot zones | PTS | 15,317 | 5.377 | 5.328 | -2.2% | 0.73 ± 0.04 |
| without shot zones | REB | 15,317 | 2.066 | 2.059 | -1.8% | 0.66 ± 0.03 |
| without shot zones | AST | 15,317 | 1.585 | 1.576 | -2.0% | 0.68 ± 0.03 |
| without shot zones | 3PM | 15,317 | 1.062 | 1.063 | -0.8% | 0.69 ± 0.06 |
| without last-10 minutes | PRA | 15,317 | 6.834 | 6.703 | -3.7% | 0.73 ± 0.03 |
| without last-10 minutes | PTS | 15,317 | 5.377 | 5.329 | -2.1% | 0.70 ± 0.03 |
| without last-10 minutes | REB | 15,317 | 2.066 | 2.058 | -1.8% | 0.67 ± 0.03 |
| without last-10 minutes | AST | 15,317 | 1.585 | 1.577 | -1.9% | 0.68 ± 0.03 |
| without last-10 minutes | 3PM | 15,317 | 1.062 | 1.064 | -0.6% | 0.61 ± 0.05 |
| without last-3 minutes | PRA | 15,317 | 6.834 | 6.789 | -1.7% | 0.77 ± 0.05 |
| without last-3 minutes | PTS | 15,317 | 5.377 | 5.369 | -0.9% | 0.71 ± 0.05 |
| without last-3 minutes | REB | 15,317 | 2.066 | 2.067 | -0.6% | 0.68 ± 0.06 |
| without last-3 minutes | AST | 15,317 | 1.585 | 1.584 | -0.8% | 0.63 ± 0.04 |
| without last-3 minutes | 3PM | 15,317 | 1.062 | 1.064 | -0.5% | 0.71 ± 0.08 |
| without return factors (back / star back) | PRA | 15,317 | 6.834 | 6.718 | -3.4% | 0.70 ± 0.03 |
| without return factors (back / star back) | PTS | 15,317 | 5.377 | 5.339 | -1.8% | 0.67 ± 0.03 |
| without return factors (back / star back) | REB | 15,317 | 2.066 | 2.063 | -1.6% | 0.65 ± 0.03 |
| without return factors (back / star back) | AST | 15,317 | 1.585 | 1.579 | -1.7% | 0.66 ± 0.03 |
| without return factors (back / star back) | 3PM | 15,317 | 1.062 | 1.066 | -0.4% | 0.57 ± 0.05 |
| without game total / pace | PRA | 15,317 | 6.834 | 6.676 | -4.5% | 0.82 ± 0.03 |
| without game total / pace | PTS | 15,317 | 5.377 | 5.303 | -2.8% | 0.82 ± 0.04 |
| without game total / pace | REB | 15,317 | 2.066 | 2.059 | -1.8% | 0.66 ± 0.03 |
| without game total / pace | AST | 15,317 | 1.585 | 1.570 | -2.7% | 0.85 ± 0.04 |
| without game total / pace | 3PM | 15,317 | 1.062 | 1.063 | -0.7% | 0.67 ± 0.05 |
| without opponent REB/AST allowed | PRA | 15,317 | 6.834 | 6.699 | -3.8% | 0.75 ± 0.03 |
| without opponent REB/AST allowed | PTS | 15,317 | 5.377 | 5.329 | -2.1% | 0.69 ± 0.03 |
| without opponent REB/AST allowed | REB | 15,317 | 2.066 | 2.057 | -1.8% | 0.68 ± 0.04 |
| without opponent REB/AST allowed | AST | 15,317 | 1.585 | 1.574 | -2.1% | 0.83 ± 0.04 |
| without opponent REB/AST allowed | 3PM | 15,317 | 1.062 | 1.065 | -0.6% | 0.61 ± 0.05 |
| without blowout minutes | PRA | 15,317 | 6.834 | 6.712 | -3.5% | 0.71 ± 0.03 |
| without blowout minutes | PTS | 15,317 | 5.377 | 5.336 | -1.8% | 0.67 ± 0.03 |
| without blowout minutes | REB | 15,317 | 2.066 | 2.057 | -1.9% | 0.68 ± 0.03 |
| without blowout minutes | AST | 15,317 | 1.585 | 1.577 | -1.9% | 0.68 ± 0.03 |
| without blowout minutes | 3PM | 15,317 | 1.062 | 1.065 | -0.4% | 0.58 ± 0.05 |
| without teammate-out boost | PRA | 15,317 | 6.834 | 6.718 | -2.9% | 0.71 ± 0.03 |
| without teammate-out boost | PTS | 15,317 | 5.377 | 5.331 | -1.5% | 0.66 ± 0.04 |
| without teammate-out boost | REB | 15,317 | 2.066 | 2.051 | -2.0% | 0.74 ± 0.04 |
| without teammate-out boost | AST | 15,317 | 1.585 | 1.573 | -1.8% | 0.69 ± 0.04 |
| without teammate-out boost | 3PM | 15,317 | 1.062 | 1.062 | -0.4% | 0.60 ± 0.06 |

### Games with a posted total/spread only (15,463 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,275 | 6.780 | 6.650 | -3.9% | 0.72 ± 0.03 |
| full model | PTS | 15,275 | 5.343 | 5.295 | -2.2% | 0.69 ± 0.03 |
| full model | REB | 15,275 | 2.059 | 2.052 | -1.8% | 0.66 ± 0.03 |
| full model | AST | 15,275 | 1.578 | 1.570 | -2.0% | 0.68 ± 0.03 |
| full model | 3PM | 15,275 | 1.060 | 1.063 | -0.6% | 0.61 ± 0.05 |
| without game total / pace | PRA | 15,275 | 6.780 | 6.622 | -4.7% | 0.82 ± 0.03 |
| without game total / pace | PTS | 15,275 | 5.343 | 5.269 | -2.9% | 0.82 ± 0.04 |
| without game total / pace | REB | 15,275 | 2.059 | 2.052 | -1.8% | 0.66 ± 0.03 |
| without game total / pace | AST | 15,275 | 1.578 | 1.563 | -2.8% | 0.85 ± 0.04 |
| without game total / pace | 3PM | 15,275 | 1.060 | 1.061 | -0.8% | 0.68 ± 0.05 |

## 2025-26 (out of sample)

15,818 player-games (rotation players, 20+ min/g, who played).

### Alert flags

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 654 | 71.4% | +4.03 | **+5.14** | 1.28 |
| Projection boost: PTS | 510 | 66.7% | +2.65 | **+3.48** | 1.32 |
| Projection boost: REB | 142 | 70.4% | +1.29 | **+1.62** | 1.25 |
| Projection boost: AST | 63 | 69.8% | +1.24 | **+1.57** | 1.27 |
| Projection boost: 3PM | 22 | 63.6% | +0.60 | **+0.44** | 0.73 |
| *(no flag) everyone in this group, PRA* | 15,530 | 47.1% | – | -0.25 | – |
| *(no flag) everyone in this group, PTS* | 15,530 | 46.3% | – | -0.15 | – |
| *(no flag) everyone in this group, REB* | 15,530 | 44.4% | – | -0.10 | – |
| *(no flag) everyone in this group, AST* | 15,530 | 44.5% | – | -0.00 | – |
| *(no flag) everyone in this group, 3PM* | 15,530 | 38.8% | – | -0.03 | – |

### Projection accuracy, with each piece removed in turn

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,530 | 6.829 | 6.651 | -5.6% | 0.81 ± 0.03 |
| full model | PTS | 15,530 | 5.367 | 5.279 | -3.5% | 0.79 ± 0.03 |
| full model | REB | 15,530 | 2.036 | 2.019 | -2.1% | 0.68 ± 0.03 |
| full model | AST | 15,530 | 1.583 | 1.566 | -2.9% | 0.77 ± 0.03 |
| full model | 3PM | 15,530 | 1.049 | 1.046 | -0.9% | 0.68 ± 0.05 |
| calibrated (what alerts use) | PRA | 15,530 | 6.829 | 6.604 | -6.5% | 1.13 ± 0.03 |
| calibrated (what alerts use) | PTS | 15,530 | 5.367 | 5.249 | -4.3% | 1.14 ± 0.04 |
| calibrated (what alerts use) | REB | 15,530 | 2.036 | 1.996 | -3.4% | 1.11 ± 0.05 |
| calibrated (what alerts use) | AST | 15,530 | 1.583 | 1.557 | -3.5% | 1.11 ± 0.05 |
| calibrated (what alerts use) | 3PM | 15,530 | 1.049 | 1.045 | -1.7% | 1.16 ± 0.07 |
| without shot zones | PRA | 15,530 | 6.829 | 6.643 | -5.7% | 0.84 ± 0.03 |
| without shot zones | PTS | 15,530 | 5.367 | 5.279 | -3.7% | 0.85 ± 0.03 |
| without shot zones | REB | 15,530 | 2.036 | 2.019 | -2.1% | 0.68 ± 0.03 |
| without shot zones | AST | 15,530 | 1.583 | 1.566 | -2.9% | 0.77 ± 0.03 |
| without shot zones | 3PM | 15,530 | 1.049 | 1.046 | -1.1% | 0.77 ± 0.06 |
| without last-10 minutes | PRA | 15,530 | 6.829 | 6.650 | -5.6% | 0.82 ± 0.03 |
| without last-10 minutes | PTS | 15,530 | 5.367 | 5.278 | -3.6% | 0.80 ± 0.03 |
| without last-10 minutes | REB | 15,530 | 2.036 | 2.019 | -2.1% | 0.69 ± 0.03 |
| without last-10 minutes | AST | 15,530 | 1.583 | 1.566 | -3.0% | 0.77 ± 0.03 |
| without last-10 minutes | 3PM | 15,530 | 1.049 | 1.046 | -1.0% | 0.69 ± 0.05 |
| without last-3 minutes | PRA | 15,530 | 6.829 | 6.776 | -1.9% | 0.79 ± 0.04 |
| without last-3 minutes | PTS | 15,530 | 5.367 | 5.344 | -1.1% | 0.73 ± 0.05 |
| without last-3 minutes | REB | 15,530 | 2.036 | 2.030 | -1.0% | 0.76 ± 0.06 |
| without last-3 minutes | AST | 15,530 | 1.583 | 1.583 | -0.4% | 0.57 ± 0.05 |
| without last-3 minutes | 3PM | 15,530 | 1.049 | 1.050 | -0.3% | 0.63 ± 0.08 |
| without return factors (back / star back) | PRA | 15,530 | 6.829 | 6.673 | -5.1% | 0.79 ± 0.03 |
| without return factors (back / star back) | PTS | 15,530 | 5.367 | 5.291 | -3.2% | 0.77 ± 0.03 |
| without return factors (back / star back) | REB | 15,530 | 2.036 | 2.024 | -1.8% | 0.66 ± 0.03 |
| without return factors (back / star back) | AST | 15,530 | 1.583 | 1.568 | -2.8% | 0.76 ± 0.03 |
| without return factors (back / star back) | 3PM | 15,530 | 1.049 | 1.047 | -0.8% | 0.66 ± 0.05 |
| without game total / pace | PRA | 15,530 | 6.829 | 6.631 | -6.1% | 0.89 ± 0.03 |
| without game total / pace | PTS | 15,530 | 5.367 | 5.269 | -4.0% | 0.88 ± 0.03 |
| without game total / pace | REB | 15,530 | 2.036 | 2.019 | -2.1% | 0.68 ± 0.03 |
| without game total / pace | AST | 15,530 | 1.583 | 1.563 | -3.5% | 0.92 ± 0.04 |
| without game total / pace | 3PM | 15,530 | 1.049 | 1.047 | -0.8% | 0.66 ± 0.05 |
| without opponent REB/AST allowed | PRA | 15,530 | 6.829 | 6.647 | -5.7% | 0.84 ± 0.03 |
| without opponent REB/AST allowed | PTS | 15,530 | 5.367 | 5.279 | -3.5% | 0.79 ± 0.03 |
| without opponent REB/AST allowed | REB | 15,530 | 2.036 | 2.028 | -1.4% | 0.64 ± 0.04 |
| without opponent REB/AST allowed | AST | 15,530 | 1.583 | 1.564 | -3.4% | 0.98 ± 0.04 |
| without opponent REB/AST allowed | 3PM | 15,530 | 1.049 | 1.046 | -0.9% | 0.68 ± 0.05 |
| without blowout minutes | PRA | 15,530 | 6.829 | 6.667 | -5.2% | 0.79 ± 0.03 |
| without blowout minutes | PTS | 15,530 | 5.367 | 5.288 | -3.2% | 0.76 ± 0.03 |
| without blowout minutes | REB | 15,530 | 2.036 | 2.018 | -2.2% | 0.70 ± 0.03 |
| without blowout minutes | AST | 15,530 | 1.583 | 1.565 | -2.8% | 0.76 ± 0.03 |
| without blowout minutes | 3PM | 15,530 | 1.049 | 1.046 | -0.9% | 0.67 ± 0.05 |
| without teammate-out boost | PRA | 15,530 | 6.829 | 6.650 | -5.1% | 0.83 ± 0.03 |
| without teammate-out boost | PTS | 15,530 | 5.367 | 5.276 | -3.1% | 0.79 ± 0.03 |
| without teammate-out boost | REB | 15,530 | 2.036 | 2.008 | -2.5% | 0.76 ± 0.04 |
| without teammate-out boost | AST | 15,530 | 1.583 | 1.560 | -3.0% | 0.81 ± 0.04 |
| without teammate-out boost | 3PM | 15,530 | 1.049 | 1.042 | -1.0% | 0.72 ± 0.05 |

### Games with a posted total/spread only (15,741 player-games)

| Model | Stat | Player-games | Avg miss, plain average | Avg miss, projection | Squared error vs plain average | Slope (1 = right size, 0 = noise) |
|---|---|---:|---:|---:|---:|---:|
| full model | PRA | 15,456 | 6.742 | 6.575 | -5.2% | 0.78 ± 0.03 |
| full model | PTS | 15,456 | 5.310 | 5.230 | -3.1% | 0.76 ± 0.03 |
| full model | REB | 15,456 | 2.025 | 2.010 | -2.0% | 0.68 ± 0.03 |
| full model | AST | 15,456 | 1.573 | 1.557 | -2.7% | 0.74 ± 0.03 |
| full model | 3PM | 15,456 | 1.047 | 1.044 | -0.9% | 0.67 ± 0.05 |
| without game total / pace | PRA | 15,456 | 6.742 | 6.556 | -5.7% | 0.86 ± 0.03 |
| without game total / pace | PTS | 15,456 | 5.310 | 5.220 | -3.6% | 0.85 ± 0.04 |
| without game total / pace | REB | 15,456 | 2.025 | 2.010 | -2.0% | 0.68 ± 0.03 |
| without game total / pace | AST | 15,456 | 1.573 | 1.554 | -3.2% | 0.89 ± 0.04 |
| without game total / pace | 3PM | 15,456 | 1.047 | 1.046 | -0.7% | 0.65 ± 0.05 |

## Shrinking the projection to its real size

Fit on 2024-25: projection' = average + k × (projection − average), with k = that season's slope. Then applied unchanged to later seasons.

| Season | Stat | k (from fit season) | Error of plain average | Avg miss, raw projection | Avg miss, shrunk projection |
|---|---|---:|---:|---:|---:|
| 2024-25 | PRA | 0.72 | 6.834 | 6.704 | 6.683 |
| 2024-25 | PTS | 0.69 | 5.377 | 5.329 | 5.313 |
| 2024-25 | REB | 0.66 | 2.066 | 2.059 | 2.049 |
| 2024-25 | AST | 0.68 | 1.585 | 1.576 | 1.571 |
| 2024-25 | 3PM | 0.61 | 1.062 | 1.065 | 1.060 |
| 2025-26 | PRA | 0.72 | 6.829 | 6.651 | 6.639 |
| 2025-26 | PTS | 0.69 | 5.367 | 5.279 | 5.273 |
| 2025-26 | REB | 0.66 | 2.036 | 2.019 | 2.013 |
| 2025-26 | AST | 0.68 | 1.583 | 1.566 | 1.564 |
| 2025-26 | 3PM | 0.61 | 1.049 | 1.046 | 1.044 |

## Prop probabilities (calibration)

The prop alert needs an honest probability, not just a projection. `model.calibrate` shrinks a starter's projected gap from his average by k, pulls every projection toward m by beta (a high season average is partly luck), and `model.sdOf` sets the spread as a + b·√projection. Fit on 2024-25, checked on the rest. Real prop lines aren't available historically, so each player-game gets a **stand-in line: his average rounded to x.5**. Books' real lines are sharper than that, so these hit rates run higher than live ones; the point is whether "the model says 70%" means 70%. "Picks" are the ones the alert would send (P_MIN 0.58, minimum gaps {"pra":3,"pts":2,"reb":1,"ast":1,"fg3m":0.5}). Rotation and bench players (10+ MPG) who played.

| Season | Probabilities | Said 55-60% → hit | Said 60-65% → hit | Said 65-75% → hit | Said 75%+ → hit | Picks | Pick hit rate | Log loss |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-25 (fit) | old fixed spreads, raw projection (PTS/REB/AST/3PM) | 57.4% → 54.4% | 62.3% → 57.5% | 69.0% → 62.1% | 81.7% → 69.3% | 14,242 | 64.6% | 0.6856 |
| 2024-25 (fit) | calibrated (fit on 2024-25) (PTS/REB/AST/3PM) | 57.3% → 56.9% | 62.2% → 61.0% | 68.6% → 66.5% | 80.0% → 76.1% | 9,693 | 67.2% | 0.6754 |
| 2024-25 (fit) | calibrated (fit on 2024-25) **PRA** | 57.3% → 56.8% | 62.2% → 61.3% | 69.0% → 67.9% | 81.8% → 78.6% | 3,612 | 70.5% | 0.6689 |
| 2025-26 | old fixed spreads, raw projection (PTS/REB/AST/3PM) | 57.4% → 54.9% | 62.4% → 58.4% | 69.1% → 62.8% | 81.4% → 72.5% | 15,070 | 66.2% | 0.6787 |
| 2025-26 | calibrated (fit on 2024-25) (PTS/REB/AST/3PM) | 57.3% → 57.2% | 62.2% → 61.8% | 68.6% → 67.6% | 79.6% → 79.9% | 10,365 | 69.8% | 0.6714 |
| 2025-26 | calibrated (fit on 2024-25) **PRA** | 57.3% → 56.8% | 62.3% → 62.4% | 69.0% → 71.3% | 81.0% → 83.2% | 3,907 | 73.8% | 0.6616 |

Fit on all seasons (this goes in `model.js` CAL, or set `NBA_CAL`):

```
{"pra":{"k":0.767,"m":7.234,"beta":0.964,"a":2.928,"b":1.167},"pts":{"k":0.744,"m":7.705,"beta":0.951,"a":1.26,"b":1.45},"reb":{"k":0.673,"m":1.683,"beta":0.942,"a":-0.046,"b":1.227},"ast":{"k":0.725,"m":1.978,"beta":0.944,"a":-0.045,"b":1.166},"fg3m":{"k":0.645,"m":1.089,"beta":0.909,"a":-0.08,"b":1.159}}
```

## Bench players (10–20 MPG)

Same replay with players averaging 10–20 minutes also projected. Starters keep the picked setting; the bench gets its own share of a missing teammate's minutes (bench scale). Coach's-decision DNPs aren't treated as known before the game: those players are projected and count as "didn't play". Picked on 2024-25 by squared error in games where someone was out: **bench scale 0.25**.

| Bench scale | 2024-25 all | 2024-25 someone out | 2024-25 slope | 2025-26 all | 2025-26 someone out | 2025-26 slope |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 0.9197 | 0.9143 | 1.06 | 0.9029 | 0.8953 | 1.24 |
| **0.25** | 0.9080 | 0.9001 | 0.86 | 0.8822 | 0.8694 | 1.06 |
| 0.5 | 0.9436 | 0.9442 | 0.65 | 0.8940 | 0.8846 | 0.83 |
| 0.75 | 1.0264 | 1.0467 | 0.51 | 0.9383 | 0.9407 | 0.67 |
| 1 | 1.1565 | 1.2075 | 0.42 | 1.0153 | 1.0378 | 0.55 |
| 1.25 | 1.3339 | 1.4267 | 0.35 | 1.1247 | 1.1760 | 0.46 |

### Bench, 2024-25: 7,715 player-games; 2237 flagged, 5.6% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 1,932 | 70.1% | +5.62 | **+5.09** | 0.91 |
| Projection boost: PTS | 1,728 | 66.1% | +3.57 | **+3.22** | 0.90 |
| Projection boost: REB | 1,429 | 65.7% | +1.81 | **+1.51** | 0.83 |
| Projection boost: AST | 454 | 70.9% | +1.62 | **+1.41** | 0.87 |
| Projection boost: 3PM | 592 | 62.8% | +0.75 | **+0.63** | 0.83 |
| *(no flag) everyone in this group, PRA* | 7,715 | 49.7% | – | +1.12 | – |
| *(no flag) everyone in this group, PTS* | 7,715 | 47.9% | – | +0.72 | – |
| *(no flag) everyone in this group, REB* | 7,715 | 46.0% | – | +0.25 | – |
| *(no flag) everyone in this group, AST* | 7,715 | 45.1% | – | +0.15 | – |
| *(no flag) everyone in this group, 3PM* | 7,715 | 35.6% | – | +0.10 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 1,791 | 70.5% | +5.70 | **+5.23** | 0.92 |
| Projection boost: PTS | 1,608 | 66.5% | +3.61 | **+3.33** | 0.92 |
| Projection boost: REB | 1,325 | 65.9% | +1.84 | **+1.53** | 0.83 |
| Projection boost: AST | 433 | 71.8% | +1.62 | **+1.43** | 0.88 |
| Projection boost: 3PM | 562 | 62.3% | +0.76 | **+0.63** | 0.84 |
| *(no flag) everyone in this group, PRA* | 5,756 | 53.9% | – | +1.92 | – |
| *(no flag) everyone in this group, PTS* | 5,756 | 51.4% | – | +1.20 | – |
| *(no flag) everyone in this group, REB* | 5,756 | 49.6% | – | +0.45 | – |
| *(no flag) everyone in this group, AST* | 5,756 | 48.1% | – | +0.27 | – |
| *(no flag) everyone in this group, 3PM* | 5,756 | 38.7% | – | +0.16 | – |

### Bench, 2025-26: 8,218 player-games; 2314 flagged, 4.1% of those didn't play (coach's decision)

All bench games:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 1,997 | 74.1% | +5.30 | **+5.75** | 1.09 |
| Projection boost: PTS | 1,750 | 70.7% | +3.36 | **+3.87** | 1.15 |
| Projection boost: REB | 1,488 | 67.1% | +1.72 | **+1.57** | 0.92 |
| Projection boost: AST | 473 | 69.8% | +1.44 | **+1.65** | 1.14 |
| Projection boost: 3PM | 528 | 59.8% | +0.74 | **+0.60** | 0.81 |
| *(no flag) everyone in this group, PRA* | 8,218 | 50.4% | – | +1.25 | – |
| *(no flag) everyone in this group, PTS* | 8,218 | 48.5% | – | +0.80 | – |
| *(no flag) everyone in this group, REB* | 8,218 | 46.9% | – | +0.26 | – |
| *(no flag) everyone in this group, AST* | 8,218 | 45.3% | – | +0.19 | – |
| *(no flag) everyone in this group, 3PM* | 8,218 | 35.5% | – | +0.08 | – |

Only games where a teammate was out:

| Flag | Picks | Beat their average | Model said (avg gain) | Actually got | Got ÷ said |
|---|---:|---:|---:|---:|---:|
| Projection boost: PRA | 1,800 | 74.8% | +5.40 | **+5.97** | 1.10 |
| Projection boost: PTS | 1,575 | 71.6% | +3.42 | **+4.04** | 1.18 |
| Projection boost: REB | 1,361 | 67.7% | +1.74 | **+1.62** | 0.93 |
| Projection boost: AST | 450 | 69.8% | +1.45 | **+1.67** | 1.15 |
| Projection boost: 3PM | 495 | 59.6% | +0.74 | **+0.61** | 0.83 |
| *(no flag) everyone in this group, PRA* | 5,974 | 55.2% | – | +2.15 | – |
| *(no flag) everyone in this group, PTS* | 5,974 | 52.7% | – | +1.35 | – |
| *(no flag) everyone in this group, REB* | 5,974 | 50.5% | – | +0.49 | – |
| *(no flag) everyone in this group, AST* | 5,974 | 48.6% | – | +0.31 | – |
| *(no flag) everyone in this group, 3PM* | 5,974 | 38.0% | – | +0.14 | – |
