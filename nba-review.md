# NBA weekly review

Updated 2026-11-02. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model nba-news): 15 picks (small sample: noise until ~100+)
- Projection boosts: 9/15 beat their average (60%); model said +2.9, got +2.2 per pick
NBA (model 2026-10-29-market): 70 picks (small sample: noise until ~100+)
- Projection boosts: 16/22 beat their average (73%); model said +2.8, got +2.3 per pick
- Prop lines: 24-18 (57%), +3.8 units at -110 (break-even 52.4%)
  - Closing line: close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 4-2 (67%), +1.6 units at -110; vs the close: our way 0, against 1, avg -0.2
NBA (model 2026-10-24-rosters): 28 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 9-7 (56%), +1.2 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 16 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 99 graded picks with tags logged (small sample: noise until ~100+)
- no tags (8): props 3-5 -2.3u, close our way 0, against 0 of 1 (line avg +0.0)
- teammate out (w/o) (82): props 22-19 +1.0u, close our way 1, against 0 of 16 (line avg +0.1); boosts 27/41 beat avg (66%), said +2.8 got +2.1
- b2b 2nd night (22): props 10-4 +5.1u, close our way 0, against 0 of 6 (line avg +0.0); boosts 5/8 beat avg (63%), said +2.7 got +1.7
- 2+ days rest (14): props 6-1 +4.5u; boosts 6/7 beat avg (86%), said +3.2 got +2.8
- high team total (18): props 7-4 +2.4u, close our way 0, against 0 of 3 (line avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (11): props 3-3 -0.3u, close our way 0, against 0 of 5 (line avg +0.0); boosts 4/5 beat avg (80%), said +3.0 got +3.4
- 8+ pt underdog (14): props 4-0 +3.6u, close our way 0, against 0 of 2 (line avg +0.0); boosts 8/10 beat avg (80%), said +2.9 got +5.3
- cold H2H (5+ PRA under avg vs this opp) (9): props 5-2 +2.5u, close our way 1, against 0 of 2 (line avg +0.0, price +1.3 pts of implied chance on 1); boosts 0/2 beat avg (0%), said +2.2 got -2.2
- hot H2H (5+ PRA over avg vs this opp) (8): props 2-6 -4.2u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (53): props 24-18 +3.8u, close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1); boosts 9/11 beat avg (82%), said +4.5 got +4.1
- PRA board (top 10 of the slate) (33): props 19-14 +3.3u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: your book softer than the market (💰) (7): props 5-2 +2.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (24): props 14-10 +2.7u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: market disagrees (under 50%) (9): props 5-4 +0.5u
- PRA over, star (avg 30+) (2): props 1-1 -0.1u
- PRA under, star (avg 30+) (8): props 3-5 -2.3u
- PRA over, role player (avg < 20) (6): props 4-2 +1.6u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (7): props 3-4 -1.3u, close our way 1, against 0 of 1 (line avg +1.0)
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- star teammate back (4): props 1-1 -0.1u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (52): props 17-14 +1.5u, close our way 0, against 0 of 18 (line avg +0.0); boosts 12/21 beat avg (57%), said +2.6 got +1.6
- sent 2h+ before tip (47): props 16-11 +3.5u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1); boosts 15/20 beat avg (75%), said +3.0 got +2.7
- Model vs market on 33 picks (log loss, lower = better): market only 0.688, 25% model 0.689, 50% model 0.699, 75% model 0.719, model only 0.752; best market only (small sample)
- Minutes: projected 24.3, played 25.9 (avg miss 4.7, 3 picks 8+ min short); per-minute rate 106% of projected
- Didn't play (void): 3/102 (3%); on a b2b 2nd night 0/22 (0%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 29 picks (small sample: noise until ~100+)
- Projection boosts: 13/29 beat their average (45%); model said +2.5, got +0.3 per pick
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

NBA by tag: 103 graded picks with tags logged
- no tags (8): props 3-5 -2.3u, close our way 0, against 0 of 1 (line avg +0.0)
- teammate out (w/o) (86): props 25-20 +2.7u, close our way 1, against 0 of 16 (line avg +0.1); boosts 27/41 beat avg (66%), said +2.8 got +2.1
- b2b 2nd night (22): props 10-4 +5.1u, close our way 0, against 0 of 6 (line avg +0.0); boosts 5/8 beat avg (63%), said +2.7 got +1.7
- 2+ days rest (14): props 6-1 +4.5u; boosts 6/7 beat avg (86%), said +3.2 got +2.8
- high team total (20): props 8-5 +2.3u, close our way 0, against 0 of 3 (line avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (11): props 3-3 -0.3u, close our way 0, against 0 of 5 (line avg +0.0); boosts 4/5 beat avg (80%), said +3.0 got +3.4
- 8+ pt underdog (14): props 4-0 +3.6u, close our way 0, against 0 of 2 (line avg +0.0); boosts 8/10 beat avg (80%), said +2.9 got +5.3
- cold H2H (5+ PRA under avg vs this opp) (9): props 5-2 +2.5u, close our way 1, against 0 of 2 (line avg +0.0, price +1.3 pts of implied chance on 1); boosts 0/2 beat avg (0%), said +2.2 got -2.2
- hot H2H (5+ PRA over avg vs this opp) (8): props 2-6 -4.2u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (53): props 24-18 +3.8u, close our way 2, against 0 of 5 (line avg +0.2, price +1.3 pts of implied chance on 1); boosts 9/11 beat avg (82%), said +4.5 got +4.1
- PRA board (top 10 of the slate) (33): props 19-14 +3.3u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: your book softer than the market (💰) (7): props 5-2 +2.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (24): props 14-10 +2.7u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1)
- PRA board: market disagrees (under 50%) (9): props 5-4 +0.5u
- PRA over, star (avg 30+) (2): props 1-1 -0.1u
- PRA under, star (avg 30+) (8): props 3-5 -2.3u
- PRA over, role player (avg < 20) (6): props 4-2 +1.6u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (7): props 3-4 -1.3u, close our way 1, against 0 of 1 (line avg +1.0)
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- star teammate back (4): props 1-1 -0.1u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (56): props 20-15 +3.2u, close our way 0, against 0 of 18 (line avg +0.0); boosts 12/21 beat avg (57%), said +2.6 got +1.6
- sent 2h+ before tip (47): props 16-11 +3.5u, close our way 2, against 0 of 3 (line avg +0.3, price +1.3 pts of implied chance on 1); boosts 15/20 beat avg (75%), said +3.0 got +2.7
- Model vs market on 33 picks (log loss, lower = better): market only 0.688, 25% model 0.689, 50% model 0.699, 75% model 0.719, model only 0.752; best market only (small sample)
- Minutes: projected 24.6, played 26.1 (avg miss 4.6, 3 picks 8+ min short); per-minute rate 106% of projected
- Didn't play (void): 3/106 (3%); on a b2b 2nd night 0/22 (0%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 261 graded, 0 pending, 5 void.
