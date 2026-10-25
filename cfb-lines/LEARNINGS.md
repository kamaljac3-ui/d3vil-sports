# CFB Lines: what we've learned

**Read this first** before changing the model, a threshold or an alert rule. Then read the latest weekly review
(`cfb/SUMMARY.md` on the `bot-results` branch). Add what you find here, including the ideas that failed.

**The rule (agreed with Kamal):** an angle goes into the model only if it beats an **out-of-sample** backtest
(fit on 2021–22, graded on 2023–25, never tuned on the test seasons). Otherwise it is an informational tag at most,
and the weekly review grades it on real sent picks. A good few weeks of live picks is never enough on its own.

Spreads and totals only. Kamal can't bet CFB player props, so there are none.

## Model versions

Every logged pick carries `ver`. Bump `MODEL_VERSION` in `model.js` on any change that moves our numbers or which
games get a ✅ (model math or defaults, a new `params.json`, edge rules), and add a line here.

| version | live from | what |
|---|---|---|
| v1 | 2026-09-27 | Params fitted on 2021–22 (`params.json`). Altitude climb pinned at 1.5 pts/km; descent, humidity and heat pinned at 0. ✅ = spread edge ≥ 4 from week 4; totals off. |

Weeks 5–8 of 2026 were seeded into the ledger from run logs (our number rounded to 0.5, no availability/weather fields).
Logging every card with full context starts once this change (`logPicks` in `run.js`) is on `main`.

## Factors tested so far

"Fit" = the seasons the coefficient was fitted on (2021–22). "OOS" = 2023–25, never seen by the fit.
ATS is against the opener (the Sunday first look) unless it says close. Breakeven at -110 is 52.4%.

### The core edge

| idea | fit 2021–22 | OOS 2023–25 | live 2026 (wk 4+, backtest replay) | status |
|---|---|---|---|---|
| Spread edge ≥ 4 vs the **opener** | 57.4% (477), line moved our way 56% | 54.2% (770), moved our way 57%, +0.8 pts | 57.9% (107), moved our way 58% | **In the model.** Small and about 1 SE above breakeven; the CLV that grows with edge size is the real signal. |
| Same picks vs the **close** | 54.1% (473) | 51.9% (740) | 51.6% (93) | No edge at the close. Bet the first look; game-day alerts are news, not new bets. |
| Edge size: line moves more for bigger edges | 56% → 60% (edge 4 → 8) | 57% → 62% → 64% (4 / 8 / 10) | 58% → 67% (4 / 8) | Holds everywhere. The best evidence the model knows something the opener doesn't. |
| Weeks 1–3 (priors-heavy) | n/a | 49.2% at edge ≥ 4 (195) | n/a | **Rule:** no ✅ before week 4 (`MIN_WEEK`). |
| Edge > 14 | n/a | not tested separately (edge ≥ 10: 53.3%, 92) | n/a | **Rule by judgment:** shown with ⚠️, not ✅ (`MAX_EDGE`). Usually news the model hasn't seen. |
| Model accuracy | MAE 12.9/12.0 vs close 12.5/12.1 | MAE 12.4 vs close 12.0 | n/a | The model is a second opinion on early numbers, not a better line. |

### Totals

| idea | fit 2021–22 | OOS 2023–25 | live 2026 | status |
|---|---|---|---|---|
| Total edge ≥ 4 vs opener | 53.2% (515) | 53.1% (778) | 55.6% (108) | **Off** (`TOTAL_EDGES=0`). Around breakeven. Tracked as leans in the review. |
| Total edge ≥ 8 vs opener | 59.5% (158) | 55.1% (227) | 56.7% (30) | Off. Looks good but small; would be the first thing to re-test. |

### Situational adjustments (margin, home perspective)

All fitted on 2021–22 by ridge regression pulled toward a default; they're judged OOS only as part of the whole model.

| factor | fitted value | evidence | status |
|---|---|---|---|
| Home field | 1.6 pts | fit | In the model |
| Crowd size | +1.4 pts per 25k seats above 50k (penalty below) | fit; see "no crowd-size term" below | In the model (open question) |
| Travel | +0.7 pts per 1,000 extra miles the visitor flew | fit (an early default had the sign backwards; the fit caught it) | In the model |
| Time zones | +0.1 per zone | fit, tiny | In the model |
| Rest | +0.14 pts per day of rest advantage (byes included, capped at 7) | fit | In the model |
| QB change | −5.3 pts margin, −2.1 total | fit on box-score starter changes | In the model (live: availability report × status weight) |
| Skill players / defenders out | usage share × 8, tackle share × 10 | **no history to test** | In the model as conservative defaults. Untested. |
| Wind (totals) | −1.2 per mph above 15 (59 games) | fit | In the model |
| Rain (totals) | −1.8 (4 games) | fit, very weak | In the model |
| Cold (totals) | −1.1 below 25°F | fit | In the model |

### Altitude, humidity and heat

Each is measured against the team's own home ("how much higher, muggier or hotter than you're used to"). Too few
games move them for a stable fit, so they're **pinned** (ridge λ = 1e9 in `backtest.js`) and re-tested by the evidence
table on every backtest. The table below is a one-factor regression over all of 2021–25 (it can't be split fit/OOS
because nothing was fitted).

| factor | research | our data, 2021–25 (pts per unit ± SE) | status |
|---|---|---|---|
| Visitor climbing into altitude (per km above 1,000 m) | Strong: Allen 2026 (~15k FBS games) +1.5–3 pts; BMJ 2007 soccer | +1.84 ± 1.83; 0.8+ km bucket (28 games): +3.3 vs our model, +2.5 vs close, but 48.1% ATS | **In the model, pinned at 1.5/km** (research and data agree in direction; data alone can't tell it from 0) |
| Visitor coming down from altitude | Weak, no football evidence | +0.65 ± 1.67 | **Rejected** (pinned 0) |
| Humidity (kickoff dew point vs home norm, per 10°F) | Not studied on its own | −0.77 ± 0.66 (wrong way) | **Rejected** (pinned 0). Info only: dew point shows in the alert's reasons. |
| Heat (kickoff temp vs home norm, per 10°F) | Moderate, NFL (−0.15 pts/°F for northern teams) | −2.43 ± 1.09 (wrong way, likely confounded with early-season scheduling) | **Rejected** (pinned 0). Don't let the fit set it: the noise-fitted value would hurt picks. |

### Candidate adjustments (Oct 2026 backtest; model changes refit on 2021–22, graded on 2023–25 and live 2026)

Edge ≥ 4 vs the opener, weeks ≥ 4. Current model: OOS 417-353 (54.2%), moved our way 57%; 2026 62-45 (57.9%), 58%.

| change | OOS 2023–25 | 2026 | status |
|---|---|---|---|
| Home edge never below 1 pt | 54.5%, 57% | 55.8%, 56% | Rejected (no real gain) |
| Small-stadium penalty capped (crowd z ≥ −0.4) | 54.7%, 57% | 56.0%, 58% | Rejected (no real gain) |
| **No crowd-size term** | **56.5%** (428-330), 57% | 59.1%, 54% | **Not adopted yet.** Best OOS win% (+2.3 pts, about 1.3 SE) but CLV no better, and 2026 CLV is worse. Open question 1. |
| Skip edges over 8 | 53.6%, 55% | 58.3%, 56% | Rejected (big edges are the best CLV) |
| Skip lines of 14+ | 52.4%, 59% | 54.3%, 56% | Rejected |
| Edge ≥ 5 | 54.7%, 59% | 53.4%, 58% | Rejected (not clearly better than 4; fewer picks) |
| Edge ≥ 3 | 54.5%, 56% | 53.2%, 56% | Rejected |

### Situation splits (edge ≥ 4 vs opener; description only, nothing adopted)

| split | OOS 2023–25 | 2026 |
|---|---|---|
| On the underdog / favorite | 53.4% / 55.9% | 54.3% / 64.9% |
| Line under 7 / 7–14 / 14+ | 52.3% / 52.6% / 58.8% | 60.5% / 47.4% / 69.2% |
| Home / road team | 54.2% / 54.1% | 60.7% / 54.3% |
| Home stadium under ~30k seats | 52.9% (CLV 54%) | 50.0% (CLV 65%) |

## What the weekly review tracks

`cfb-lines/review.js` runs in the CFB Lines workflow on Monday from 8 AM ET (Tuesday as a backup; `mode=review`
runs it now). It grades every pick the bot logged on a real send and writes `cfb/SUMMARY.md` on `bot-results`.

- **Bet** = a first-look ✅ spread. **Lean** = our side of every priced game in a card, logged too so tags have a sample.
- Graded W-L-push, units at -110 (CFBD has no prices), beat-the-close %, avg CLV ± SE. CLV first.
- Split overall, by model version, by card (first / update / final / gameday), by edge size, by tag, and by situation.
- **Tags** (in `review.js` `tags()`, oriented to our side): rest (short week, off a bye), altitude climb/descent,
  humidity/heat vs home, travel 1,000+ mi, 2+ time zones, small home crowd, neutral site, weather (wind 15+, rain,
  cold, muggy, hot), availability outs (QB, OL, DB, 3+ players; ours and theirs), weeknight. "No tags" is the baseline.
- Tags are computed from the logged fields, so a new tag can be added to `tags()` and applied to past picks.
- Logged per pick: model version, params date, card, minutes to kickoff, line at alert time (+ opener), our number,
  conference game, neutral, rest days per team, the model's situational features, kickoff weather, availability
  outs by position group, and the alert's "Why:" text.

## Open questions for the weekly review

1. **Crowd size.** Does "small home crowd" (crowd z ≤ −0.8) underperform the baseline on CLV? The OOS test says
   dropping the term helps win% but not CLV. Needs ~50 tagged bets before saying anything; then re-run the variant.
2. **Is the opener edge holding live?** Bets' beat-the-close % should sit near the backtest's 57%. Below 50% after
   ~50 bets means the edge isn't showing up.
3. **Does CLV grow with edge size live** the way it does in every backtest season?
4. **Big lines (14+).** 58.8% OOS and 69% in 2026 but CLV only 51% OOS. Real, or noise in blowouts?
5. **Later cards.** Do update/final/gameday ✅ picks beat the close at all? The backtest says the edge is gone by
   kickoff; if live agrees, those cards are news only.
6. **Availability.** Opponent QB out or 3+ players out: do we under- or over-adjust? (The non-QB weights have never been tested.)
7. **Altitude climb** (only a handful of games a year): keep collecting; 0.8+ km climbs are the cases to watch.
8. **Totals edge ≥ 8.** Tracked as leans. Worth a re-test if live CLV is clearly positive.
9. **Weeknight (MACtion) and short weeks.** No backtest yet; tags only.
