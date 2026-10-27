# NBA weekly review

Updated 2026-10-27. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 17 picks (small sample: noise until ~100+)
- Projection boosts: 4/17 beat their average (24%); model said +2.1, got -1.8 per pick
NBA (model 2026-10-24-rosters): 17 picks (small sample: noise until ~100+)
- Projection boosts: 1/1 beat their average (100%); model said +2.3, got +1.4 per pick
- Prop lines: 9-3 (75%), +5.2 units at -110 (break-even 52.4%)
  - Closing line: 8 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 5+ pts off the line): 3-1 (75%), +1.7 units at -110; vs the close: our way 2, against 0, avg +1.0

NBA by tag: 16 graded picks with tags logged (small sample: noise until ~100+)
- teammate out (w/o) (14): props 7-3 +3.4u, close our way 0/6 (avg +0.0); boosts 1/4 beat avg (25%), said +2.5 got -1.6
- b2b 2nd night (5): props 3-1 +1.7u, close our way 0/4 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- high team total (8): props 3-1 +1.7u, close our way 0/2 (avg +0.0); boosts 1/4 beat avg (25%), said +2.5 got -1.6
- sent < 2h before tip (15): props 9-3 +5.2u, close our way 0/8 (avg +0.0); boosts 0/3 beat avg (0%), said +2.6 got -2.6
- sent 2h+ before tip (1): boosts 1/1 beat avg (100%), said +2.3 got +1.4
- Minutes: projected 26.1, played 24.9 (avg miss 4.5, 1 picks 8+ min short); per-minute rate 140% of projected
- Didn't play (void): 1/17 (6%); on a b2b 2nd night 0/5 (0%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 17 picks (small sample: noise until ~100+)
- Projection boosts: 4/17 beat their average (24%); model said +2.1, got -1.8 per pick
NBA (model 2026-10-24-rosters): 17 picks (small sample: noise until ~100+)
- Projection boosts: 1/1 beat their average (100%); model said +2.3, got +1.4 per pick
- Prop lines: 9-3 (75%), +5.2 units at -110 (break-even 52.4%)
  - Closing line: 8 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 5+ pts off the line): 3-1 (75%), +1.7 units at -110; vs the close: our way 2, against 0, avg +1.0

NBA by tag: 16 graded picks with tags logged (small sample: noise until ~100+)
- teammate out (w/o) (14): props 7-3 +3.4u, close our way 0/6 (avg +0.0); boosts 1/4 beat avg (25%), said +2.5 got -1.6
- b2b 2nd night (5): props 3-1 +1.7u, close our way 0/4 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- high team total (8): props 3-1 +1.7u, close our way 0/2 (avg +0.0); boosts 1/4 beat avg (25%), said +2.5 got -1.6
- sent < 2h before tip (15): props 9-3 +5.2u, close our way 0/8 (avg +0.0); boosts 0/3 beat avg (0%), said +2.6 got -2.6
- sent 2h+ before tip (1): boosts 1/1 beat avg (100%), said +2.3 got +1.4
- Minutes: projected 26.1, played 24.9 (avg miss 4.5, 1 picks 8+ min short); per-minute rate 140% of projected
- Didn't play (void): 1/17 (6%); on a b2b 2nd night 0/5 (0%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 164 graded, 0 pending, 3 void.
