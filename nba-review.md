# NBA weekly review

Updated 2026-10-31. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model pre-2026-10-24): 51 picks (small sample: noise until ~100+)
- Projection boosts: 5/8 beat their average (63%); model said +2.0, got +0.5 per pick
- Prop lines: 27-16 (63%), +8.5 units at -110 (break-even 52.4%)
NBA (model nba-news): 22 picks (small sample: noise until ~100+)
- Projection boosts: 11/22 beat their average (50%); model said +2.6, got +1.5 per pick
NBA (model 2026-10-29-market): 28 picks (small sample: noise until ~100+)
- Projection boosts: 5/6 beat their average (83%); model said +3.1, got +3.0 per pick
- Prop lines: 8-10 (44%), -2.7 units at -110 (break-even 52.4%)
- Game spreads (model 4+ pts off the line): 2-2 (50%), -0.2 units at -110; vs the close: our way 0, against 0, avg +0.0
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: 16 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 63 graded picks with tags logged (small sample: noise until ~100+)
- no tags (5): props 2-3 -1.2u
- teammate out (w/o) (54): props 15-14 -0.4u, close our way 0/14 (avg +0.0); boosts 16/25 beat avg (64%), said +2.8 got +2.2
- b2b 2nd night (8): props 5-2 +2.5u, close our way 0/5 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- 2+ days rest (7): props 3-1 +1.7u; boosts 3/3 beat avg (100%), said +3.5 got +4.7
- high team total (17): props 5-5 -0.5u, close our way 0/3 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (5): props 2-3 -1.2u, close our way 0/4 (avg +0.0)
- 8+ pt underdog (7): props 2-0 +1.8u; boosts 4/5 beat avg (80%), said +2.8 got +7.3
- cold H2H (5+ PRA under avg vs this opp) (4): props 3-1 +1.7u
- hot H2H (5+ PRA over avg vs this opp) (3): props 1-2 -1.1u
- PRA picks (23): props 8-10 -2.7u; boosts 5/5 beat avg (100%), said +5.0 got +6.5
- PRA board (top 10 of the slate) (13): props 6-7 -1.5u
- PRA board: your book softer than the market (💰) (3): props 2-1 +0.8u
- PRA board: market agrees (its chance 50%+) (9): props 4-5 -1.4u
- PRA board: market disagrees (under 50%) (4): props 2-2 -0.2u
- PRA over, star (avg 30+) (1): props 0-1 -1.0u
- PRA under, star (avg 30+) (2): props 0-2 -2.0u
- PRA over, role player (avg < 20) (4): props 2-2 -0.2u
- PRA under, role player (avg < 20) (1): props 1-0 +0.9u
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- sent < 2h before tip (37): props 14-11 +1.7u, close our way 0/16 (avg +0.0); boosts 7/12 beat avg (58%), said +2.6 got +2.7
- sent 2h+ before tip (26): props 6-7 -1.5u; boosts 9/13 beat avg (69%), said +3.0 got +1.7
- Model vs market on 13 picks (log loss, lower = better): market only 0.686, 25% model 0.720, 50% model 0.766, 75% model 0.827, model only 0.907; best market only (small sample)
- Minutes: projected 24.7, played 25.3 (avg miss 4.0, 3 picks 8+ min short); per-minute rate 113% of projected
- Didn't play (void): 3/66 (5%); on a b2b 2nd night 0/8 (0%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 29 picks (small sample: noise until ~100+)
- Projection boosts: 13/29 beat their average (45%); model said +2.5, got +0.3 per pick
NBA (model 2026-10-29-market): 28 picks (small sample: noise until ~100+)
- Projection boosts: 5/6 beat their average (83%); model said +3.1, got +3.0 per pick
- Prop lines: 8-10 (44%), -2.7 units at -110 (break-even 52.4%)
- Game spreads (model 4+ pts off the line): 2-2 (50%), -0.2 units at -110; vs the close: our way 0, against 0, avg +0.0
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: 16 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 63 graded picks with tags logged (small sample: noise until ~100+)
- no tags (5): props 2-3 -1.2u
- teammate out (w/o) (54): props 15-14 -0.4u, close our way 0/14 (avg +0.0); boosts 16/25 beat avg (64%), said +2.8 got +2.2
- b2b 2nd night (8): props 5-2 +2.5u, close our way 0/5 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- 2+ days rest (7): props 3-1 +1.7u; boosts 3/3 beat avg (100%), said +3.5 got +4.7
- high team total (17): props 5-5 -0.5u, close our way 0/3 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (5): props 2-3 -1.2u, close our way 0/4 (avg +0.0)
- 8+ pt underdog (7): props 2-0 +1.8u; boosts 4/5 beat avg (80%), said +2.8 got +7.3
- cold H2H (5+ PRA under avg vs this opp) (4): props 3-1 +1.7u
- hot H2H (5+ PRA over avg vs this opp) (3): props 1-2 -1.1u
- PRA picks (23): props 8-10 -2.7u; boosts 5/5 beat avg (100%), said +5.0 got +6.5
- PRA board (top 10 of the slate) (13): props 6-7 -1.5u
- PRA board: your book softer than the market (💰) (3): props 2-1 +0.8u
- PRA board: market agrees (its chance 50%+) (9): props 4-5 -1.4u
- PRA board: market disagrees (under 50%) (4): props 2-2 -0.2u
- PRA over, star (avg 30+) (1): props 0-1 -1.0u
- PRA under, star (avg 30+) (2): props 0-2 -2.0u
- PRA over, role player (avg < 20) (4): props 2-2 -0.2u
- PRA under, role player (avg < 20) (1): props 1-0 +0.9u
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- sent < 2h before tip (37): props 14-11 +1.7u, close our way 0/16 (avg +0.0); boosts 7/12 beat avg (58%), said +2.6 got +2.7
- sent 2h+ before tip (26): props 6-7 -1.5u; boosts 9/13 beat avg (69%), said +3.0 got +1.7
- Model vs market on 13 picks (log loss, lower = better): market only 0.686, 25% model 0.720, 50% model 0.766, 75% model 0.827, model only 0.907; best market only (small sample)
- Minutes: projected 24.7, played 25.3 (avg miss 4.0, 3 picks 8+ min short); per-minute rate 113% of projected
- Didn't play (void): 3/66 (5%); on a b2b 2nd night 0/8 (0%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 219 graded, 0 pending, 5 void.
