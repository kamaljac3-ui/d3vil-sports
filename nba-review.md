# NBA weekly review

Updated 2026-11-05. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model nba-news): 14 picks (small sample: noise until ~100+)
- Projection boosts: 12/14 beat their average (86%); model said +3.5, got +5.2 per pick
NBA (model 2026-11-02-under-filter): 62 picks (small sample: noise until ~100+)
- Projection boosts: 10/21 beat their average (48%); model said +2.8, got -0.0 per pick
- Prop lines: 13-19 (41%), -7.2 units at -110 (break-even 52.4%)
- Held-back unders (not sent): 2-3 (40%). Under 52.4% means cutting them helped.
- Game spreads (model 4+ pts off the line): 5-4 (56%), +0.5 units at -110; vs the close: our way 1, against 3, avg -0.2
NBA (model 2026-10-29-market): 70 picks (small sample: noise until ~100+)
- Projection boosts: 16/22 beat their average (73%); model said +2.8, got +2.3 per pick
- Prop lines: 24-18 (57%), +3.8 units at -110 (break-even 52.4%)
  - Closing line: close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 4-2 (67%), +1.6 units at -110; vs the close: our way 0, against 1, avg -0.2
NBA (model 0.6336694322992042): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +5.1% EV a bet
NBA (model 0.6082723306078905): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +4.9% EV a bet
NBA (model 0.45941922446554406): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 1-0 (100%), +0.8 units at the prices taken, promised +3.3% EV a bet
NBA (model 0.4504403090272906): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +3.5% EV a bet
NBA (model 0.44579088789569354): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +3.1% EV a bet

NBA by tag: 136 graded picks with tags logged
- no tags (16): props 4-7 -3.4u, close our way 0, against 0 of 1 (line avg +0.0); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet
- teammate out (w/o) (96): props 23-20 +0.9u, close our way 1, against 0 of 2 (line avg +0.5); boosts 37/53 beat avg (70%), said +3.0 got +2.5
- b2b 2nd night (27): props 9-5 +3.2u, close our way 0, against 0 of 1 (line avg +0.0); boosts 7/13 beat avg (54%), said +2.9 got +1.7
- 2+ days rest (26): props 8-5 +2.3u; boosts 9/13 beat avg (69%), said +3.1 got +1.2
- high team total (37): props 12-10 +0.9u; boosts 9/15 beat avg (60%), said +3.1 got +1.4
- blowout risk (15): props 3-3 -0.3u, close our way 0, against 0 of 1 (line avg +0.0); boosts 5/9 beat avg (56%), said +3.1 got +1.1
- 8+ pt underdog (25): props 6-3 +2.5u, close our way 0, against 0 of 2 (line avg +0.0); boosts 11/16 beat avg (69%), said +3.1 got +4.6
- cold H2H (5+ PRA under avg vs this opp) (12): props 5-3 +1.5u, close our way 1, against 0 of 2 (line avg +0.0, price +1.3 pts of implied chance on 1); boosts 1/4 beat avg (25%), said +2.4 got -1.0
- hot H2H (5+ PRA over avg vs this opp) (11): props 3-8 -5.3u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (97): props 37-37 -3.4u, close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet; boosts 13/18 beat avg (72%), said +4.5 got +3.4
- PRA board (top 10 of the slate) (51): props 26-25 -1.4u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: your book softer than the market (💰) (11): props 6-5 +0.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (33): props 18-15 +1.4u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: market disagrees (under 50%) (17): props 8-9 -1.7u
- PRA over, star (avg 30+) (4): props 2-2 -0.2u
- PRA under, star (avg 30+) (10): props 4-6 -2.4u
- PRA over, role player (avg < 20) (13): props 5-8 -3.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (15): props 9-6 +2.2u, close our way 1, against 0 of 1 (line avg +1.0)
- listed questionable / day-to-day / probable (4): props 1-3 -2.1u
- first game back (1): props 1-0 +0.9u
- star teammate back (4): props 1-1 -0.1u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (73): props 16-20 -5.5u, close our way 0, against 0 of 2 (line avg +0.0); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet; boosts 21/32 beat avg (66%), said +2.9 got +2.5
- sent 2h+ before tip (63): props 21-17 +2.1u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1); boosts 17/25 beat avg (68%), said +3.2 got +1.8
- Model vs market on 50 picks (log loss, lower = better): market only 0.689, 25% model 0.700, 50% model 0.724, 75% model 0.764, model only 0.826; best market only (small sample)
- Minutes: projected 24.5, played 25.5 (avg miss 5.3, 11 picks 8+ min short); per-minute rate 91% of projected
- Didn't play (void): 5/141 (4%); on a b2b 2nd night 3/30 (10%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 35 picks (small sample: noise until ~100+)
- Projection boosts: 18/35 beat their average (51%); model said +2.7, got +1.1 per pick
NBA (model 2026-11-02-under-filter): 62 picks (small sample: noise until ~100+)
- Projection boosts: 10/21 beat their average (48%); model said +2.8, got -0.0 per pick
- Prop lines: 13-19 (41%), -7.2 units at -110 (break-even 52.4%)
- Held-back unders (not sent): 2-3 (40%). Under 52.4% means cutting them helped.
- Game spreads (model 4+ pts off the line): 5-4 (56%), +0.5 units at -110; vs the close: our way 1, against 3, avg -0.2
NBA (model 2026-10-29-market): 70 picks (small sample: noise until ~100+)
- Projection boosts: 16/22 beat their average (73%); model said +2.8, got +2.3 per pick
- Prop lines: 24-18 (57%), +3.8 units at -110 (break-even 52.4%)
  - Closing line: close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 4-2 (67%), +1.6 units at -110; vs the close: our way 0, against 1, avg -0.2
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 16 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6
NBA (model 0.6336694322992042): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +5.1% EV a bet
NBA (model 0.6082723306078905): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +4.9% EV a bet
NBA (model 0.45941922446554406): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 1-0 (100%), +0.8 units at the prices taken, promised +3.3% EV a bet
NBA (model 0.4504403090272906): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +3.5% EV a bet
NBA (model 0.44579088789569354): 1 picks (small sample: noise until ~100+)
- 💰 Stale prices (your book vs the sharp no-vig line): 0-1 (0%), -1.0 units at the prices taken, promised +3.1% EV a bet

NBA by tag: 167 graded picks with tags logged
- no tags (16): props 4-7 -3.4u, close our way 0, against 0 of 1 (line avg +0.0); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet
- teammate out (w/o) (125): props 33-28 +2.0u, close our way 1, against 0 of 16 (line avg +0.1); boosts 41/64 beat avg (64%), said +2.9 got +1.9
- b2b 2nd night (33): props 12-7 +3.9u, close our way 0, against 0 of 6 (line avg +0.0); boosts 8/14 beat avg (57%), said +2.8 got +1.7
- 2+ days rest (26): props 8-5 +2.3u; boosts 9/13 beat avg (69%), said +3.1 got +1.2
- high team total (49): props 15-12 +1.6u, close our way 0, against 0 of 3 (line avg +0.0); boosts 11/22 beat avg (50%), said +2.9 got +0.4
- blowout risk (19): props 4-6 -2.4u, close our way 0, against 0 of 5 (line avg +0.0); boosts 5/9 beat avg (56%), said +3.1 got +1.1
- 8+ pt underdog (25): props 6-3 +2.5u, close our way 0, against 0 of 2 (line avg +0.0); boosts 11/16 beat avg (69%), said +3.1 got +4.6
- cold H2H (5+ PRA under avg vs this opp) (12): props 5-3 +1.5u, close our way 1, against 0 of 2 (line avg +0.0, price +1.3 pts of implied chance on 1); boosts 1/4 beat avg (25%), said +2.4 got -1.0
- hot H2H (5+ PRA over avg vs this opp) (11): props 3-8 -5.3u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (97): props 37-37 -3.4u, close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet; boosts 13/18 beat avg (72%), said +4.5 got +3.4
- PRA board (top 10 of the slate) (51): props 26-25 -1.4u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: your book softer than the market (💰) (11): props 6-5 +0.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (33): props 18-15 +1.4u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: market disagrees (under 50%) (17): props 8-9 -1.7u
- PRA over, star (avg 30+) (4): props 2-2 -0.2u
- PRA under, star (avg 30+) (10): props 4-6 -2.4u
- PRA over, role player (avg < 20) (13): props 5-8 -3.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (15): props 9-6 +2.2u, close our way 1, against 0 of 1 (line avg +1.0)
- listed questionable / day-to-day / probable (4): props 1-3 -2.1u
- first game back (1): props 1-0 +0.9u
- star teammate back (4): props 1-1 -0.1u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (100): props 28-28 -2.5u, close our way 0, against 0 of 18 (line avg +0.0); 💰 1-4 (20%), -3.2 units at the prices taken, promised +4.0% EV a bet; boosts 23/39 beat avg (59%), said +2.8 got +1.7
- sent 2h+ before tip (67): props 21-17 +2.1u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1); boosts 19/29 beat avg (66%), said +3.0 got +1.7
- Model vs market on 50 picks (log loss, lower = better): market only 0.689, 25% model 0.700, 50% model 0.724, 75% model 0.764, model only 0.826; best market only (small sample)
- Minutes: projected 24.5, played 25.5 (avg miss 5.2, 12 picks 8+ min short); per-minute rate 99% of projected
- Didn't play (void): 7/174 (4%); on a b2b 2nd night 3/36 (8%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 339 graded, 0 pending, 9 void.
