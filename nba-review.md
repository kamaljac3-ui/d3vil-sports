# NBA weekly review

Updated 2026-10-30. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model pre-2026-10-24): 96 picks (small sample: noise until ~100+)
- Projection boosts: 6/13 beat their average (46%); model said +2.1, got -0.4 per pick
- Prop lines: 51-32 (61%), +14.4 units at -110 (break-even 52.4%)
NBA (model nba-news): 19 picks (small sample: noise until ~100+)
- Projection boosts: 5/19 beat their average (26%); model said +2.1, got -1.3 per pick
NBA (model 2026-10-29-market): 8 picks (small sample: noise until ~100+)
- Prop lines: 5-2 (71%), +2.5 units at -110 (break-even 52.4%)
- Game spreads (model 4+ pts off the line): 1-0 (100%), +0.9 units at -110; vs the close: our way 0, against 0, avg +0.0
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: 16 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 38 graded picks with tags logged (small sample: noise until ~100+)
- no tags (3): props 2-1 +0.8u
- teammate out (w/o) (33): props 13-9 +2.8u, close our way 0/14 (avg +0.0); boosts 4/11 beat avg (36%), said +2.1 got -0.8
- b2b 2nd night (8): props 5-2 +2.5u, close our way 0/5 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- 2+ days rest (3): props 2-1 +0.8u
- high team total (14): props 5-2 +2.5u, close our way 0/3 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (4): props 1-3 -2.1u, close our way 0/4 (avg +0.0)
- hot H2H (5+ PRA over avg vs this opp) (3): props 1-2 -1.1u
- PRA picks (7): props 5-2 +2.5u
- PRA board (top 10 of the slate) (4): props 3-1 +1.7u
- PRA board: your book softer than the market (💰) (1): props 1-0 +0.9u
- PRA board: market agrees (its chance 50%+) (4): props 3-1 +1.7u
- PRA over, role player (avg < 20) (2): props 2-0 +1.8u
- sent < 2h before tip (30): props 14-9 +3.7u, close our way 0/16 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.7
- sent 2h+ before tip (8): props 3-1 +1.7u; boosts 2/4 beat avg (50%), said +1.8 got +0.7
- Model vs market on 4 picks (log loss, lower = better): market only 0.675, 25% model 0.658, 50% model 0.645, 75% model 0.636, model only 0.632; best model only (small sample)
- Minutes: projected 25.1, played 25.8 (avg miss 4.4, 1 picks 8+ min short); per-minute rate 123% of projected
- Didn't play (void): 2/40 (5%); on a b2b 2nd night 0/8 (0%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 21 picks (small sample: noise until ~100+)
- Projection boosts: 6/21 beat their average (29%); model said +2.1, got -1.7 per pick
NBA (model 2026-10-29-market): 8 picks (small sample: noise until ~100+)
- Prop lines: 5-2 (71%), +2.5 units at -110 (break-even 52.4%)
- Game spreads (model 4+ pts off the line): 1-0 (100%), +0.9 units at -110; vs the close: our way 0, against 0, avg +0.0
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: 16 with a close; it moved our way 0, against us 0, avg +0.0 (beating the close is the early sign of a real edge)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 38 graded picks with tags logged (small sample: noise until ~100+)
- no tags (3): props 2-1 +0.8u
- teammate out (w/o) (33): props 13-9 +2.8u, close our way 0/14 (avg +0.0); boosts 4/11 beat avg (36%), said +2.1 got -0.8
- b2b 2nd night (8): props 5-2 +2.5u, close our way 0/5 (avg +0.0); boosts 1/1 beat avg (100%), said +2.3 got +1.4
- 2+ days rest (3): props 2-1 +0.8u
- high team total (14): props 5-2 +2.5u, close our way 0/3 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (4): props 1-3 -2.1u, close our way 0/4 (avg +0.0)
- hot H2H (5+ PRA over avg vs this opp) (3): props 1-2 -1.1u
- PRA picks (7): props 5-2 +2.5u
- PRA board (top 10 of the slate) (4): props 3-1 +1.7u
- PRA board: your book softer than the market (💰) (1): props 1-0 +0.9u
- PRA board: market agrees (its chance 50%+) (4): props 3-1 +1.7u
- PRA over, role player (avg < 20) (2): props 2-0 +1.8u
- sent < 2h before tip (30): props 14-9 +3.7u, close our way 0/16 (avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.7
- sent 2h+ before tip (8): props 3-1 +1.7u; boosts 2/4 beat avg (50%), said +1.8 got +0.7
- Model vs market on 4 picks (log loss, lower = better): market only 0.675, 25% model 0.658, 50% model 0.645, 75% model 0.636, model only 0.632; best model only (small sample)
- Minutes: projected 25.1, played 25.8 (avg miss 4.4, 1 picks 8+ min short); per-minute rate 123% of projected
- Didn't play (void): 2/40 (5%); on a b2b 2nd night 0/8 (0%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 191 graded, 0 pending, 4 void.
