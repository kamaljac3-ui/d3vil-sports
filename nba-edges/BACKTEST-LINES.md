# NBA Lines backtest

Generated 2026-10-25 by `node nba-edges/backtest-lines.js`. `lines.js` ratings refit before every game day from that season's earlier results (no look-ahead), seeded by last season's final ratings. Lines are ESPN's opening and closing numbers (core API; ESPN BET, or whichever book ESPN lists first). Settings picked on 2024-25; 2025-26 is out of sample. "Ruled out" = a regular who didn't play (optimistic: the live bot only knows the injury report).

**Picked settings:** half-life 30 days, prior worth 4 games, last season regressed ×0.6, home court 1.64, back-to-back 1.76, injuries 0.086 margin and 0.023 total per point of value out (back-to-back and injuries fit to the closing line).

The one question that matters: **when the model disagrees with the line, does the result move with the model?** "Slope" is the share of the model's disagreement that showed up in results, (result − line) on (model − line): 1 means the model is right and the line is wrong, 0 means the line already knew. ATS/totals records are against the closing line; pushes excluded; break-even at -110 is 52.4%.

## 2024-25 (fit)

1230 games with closing lines (of 1231).

| | Model error | Closing-line error | Slope (result − line on model − line) |
|---|---:|---:|---:|
| Margin (RMSE) | 13.83 | 13.57 | 0.12 ± 0.13 |
| Total (RMSE) | 18.28 | 17.61 | -0.18 ± 0.12 |

| Disagreement with closing line | Spread picks | Spread record | Total picks | Total record |
|---|---:|---:|---:|---:|
| 0–1 pts | 343 | 178-165 (51.9%) | 241 | 130-111 (53.9%) |
| 1–2 pts | 280 | 144-136 (51.4%) | 211 | 107-104 (50.7%) |
| 2–3 pts | 234 | 130-104 (55.6%) | 207 | 103-104 (49.8%) |
| 3–4 pts | 148 | 73-75 (49.3%) | 165 | 77-88 (46.7%) |
| 4–6 pts | 166 | 85-81 (51.2%) | 221 | 99-122 (44.8%) |
| 6+ pts | 59 | 30-29 (50.8%) | 185 | 88-97 (47.6%) |
| 2+ pts | 607 | 318-289 (52.4%) | 778 | 367-411 (47.2%) |
| 3+ pts | 373 | 188-185 (50.4%) | 571 | 264-307 (46.2%) |

**Open → close** (1230 games with both): when the model disagreed with the *opening* line by 2+ / 4+ pts, how often the line then moved toward the model, and the average move in the model's direction. Betting at the open only pays if the close keeps coming your way.

| | Disagreement | Games | Moved toward model | Moved away | Avg move toward model |
|---|---|---:|---:|---:|---:|
| Spread | 2+ | 646 | 408 | 117 | +1.90 |
| Total | 2+ | 755 | 500 | 183 | +2.67 |
| Spread | 4+ | 315 | 229 | 38 | +2.91 |
| Total | 4+ | 416 | 304 | 81 | +3.79 |

Against the **opening** line: spread 3+ pts 280-178 (61.1%), 5+ pts 133-74 (64.3%); total 4+ pts 231-185 (55.5%), 6+ pts 132-76 (63.5%).

## 2025-26 (out of sample)

1229 games with closing lines (of 1231).

| | Model error | Closing-line error | Slope (result − line on model − line) |
|---|---:|---:|---:|
| Margin (RMSE) | 14.25 | 13.93 | 0.05 ± 0.13 |
| Total (RMSE) | 18.94 | 18.33 | -0.03 ± 0.11 |

| Disagreement with closing line | Spread picks | Spread record | Total picks | Total record |
|---|---:|---:|---:|---:|
| 0–1 pts | 302 | 160-142 (53.0%) | 212 | 99-113 (46.7%) |
| 1–2 pts | 295 | 137-158 (46.4%) | 213 | 116-97 (54.5%) |
| 2–3 pts | 220 | 97-123 (44.1%) | 198 | 118-80 (59.6%) |
| 3–4 pts | 172 | 88-84 (51.2%) | 167 | 81-86 (48.5%) |
| 4–6 pts | 168 | 92-76 (54.8%) | 218 | 109-109 (50.0%) |
| 6+ pts | 72 | 38-34 (52.8%) | 221 | 106-115 (48.0%) |
| 2+ pts | 632 | 315-317 (49.8%) | 804 | 414-390 (51.5%) |
| 3+ pts | 412 | 218-194 (52.9%) | 606 | 296-310 (48.8%) |

**Open → close** (1229 games with both): when the model disagreed with the *opening* line by 2+ / 4+ pts, how often the line then moved toward the model, and the average move in the model's direction. Betting at the open only pays if the close keeps coming your way.

| | Disagreement | Games | Moved toward model | Moved away | Avg move toward model |
|---|---|---:|---:|---:|---:|
| Spread | 2+ | 648 | 363 | 130 | +1.04 |
| Total | 2+ | 705 | 391 | 222 | +1.07 |
| Spread | 4+ | 291 | 183 | 51 | +1.42 |
| Total | 4+ | 347 | 217 | 91 | +1.62 |

Against the **opening** line: spread 3+ pts 256-202 (55.9%), 5+ pts 95-62 (60.5%); total 4+ pts 188-159 (54.2%), 6+ pts 81-74 (52.3%).

## Settings grid (2024-25, squared error vs results, no lines)

| Half-life | Prior games | Regress | Margin MSE | Total MSE |
|---:|---:|---:|---:|---:|
| 30 | 4 | 0.6 | 197.8 | 334.5 |
| 30 | 4 | 0.4 | 198.1 | 334.5 |
| 45 | 8 | 0.6 | 198.4 | 334.3 |
| 30 | 4 | 0.8 | 197.9 | 334.9 |
| 30 | 8 | 0.6 | 198.8 | 334.1 |
| 45 | 4 | 0.6 | 197.9 | 335.2 |
| 45 | 8 | 0.8 | 198.3 | 334.8 |
| 45 | 8 | 0.4 | 198.9 | 334.3 |
| 30 | 8 | 0.8 | 198.8 | 334.5 |
| 45 | 4 | 0.4 | 198.2 | 335.1 |

Env for the picked settings: `NBA_LINES_HALF_LIFE=30 NBA_LINES_PRIOR_GAMES=4 NBA_LINES_REGRESS=0.6 NBA_LINES_HCA=1.64 NBA_LINES_B2B=1.76 NBA_LINES_INJ=0.086 NBA_LINES_INJ_TOTAL=0.023`
