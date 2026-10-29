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
| Minutes trend (last 3 games) | The old 50/50 season/last-10 minutes missed role changes: players whose last 3 were 4+ min above the projection came in +2.4/+3.0 PRA (unders 36%), 4+ below −2.5/−2.9 (unders 63-65%). Fit on 2024-25: 0.26 season + 0.15 last-10 + 0.60 last-3. Minutes RMSE 7.08 → 6.42 and PRA 8.18 → 7.93 out of sample; the trend bias drops to +0.5/−0.25 | In model (`MINW_*`), model `2026-10-29-minutes` |
| Player back from injury (missed 3+ straight) | With the new minutes: game 1 back ×0.916/×0.873 of the projection (unders 62%/66% before the fix); games 2-3 back ≈1.0 once last-3 minutes are in | In model, game 1 only (`RET_BACK1` 0.894) |
| A 30+ PRA teammate back after missing 2+ | Teammates ×0.909/×0.933 of the projection (unders 57%/57%): their recent numbers were built while he sat | In model (`RET_STAR_BACK` 0.922) |
| Schedule load (3rd in 4 nights, 4th in 6, 4th+ game of a road trip, West team early in the East) | 3-in-4: +0.01/−0.18 PRA vs projection; 4-in-6: +0.24/−0.04; long road trip +0.17/−0.29; West early in the East −0.06/−0.63 (n 133/145). Nothing consistent | Rejected |
| Referee crews (2026-10-29) | Officials for 2,462 games (`.cache/bt/ref-<id>.json`); each ref's fouls/FTA vs league from his earlier games, shrunk 25 games, crew = mean, refs with 15+ games. The crew tendency doesn't repeat reliably (game fouls slope +2.8/−0.9 across seasons). PRA vs projection +0.31/+0.24 per crew foul (± 0.15/0.11), and the top/bottom 10% FTA crews show nothing (unders 49-53%). Officials may also not be known before tip | Rejected |
| Foul trouble (2026-10-29) | Box scores with fouls for 2024-26 (`.cache/bt/pf-<id>.json`), every feature vs the player's own fouls per minute. **Player vs this team** (excess fouls in last 2-5 meetings): +0.05/+0.11 fouls per extra past foul, minutes and PRA flat (+0.04/+0.14 min, −0.14/+0.07 PRA). **Opponent draws fouls from his position:** real, 56-60% of it repeats and 5+ fouls runs 8-10% vs ~4% against the cleanest teams, but minutes (+0.02/+0.72) and PRA (−0.38/+0.89 per expected extra foul) don't follow, with opposite signs. **Foul-prone player vs a foul-drawing team:** 5+ fouls 12.3%/12.7% (vs 8.7%) yet minutes +0.45/+0.76 vs projection, PRA −0.36/+0.67, unders 50.5%/48.7%. Coaches ride starters through fouls, and foul-heavy games add free throws | Rejected for PRA (fouls rise, PRA doesn't fall); not a tag |

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
9. **💰 stale prices (model `2026-10-28-ev`):** FanDuel prices worth 3%+ against Pinnacle's no-vig line. This is the edge the prop tools sell, so it should show up first in closing-line value: if the close moves our way on most 💰 picks over ~50 closes, it's real even before the win/loss record says so. If Pinnacle rarely posts NBA props on the Odds API, there will be few or none; say so rather than lowering the bar.
10. **PRA board (model `2026-10-29-board`):** the daily top 10. Grade the "PRA board" group on CLV first, then W-L at the logged price. Check whether the board's top half (by EV) beats its bottom half; if not over 100+ picks, the ranking adds nothing and a flat "model likes it" list is as good. Last-5 hit rates are shown, not used: if picks with 4/5 or 5/5 L5 hits do clearly better, that's a reason to test recent form again.
11. **Live-only angles (logged from model `2026-10-29-minutes`, no history to backtest):** (a) books shading stars' PRA overs: compare "PRA over/under, star (avg 30+)" with the role-player groups; if star unders beat star overs over 100+ picks, the model should lean under on stars. (b) players listed questionable / day-to-day / probable (`inj` on every pick, tagged on alerts): do they come in under once they play? (c) PRA line vs the separate points/rebounds/assists lines (`compGap`, only when `NBA_PROP_MARKETS` includes pts,reb,ast,pra, +3 credits a game; off by default). Also check that "first game back" and "star teammate back" picks hold up live the way the backtest said.
12. **Board blended with the market (model `2026-10-29-market`):** the board's chance is 50/50 model and market no-vig. Read the "Model vs market" log-loss line in the ledger review: once 100+ board picks are graded, set `BOARD_MARKET_W` to the best weight (if "market only" wins, the model is adding nothing beyond the books). Compare the "your book softer than the market (💰)" and "market-only pick" groups with the rest on CLV: those are the bets the other books' lines say FanDuel is behind on.

13. **🎯 Parlays (2026-10-29):** Saturday 5-leg PRA parlay on the board. Legs are treated as independent (one per game). Grade on the legs first (do the legs win at their blended chance?) and on the price: a parlay only pays if each leg's edge beats the book's cut five times over. Under ~50 parlays the W-L is pure luck (a fair 5-leg hits ~5-10%); judge the legs, not the tickets.
