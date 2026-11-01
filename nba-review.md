# NBA weekly review

Updated 2026-11-01. Ledger: `nba.json` on this branch. Read with `nba-edges/LEARNINGS.md` on main.

## Last 7 days

NBA (model pre-2026-10-24): 19 picks (small sample: noise until ~100+)
- Projection boosts: 3/4 beat their average (75%); model said +2.0, got +1.1 per pick
- Prop lines: 9-6 (60%), +2.2 units at -110 (break-even 52.4%)
NBA (model nba-news): 15 picks (small sample: noise until ~100+)
- Projection boosts: 9/15 beat their average (60%); model said +2.9, got +2.2 per pick
NBA (model 2026-10-29-market): 55 picks (small sample: noise until ~100+)
- Projection boosts: 12/17 beat their average (71%); model said +2.9, got +2.1 per pick
- Prop lines: 19-13 (59%), +4.3 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 3 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 4-2 (67%), +1.6 units at -110; vs the close: our way 0, against 1, avg -0.2
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 16 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 88 graded picks with tags logged (small sample: noise until ~100+)
- no tags (6): props 2-4 -2.2u, close our way 0, against 0 of 1 (line avg +0.0)
- teammate out (w/o) (75): props 23-16 +4.9u, close our way 0, against 0 of 15 (line avg +0.0); boosts 23/36 beat avg (64%), said +2.8 got +2.0
- b2b 2nd night (22): props 10-4 +5.1u, close our way 0, against 0 of 6 (line avg +0.0); boosts 5/8 beat avg (63%), said +2.7 got +1.7
- 2+ days rest (14): props 6-1 +4.5u; boosts 6/7 beat avg (86%), said +3.2 got +2.8
- high team total (19): props 7-5 +1.4u, close our way 0, against 0 of 3 (line avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (11): props 3-3 -0.3u, close our way 0, against 0 of 5 (line avg +0.0); boosts 4/5 beat avg (80%), said +3.0 got +3.4
- 8+ pt underdog (14): props 4-0 +3.6u, close our way 0, against 0 of 2 (line avg +0.0); boosts 8/10 beat avg (80%), said +2.9 got +5.3
- cold H2H (5+ PRA under avg vs this opp) (8): props 4-2 +1.6u, close our way 0, against 0 of 1 (line avg +0.0); boosts 0/2 beat avg (0%), said +2.2 got -2.2
- hot H2H (5+ PRA over avg vs this opp) (5): props 2-3 -1.2u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (41): props 19-13 +4.3u, close our way 0, against 0 of 3 (line avg +0.0); boosts 7/9 beat avg (78%), said +4.7 got +4.2
- PRA board (top 10 of the slate) (23): props 14-9 +3.7u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: your book softer than the market (💰) (6): props 5-1 +3.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (17): props 10-7 +2.1u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market disagrees (under 50%) (6): props 4-2 +1.6u
- PRA over, star (avg 30+) (2): props 1-1 -0.1u
- PRA under, star (avg 30+) (5): props 2-3 -1.2u
- PRA over, role player (avg < 20) (5): props 3-2 +0.7u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (3): props 2-1 +0.8u
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- star teammate back (3): props 0-1 -1.0u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (48): props 17-12 +3.5u, close our way 0, against 0 of 18 (line avg +0.0); boosts 11/19 beat avg (58%), said +2.6 got +1.8
- sent 2h+ before tip (40): props 14-9 +3.7u, close our way 0, against 0 of 1 (line avg +0.0); boosts 12/17 beat avg (71%), said +3.1 got +2.2
- Model vs market on 23 picks (log loss, lower = better): market only 0.685, 25% model 0.683, 50% model 0.690, 75% model 0.709, model only 0.741; best 25% model (small sample)
- Minutes: projected 24.8, played 25.8 (avg miss 4.6, 3 picks 8+ min short); per-minute rate 107% of projected
- Didn't play (void): 3/91 (3%); on a b2b 2nd night 0/22 (0%)

## Season (by model version when there's more than one)

NBA (model pre-2026-10-24): 130 picks
- Projection boosts: 11/19 beat their average (58%); model said +2.1, got +1.2 per pick
- Prop lines: 65-46 (59%), +13.1 units at -110 (break-even 52.4%)
NBA (model nba-news): 29 picks (small sample: noise until ~100+)
- Projection boosts: 13/29 beat their average (45%); model said +2.5, got +0.3 per pick
NBA (model 2026-10-29-market): 55 picks (small sample: noise until ~100+)
- Projection boosts: 12/17 beat their average (71%); model said +2.9, got +2.1 per pick
- Prop lines: 19-13 (59%), +4.3 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 3 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 4-2 (67%), +1.6 units at -110; vs the close: our way 0, against 1, avg -0.2
NBA (model 2026-10-24-rosters): 32 picks (small sample: noise until ~100+)
- Projection boosts: 2/4 beat their average (50%); model said +1.8, got +0.7 per pick
- Prop lines: 12-8 (60%), +2.9 units at -110 (break-even 52.4%)
  - Closing line: close our way 0, against 0 of 16 (line avg +0.0) (beating the close is the early sign of a real edge; closes before 2026-11-01 were taken in the same run as the pick, so they read 0)
- Game spreads (model 4+ pts off the line): 3-5 (38%), -2.3 units at -110; vs the close: our way 3, against 0, avg +0.6

NBA by tag: 88 graded picks with tags logged (small sample: noise until ~100+)
- no tags (6): props 2-4 -2.2u, close our way 0, against 0 of 1 (line avg +0.0)
- teammate out (w/o) (75): props 23-16 +4.9u, close our way 0, against 0 of 15 (line avg +0.0); boosts 23/36 beat avg (64%), said +2.8 got +2.0
- b2b 2nd night (22): props 10-4 +5.1u, close our way 0, against 0 of 6 (line avg +0.0); boosts 5/8 beat avg (63%), said +2.7 got +1.7
- 2+ days rest (14): props 6-1 +4.5u; boosts 6/7 beat avg (86%), said +3.2 got +2.8
- high team total (19): props 7-5 +1.4u, close our way 0, against 0 of 3 (line avg +0.0); boosts 2/7 beat avg (29%), said +2.3 got -1.5
- blowout risk (11): props 3-3 -0.3u, close our way 0, against 0 of 5 (line avg +0.0); boosts 4/5 beat avg (80%), said +3.0 got +3.4
- 8+ pt underdog (14): props 4-0 +3.6u, close our way 0, against 0 of 2 (line avg +0.0); boosts 8/10 beat avg (80%), said +2.9 got +5.3
- cold H2H (5+ PRA under avg vs this opp) (8): props 4-2 +1.6u, close our way 0, against 0 of 1 (line avg +0.0); boosts 0/2 beat avg (0%), said +2.2 got -2.2
- hot H2H (5+ PRA over avg vs this opp) (5): props 2-3 -1.2u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA picks (41): props 19-13 +4.3u, close our way 0, against 0 of 3 (line avg +0.0); boosts 7/9 beat avg (78%), said +4.7 got +4.2
- PRA board (top 10 of the slate) (23): props 14-9 +3.7u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: your book softer than the market (💰) (6): props 5-1 +3.5u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market agrees (its chance 50%+) (17): props 10-7 +2.1u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA board: market disagrees (under 50%) (6): props 4-2 +1.6u
- PRA over, star (avg 30+) (2): props 1-1 -0.1u
- PRA under, star (avg 30+) (5): props 2-3 -1.2u
- PRA over, role player (avg < 20) (5): props 3-2 +0.7u, close our way 0, against 0 of 1 (line avg +0.0)
- PRA under, role player (avg < 20) (3): props 2-1 +0.8u
- listed questionable / day-to-day / probable (1): props 0-1 -1.0u
- star teammate back (3): props 0-1 -1.0u; boosts 0/2 beat avg (0%), said +2.2 got -2.2
- sent < 2h before tip (48): props 17-12 +3.5u, close our way 0, against 0 of 18 (line avg +0.0); boosts 11/19 beat avg (58%), said +2.6 got +1.8
- sent 2h+ before tip (40): props 14-9 +3.7u, close our way 0, against 0 of 1 (line avg +0.0); boosts 12/17 beat avg (71%), said +3.1 got +2.2
- Model vs market on 23 picks (log loss, lower = better): market only 0.685, 25% model 0.683, 50% model 0.690, 75% model 0.709, model only 0.741; best 25% model (small sample)
- Minutes: projected 24.8, played 25.8 (avg miss 4.6, 3 picks 8+ min short); per-minute rate 107% of projected
- Didn't play (void): 3/91 (3%); on a b2b 2nd night 0/22 (0%)

## How much to trust it

- Under ~100 graded picks a group is noise. Closing-line value (did the line move our way after the alert?) settles faster than W-L: about 50 picks with a close.
- A tag only matters against the "no tags" row in the same table, and only if it holds week after week.
- 246 graded, 0 pending, 5 void.
