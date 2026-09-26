# NBA Edges

NBA matchup alerts sent to ntfy: shot-zone edges plus per-game stat projections. It's the NBA version of `launch-angle/`, comparing a player's own tendencies with what tonight's opponent gives up.

## Model (`model.js`)

- **Shot-zone matchups:** the player's per-game FGA and FG% by zone (rim, paint, mid-range, left/right corner 3, above-the-break 3), with FG% shrunk by 30 league-average attempts. Each zone is weighted by how well the opponent defends it (opponent-allowed FG% ÷ league) and how often they allow it (√ of zone-share ÷ league). Both factors are clamped to 0.85–1.15. The output is points gained or lost from the shot mix.
- **Projections** for PTS, REB, AST and 3PM start from the season average and apply:
  - minutes: 50/50 season and last-10
  - the zone factor
  - scoring environment: implied team total from the ESPN total/spread ÷ team PPG, or opponent pace
  - opponent rebounds and assists allowed ÷ league
  - blowout trim for starters when the spread is 12 or more
  - teammates ruled out: 70% of their output is spread across the rotation. This only counts players who have been playing, since a long absence is already in everyone's averages.
- **Season blend:** until a player has about 15 games, last season is mixed in.

## Modes (`run.js`)

| `MODE` | What it does |
|---|---|
| `morning` | Whole slate, one push listing the top `TOP_N` shot-zone edges, prop lines and projection boosts. |
| `pregame` | Games tipping within `PREGAME_MIN` (90) minutes. Fresh injuries, plus prop lines if `ODDS_API_KEY` is set. One push per game, sent once. |
| `snapshot` | Saves stats.nba.com data to `data/nba-stats.json`. Run it on a PC with `snapshot.cmd` (pull, snapshot, commit, push that one file). |
| `probe` | Reports which data sources the current machine can reach. |

Workflow: `.github/workflows/nba-edges-alerts.yml`. Morning runs at 15:00 UTC, and pregame checks every 30 min from 16:00 to 04:30 UTC, October–June.

## Data sources

- **ESPN** (no key): schedule, spread/total, injuries, rosters, and ESPN-only fallback stats. It 403s custom bot user agents, and a spoofed Chrome agent from GitHub runners, so requests use Node's default agent.
- **stats.nba.com** (no key): shot zones, pace, opponent stats. It **times out from GitHub runners**, which is why the Action reads the committed snapshot. The snapshot is used if it's under 36h old. Otherwise the Action tries live nba.com, then a snapshot up to 7 days old, then ESPN only (no zones or opponent adjustments).
- **The Odds API** (optional `ODDS_API_KEY`): player points, rebounds, assists and threes lines, taking the median across US books. Each game costs credits per market.

## Settings (env)

`TOP_N` (6), `ZONE_MIN` (1.0 pts), `BOOST_MIN` (0.10), `P_MIN` (0.58), `PREGAME_MIN` (90), `ODDS_IN_MORNING` (0), `DATE` (test a past slate; keeps finished games), `FORCE_ESPN` (1 = skip nba.com), `DRY_RUN`.

## Cache (`.cache/`)

- `data-<season>.json`: 12h
- `r-<team>-<date>.json`: 12h
- `odds-events-<date>.json`: 3h
- `morning-<date>.json` / `pregame-<date>.json`: sent markers
- `picks-<date>.json`: sent picks, graded by `results/`

## Known limits

- Injuries: only Out/Doubtful players are dropped. Day-to-day players who sit will still be flagged in the morning scan, which is why the pregame check re-pulls injuries.
- Testing a past `DATE` uses today's ESPN rosters, so offseason moves put some players on the wrong team.
