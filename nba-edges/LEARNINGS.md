# NBA Edges: what we've learned

Read this before testing an idea or changing the model, so nothing gets re-tested from scratch or forgotten. Every
angle tried goes here with its evidence and status. **The rule:** an angle goes into the model only if it beats an
out-of-sample backtest (fit 2024-25, test 2025-26, `backtest.js` / `backtest-lines.js`). Otherwise it can be shown as an
informational tag, which the weekly review then grades on real picks.

How this fits with the weekly review: this file holds what the **backtests** settled. Live evidence from sent picks lives in
`LESSONS.md` and `nba-review.md` on the `bot-results` branch (written by the Monday "Weekly bot review" routine and
`results/track.js`). When a live lesson is settled, add or update its row here.

## Settled by backtest

| Angle | Result | Status |
|---|---|---|
| Teammate out, original rule (+70% × lost/remaining) | Overshot ~5x; projections 2-6% worse than the plain average | Replaced |
| Teammate out, minutes shift + usage | Box-score rosters (2026-10-24): minutes 0.25 + usage 0.15 best on 2024-25. Usage 0 was a hair better on 2025-26 (0.9930 vs 0.9937), so the bump is marginal | In model (`NBA_OUT_*`), model `2026-10-24-rosters` |
| Bench players' share of a missing teammate's minutes | 0.25 picked on 2024-25. 0.5 tied there and was better on 2025-26 (0.9139 vs 0.9269) | In model (`NBA_OUT_BENCH_SCALE` 0.25). Worth a retest after a third season |
| Calibration (shrink the gap, regress to the mean, real spread) | Old fixed spreads made 60% spots look like 85-90% | In model (`CAL`) |
| Shot-zone matchups | Promised ~+2 pts, delivered +0.2-0.3 | Alerts off (`ZONE_MIN` 99); the factor stays in projections |
| Back-to-back, 2nd night: player scoring | Regulars who played scored at their projection (+0.15 vs +0.17). A player's own split repeated at 0.11× ± 0.08 the next season (Trae −7.4 → predicts −0.8) | Info tag `b2b 2nd night` |
| Back-to-back, 2nd night: sitting | Regulars sat 21% of 2nd nights vs 16% of other games. Who sits repeats weakly (r 0.13) | Info only (the risk is a void, not an under) |
| Defense vs position (G/F/C) | Bottom-3 vs top-3 defense: +1.2 vs +0.5 pts vs own average, but flat vs the projection (game total/pace already carry it). Adding the factor: 0.00-0.05% error change out of sample | Info tag, top/bottom `DVP_RANK` 3 |
| Day of week / Sunday games | Sunday home −0.0, road +0.4 pts vs projection (±1.0). Sunday after a free Saturday: nothing | Rejected |
| Road city / nightlife (Atlanta, Miami…) | City spread came from the home team's defense. With a posted total, or comparing free-night vs back-to-back arrivals in the same city, the spread is noise. ATL −0.9, MIA +2.6 | Rejected |
| Game lines (spread/total) vs the close | Spreads 50-53% vs the close at any disagreement; totals lose (`BACKTEST-LINES.md`) | No ✅ by default; 4+ pt spreads logged as tracked picks |
| Backtest rosters | nba.com historical snapshots list each player's *current* team (Jan 2025 had Davis on DAL). Fixed 2026-10-24: rosters now come from box scores | Fixed |
| PRA (points + rebounds + assists) | Calibrated on its own (2026-10-28): stand-in-line picks 73.1% (2024-25 fit) / 75.1% (2025-26), and "said 60-65%" hit 60%, so the probabilities hold out of sample (a little conservative at the top). Projection 2.6-3.0% better than the plain average | In model and alerts (stat `pra`, Odds API market `player_points_rebounds_assists`), model `2026-10-28-pra-blowout` |
| Blowouts (closing spread) | Starters 28+ MPG at 12+ either way: −0.8/−1.9 PRA vs projection, about 2-3 fewer minutes, unders 55% (stand-in line). An 8+ point underdog's bench: +0.8/+2.7 PRA, +4-5 minutes, overs 59%/67%. Its rotation: +0.5/+1.1. Fit factors on 2024-25 cut 2025-26 error 0.4% | In model (`BLOW_*`), replaces the flat ×0.95 trim; tags `blowout risk` and `+N underdog` |
| Head-to-head, player (last 5 meetings) | PRA in recent meetings minus his average barely predicts tonight: +0.06 ± 0.02 / ± 0.01 PRA per point, both seasons. Only the cold side repeated: 5+ under his average vs this team → −0.8/−1.0 vs projection, unders 56%/58% (stand-in line) vs 49%/52% for everyone. The hot side didn't (+0.5/+0.2) | Info tag `cold vs OPP` (5+ PRA under, 2+ meetings); `h2h` logged on every pick |
| Head-to-head, team (last 5 meetings) | Recent H2H margin vs the closing line: slope −0.10 ± 0.07 / −0.07 ± 0.04; betting the H2H side when 6+ off the line went 49% / 46%. H2H totals: nothing | Rejected |
| Defense vs position for PRA | Same as for points: softest 10% of defenses +1.5 PRA vs the player's average but +0.4/+0.2 vs the projection; slope +0.11 ± 0.05 / −0.03 ± 0.05 | Info tag only (unchanged) |

## Weak leads (not proven; check before acting)

- **Road teams on 3+ days of rest:** −2.0 pts vs projection (z −2.3, under rate 54.4%), 2024-26. One of many comparisons, so it could be luck. Settle with a fit/test split before tagging anything.
- **Back-to-back road teams:** +1.9 pts vs projection (z 2.2). Probably the teammate-out boost being undersized when stars rest, not tired teams scoring more.

## What the weekly review should check (live picks)

Picks logged from 2026-10-25 on carry `tags`, `rest`, `dvp` {pos, rank, of, pct} and `minProj`, so `results/track.js` splits them in the ledger's `nba-review.md` ("NBA by tag"). Compare every group against the "no tags" row, and lean on closing-line value first.

1. **b2b 2nd night:** voids should run near 21% (the backtest). If picks that play underperform, that contradicts the backtest; watch it, don't act under ~100 picks.
2. **Defense vs position, bottom half vs top half:** the backtest says no difference vs the projection. A real gap over 100+ picks would reopen the DvP factor.
3. **Teammate out (w/o):** the main source of edges in the backtest. Check CLV. If the line had already moved before the alert, the edge is priced by the time we send it.
4. **Sent < 2h vs 2h+ before tip:** late alerts know more about injuries but face sharper lines.
5. **Minutes:** projected vs played and the per-minute rate. Big minutes misses point at rotation/injury handling; rate misses point at the projection itself.
6. **Model versions:** `2026-10-24-rosters` (usage 0.15, new CAL) vs earlier picks. Usage 0.15 was marginal out of sample; if CLV or results slip, test usage 0 again.
7. **nba-news boosts** (model label `nba-news`): 4/14 beat their average as of 2026-10-26. Tiny sample, but worth watching.
8. **Model `2026-10-28-pra-blowout`:** PRA picks (props and boosts) are the main bet now, so grade the "PRA picks" group on CLV first. Blowout minutes: the "8+ pt underdog" group (bench/rotation overs) should beat "no tags"; if it doesn't over 100+ picks, the books already price garbage time. "cold H2H" should run under its projection (the backtest said about −1 PRA, 56-58% unders).
