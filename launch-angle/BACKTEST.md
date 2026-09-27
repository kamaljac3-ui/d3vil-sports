# Launch Angle backtest

Generated 2026-09-27 by `node launch-angle/backtest.js` (FENCE 380, MIN_EDGE 0.03, gap 5-12°).

**How to read it.** Every profile comes from the season *before* the one being tested, so there's no look-ahead. "Expected" HRs come from the hitter's HR/PA and the pitcher's HR/PA allowed (both from the prior season), scaled so the whole season's expected total matches the actual one. **Lift** = actual ÷ expected: 1.00x means the model adds nothing beyond "who's the slugger and who gives up homers". |z| > 2 is where a lift stops looking like noise. "Lift (hitter only)" ignores the pitcher, which is closer to what the results tracker measures.

## Both seasons combined

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| All matchups (baseline) | 93,345 | 156,658 | 5203 | 5203.0 | **1.00x** | -0.0 | 1.00x | 14.0% / 14.0% |
| Current bot rule | 2,378 | 3,986 | 150 | 143.2 | **1.05x** | +0.6 | 1.05x | 15.5% / 16.4% |
| Live bot rule | 698 | 1,101 | 31 | 30.0 | **1.03x** | +0.2 | 1.03x | 15.9% / 16.6% |
| Morning alert sim | 1,023 | 2,584 | 102 | 95.3 | **1.07x** | +0.7 | 1.10x | 15.6% / 16.4% |

## 2025 season (profiles from 2024)

215 hitter profiles, 396 pitcher profiles, 45,091 hitter-game-pitcher matchups (19,145 vs starters).

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| All matchups (baseline) | 45,091 | 76,205 | 2591 | 2591.0 | **1.00x** | +0.0 | 1.00x | 14.3% / 14.0% |
| Current bot rule: window edge ≥ 3 pts, gap 5-12° | 1,141 | 1,924 | 69 | 70.5 | **0.98x** | -0.2 | 0.99x | 14.9% / 16.6% |
| Live bot rule: + HR contact ≥ baseline | 165 | 251 | 6 | 6.9 | **0.87x** | -0.4 | 0.85x | 16.0% / 14.8% |
| Bot rule, but HR contact below baseline | 976 | 1,673 | 63 | 63.5 | **0.99x** | -0.1 | 1.00x | 14.7% / 16.8% |
| Morning alert sim (starters, top 8/day) | 510 | 1,273 | 51 | 47.6 | **1.07x** | +0.5 | 1.10x | 14.7% / 16.6% |
| Relievers only, live bot rule | 104 | 104 | 1 | 3.1 | **0.33x** | -1.2 | 0.32x | 14.8% / 15.7% |

### By modeled HR-contact edge (deciles)

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| D1 (hrEdge -0.227 to -0.088) | 4,509 | 7,998 | 263 | 292.8 | **0.90x** | -1.7 | 0.93x | 15.1% / 14.4% |
| D2 (hrEdge -0.088 to -0.068) | 4,509 | 8,170 | 299 | 291.3 | **1.03x** | +0.4 | 1.05x | 14.4% / 14.2% |
| D3 (hrEdge -0.068 to -0.055) | 4,509 | 8,184 | 300 | 294.1 | **1.02x** | +0.3 | 1.05x | 14.4% / 14.0% |
| D4 (hrEdge -0.055 to -0.044) | 4,509 | 8,024 | 331 | 294.8 | **1.12x** | +2.1 | 1.14x | 14.6% / 13.8% |
| D5 (hrEdge -0.044 to -0.034) | 4,509 | 7,733 | 303 | 290.6 | **1.04x** | +0.7 | 1.05x | 14.3% / 14.2% |
| D6 (hrEdge -0.034 to -0.024) | 4,509 | 7,354 | 289 | 274.7 | **1.05x** | +0.9 | 1.03x | 14.6% / 13.8% |
| D7 (hrEdge -0.024 to -0.004) | 4,509 | 7,102 | 257 | 271.5 | **0.95x** | -0.9 | 0.91x | 13.5% / 14.0% |
| D8 (hrEdge -0.004 to 0.000) | 4,509 | 7,657 | 184 | 194.9 | **0.94x** | -0.8 | 0.97x | 14.0% / 13.7% |
| D9 (hrEdge 0.000 to 0.000) | 4,509 | 7,271 | 157 | 165.7 | **0.95x** | -0.7 | 0.92x | 14.0% / 13.6% |
| D10 (hrEdge 0.000 to 0.117) | 4,510 | 6,712 | 208 | 220.7 | **0.94x** | -0.9 | 0.90x | 14.2% / 14.7% |

### By modeled launch-window edge (deciles)

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| D1 (edge -0.073 to -0.025) | 4,509 | 7,636 | 220 | 240.1 | **0.92x** | -1.3 | 0.90x | 13.4% / 13.2% |
| D2 (edge -0.025 to -0.019) | 4,509 | 7,639 | 201 | 246.5 | **0.82x** | -2.9 | 0.82x | 14.3% / 13.4% |
| D3 (edge -0.019 to -0.015) | 4,509 | 7,800 | 280 | 262.2 | **1.07x** | +1.1 | 1.07x | 15.0% / 13.5% |
| D4 (edge -0.015 to -0.013) | 4,509 | 8,217 | 276 | 294.1 | **0.94x** | -1.1 | 0.96x | 13.7% / 14.1% |
| D5 (edge -0.013 to -0.011) | 4,509 | 7,850 | 256 | 276.7 | **0.93x** | -1.2 | 0.93x | 13.6% / 14.3% |
| D6 (edge -0.011 to -0.009) | 4,509 | 7,317 | 243 | 252.0 | **0.96x** | -0.6 | 0.96x | 14.2% / 14.2% |
| D7 (edge -0.009 to -0.006) | 4,509 | 7,768 | 286 | 257.3 | **1.11x** | +1.8 | 1.08x | 14.2% / 14.3% |
| D8 (edge -0.006 to 0.000) | 4,509 | 7,812 | 334 | 282.1 | **1.18x** | +3.1 | 1.21x | 15.1% / 14.4% |
| D9 (edge 0.000 to 0.021) | 4,509 | 6,665 | 239 | 230.2 | **1.04x** | +0.6 | 1.02x | 14.9% / 13.5% |
| D10 (edge 0.021 to 0.076) | 4,510 | 7,501 | 256 | 249.8 | **1.02x** | +0.4 | 1.02x | 15.1% / 15.2% |

## 2026 season (profiles from 2025)

226 hitter profiles, 411 pitcher profiles, 48,254 hitter-game-pitcher matchups (19,996 vs starters).

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| All matchups (baseline) | 48,254 | 80,453 | 2612 | 2612.0 | **1.00x** | +0.0 | 1.00x | 13.6% / 13.9% |
| Current bot rule: window edge ≥ 3 pts, gap 5-12° | 1,237 | 2,062 | 81 | 72.7 | **1.11x** | +1.0 | 1.12x | 16.1% / 16.3% |
| Live bot rule: + HR contact ≥ baseline | 533 | 850 | 25 | 23.1 | **1.08x** | +0.4 | 1.09x | 15.8% / 17.0% |
| Bot rule, but HR contact below baseline | 704 | 1,212 | 56 | 49.6 | **1.13x** | +0.9 | 1.14x | 16.3% / 15.8% |
| Morning alert sim (starters, top 8/day) | 513 | 1,311 | 51 | 47.7 | **1.07x** | +0.5 | 1.10x | 16.4% / 16.2% |
| Relievers only, live bot rule | 326 | 336 | 11 | 8.5 | **1.29x** | +0.8 | 1.22x | 15.1% / 17.1% |

### By modeled HR-contact edge (deciles)

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| D1 (hrEdge -0.240 to -0.088) | 4,825 | 8,050 | 286 | 269.3 | **1.06x** | +1.0 | 1.07x | 14.5% / 15.5% |
| D2 (hrEdge -0.088 to -0.067) | 4,825 | 8,435 | 327 | 288.6 | **1.13x** | +2.3 | 1.15x | 14.3% / 14.5% |
| D3 (hrEdge -0.067 to -0.054) | 4,826 | 8,630 | 287 | 300.4 | **0.96x** | -0.8 | 0.98x | 14.0% / 13.8% |
| D4 (hrEdge -0.054 to -0.043) | 4,825 | 8,489 | 300 | 300.0 | **1.00x** | +0.0 | 1.02x | 13.9% / 13.6% |
| D5 (hrEdge -0.043 to -0.033) | 4,826 | 8,114 | 277 | 293.4 | **0.94x** | -1.0 | 0.94x | 13.1% / 13.8% |
| D6 (hrEdge -0.033 to -0.023) | 4,825 | 7,709 | 290 | 279.5 | **1.04x** | +0.6 | 1.03x | 13.1% / 13.4% |
| D7 (hrEdge -0.023 to -0.002) | 4,825 | 7,820 | 276 | 277.5 | **0.99x** | -0.1 | 0.98x | 12.5% / 13.2% |
| D8 (hrEdge -0.002 to 0.000) | 4,826 | 7,844 | 160 | 177.8 | **0.90x** | -1.3 | 0.90x | 13.1% / 13.4% |
| D9 (hrEdge 0.000 to 0.001) | 4,825 | 7,941 | 163 | 175.0 | **0.93x** | -0.9 | 0.94x | 13.6% / 13.4% |
| D10 (hrEdge 0.001 to 0.148) | 4,826 | 7,421 | 246 | 250.5 | **0.98x** | -0.3 | 0.94x | 14.3% / 15.0% |

### By modeled launch-window edge (deciles)

| Group | Matchups | PA | HR | Expected | Lift | z | Lift (hitter only) | 25-35° actual / predicted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| D1 (edge -0.073 to -0.025) | 4,825 | 7,966 | 245 | 241.5 | **1.01x** | +0.2 | 0.98x | 13.3% / 13.3% |
| D2 (edge -0.025 to -0.019) | 4,825 | 8,424 | 258 | 258.3 | **1.00x** | -0.0 | 0.99x | 13.1% / 13.6% |
| D3 (edge -0.019 to -0.015) | 4,826 | 8,402 | 265 | 261.3 | **1.01x** | +0.2 | 1.02x | 13.4% / 13.7% |
| D4 (edge -0.015 to -0.013) | 4,825 | 8,202 | 265 | 262.2 | **1.01x** | +0.2 | 1.02x | 14.4% / 14.1% |
| D5 (edge -0.013 to -0.012) | 4,826 | 8,069 | 270 | 257.8 | **1.05x** | +0.8 | 1.04x | 14.1% / 14.2% |
| D6 (edge -0.012 to -0.010) | 4,825 | 7,854 | 243 | 258.1 | **0.94x** | -0.9 | 0.95x | 14.1% / 14.1% |
| D7 (edge -0.010 to -0.006) | 4,825 | 7,718 | 248 | 269.3 | **0.92x** | -1.3 | 0.94x | 13.5% / 14.4% |
| D8 (edge -0.006 to -0.000) | 4,826 | 8,556 | 328 | 307.1 | **1.07x** | +1.2 | 1.07x | 13.8% / 14.5% |
| D9 (edge -0.000 to 0.020) | 4,825 | 7,204 | 228 | 244.3 | **0.93x** | -1.0 | 0.93x | 12.8% / 13.3% |
| D10 (edge 0.020 to 0.075) | 4,826 | 8,058 | 262 | 252.0 | **1.04x** | +0.6 | 1.04x | 13.8% / 14.3% |
