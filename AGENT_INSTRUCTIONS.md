# D3vil Sports — daily update procedure

This file is the complete, self-contained procedure for producing one day's
roundup. Follow it exactly so the site stays consistent day to day.

## 1. Figure out "today"

Run `date -u +%Y-%m-%d` (UTC) to get today's date. If a post for that date
already exists at `posts/<date>.html`, stop — today's post is already done,
do not duplicate it.

## 2. Gather material, per category

Cover all twelve, in this order: **NFL, CFB, NBA, NCAAM, WNBA, NCAAW, MLB,
NHL, UFC, Boxing, Golf, Horse Racing**. (CFB = college football. NCAAM =
men's college basketball. NCAAW = women's college basketball. UFC covers
MMA generally, not just UFC-promoted cards. Horse Racing covers the major
US circuits/stakes races, not just Triple Crown season.)

For each category:

1. Pull the baseline ESPN news RSS feed where one exists:
   - NFL:    https://www.espn.com/espn/rss/nfl/news
   - CFB:    https://www.espn.com/espn/rss/ncf/news
   - NBA:    https://www.espn.com/espn/rss/nba/news
   - NCAAM:  https://www.espn.com/espn/rss/ncb/news
   - WNBA:   https://www.espn.com/espn/rss/wnba/news
   - NCAAW:  https://www.espn.com/espn/rss/ncw/news
   - MLB:    https://www.espn.com/espn/rss/mlb/news
   - NHL:    https://www.espn.com/espn/rss/nhl/news
   - UFC:    https://www.espn.com/espn/rss/mma/news
   - Boxing: https://www.espn.com/espn/rss/boxing/news
   - Golf:   https://www.espn.com/espn/rss/golf/news
   - Horse Racing: no reliable baseline RSS feed — rely on web search for
     this one (see step 2).
2. Also pull from at least 2-3 of these per category, not just ESPN —
   RSS/search results skew toward whatever's easiest to find, and relying
   on one feed is exactly how stale stories slip through:
   - The league's own news page (nba.com/news, nhl.com/news, mlb.com/news,
     wnba.com/news, nfl.com/news, ncaa.com, pgatour.com, ufc.com/news) —
     these post daily even in quiet stretches (minor transactions, G-League
     call-ups, practice-squad moves, injury-report updates) that ESPN's
     RSS often skips.
   - A transactions tracker (spotrac.com/<league>/transactions,
     prosportstransactions.com) to catch same-day roster moves.
   - A direct, date-anchored search: `"<league> news" "<today's date>"` or
     `"<league> transactions today"` — not just a generic topic search,
     which tends to surface whatever's most-linked (often weeks old)
     rather than what's newest.
   - For pro leagues in their offseason (e.g. NBA/NHL in July-September),
     also check: Summer League/prospect news, front-office and coaching
     staff hires below head-coach level, contract extensions or option
     decisions hitting deadlines, guaranteed-date roster cuts, and
     international/preseason news involving the league's players. These
     are genuinely NEW even when there's no game-result news to report.
3. **Freshness bar:** prefer stories from the last 24-48 hours. A story is
   only "current" because a trade or signing *happened* recently — if the
   underlying event is from weeks or months ago (a June trade, a July
   signing) and nothing new has occurred since, that story is stale, not
   news, even if it's still the most-discussed topic in search results.
   Two ways to handle an old-but-still-relevant storyline:
   - If there's a genuine new development on it (a status update, a
     reaction, a related move), write the story around *that* new angle,
     not a recap of the original event.
   - If there's truly nothing new, drop it rather than re-reporting
     old news as if it just happened.
   This applies most to injuries specifically: report the *latest* status
   and timeline, not a recap of the original injury news from days/weeks
   back — search for "<player> injury update" to confirm you have the
   current state, not the initial report.
4. Before finalizing, check the last 1-2 prior posts (read
   `posts/latest.html` and, if it exists, the post before it) so you don't
   run the same story two nights in a row without a genuinely new
   development since then.
5. CFB, NCAAM, and NCAAW are seasonal, but "offseason" doesn't mean
   "nothing to cover" — widen what counts:
   - Leadership/administrative moves are news year-round, not just head
     coaching changes: athletic director hires and firings are exactly as
     newsworthy as a coaching change and should be covered the same way.
   - CFB starts its season in late August, so as that approaches, camp
     battles, depth-chart news, preseason injuries, and marquee
     season-opener previews are all fair game even before Week 1 — don't
     wait for kickoff to start covering it like an in-season sport if
     camp is already generating real news.
   - Once CFB/NCAAM/NCAAW are actually in season, treat them like any
     other in-season league under point 6 below: a ranked team getting
     upset by an unranked one, or a standout individual performance in a
     marquee game (e.g. a QB throwing for 400 yards to lead the No. 1
     team to a win), is exactly the kind of substantial, fresh story to
     lead with — not just recruiting/transfer-portal news once there are
     actual games being played.
   Golf and Horse Racing run nearly year-round but news volume swings
   hard around major weeks (majors/playoffs for golf; Triple Crown season
   and the Breeders' Cup for horse racing) versus quiet weeks. In all
   cases, cover what's actually happening rather than defaulting to
   recruiting/portal news when a sport is actually generating real,
   fresher storylines.

   The same "offseason still has real news" principle applies to NHL and
   NBA in their offseasons too — arbitration cases, offer sheets,
   entry-level contract signings, prospect development camps, and
   front-office moves are all genuine daily stories even without games,
   not just the same handful of marquee trade rumors rehashed night after
   night. And UFC/MMA in particular has an almost constant news cycle —
   fight announcements, rankings shakeups, callouts, weigh-ins, injury
   pullouts, contract disputes — regardless of whether an event is
   actually happening that day, so it should never come up thin just
   because there's no card this week.
6. **For every category, first check whether that league/sport currently
   has games being played** — don't assume from a fixed list, since this
   changes throughout the year (as of this writing, MLB and WNBA are both
   in season with games most nights; NBA, NHL, and the college sports are
   not — but that will change, and this file won't always be updated the
   day it does). If a league has games happening, always check last
   night's/that day's box scores and game recaps for standout individual
   performances and notable results, not just transaction news. A
   multi-homer game, a robbed grand slam, a walk-off, a triple-double, a
   buzzer-beater, a milestone stat line — this is exactly the kind of
   daily, fresh, substantial content an in-season league should be full
   of, and it's easy to under-cover if you only search for
   trades/injuries/suspensions. Search things like "<league> top
   performances last night", "<league> recap <date>", or a specific
   team's recap page, in addition to transaction news. Do not let a day
   where real games were played end up covered only by roster moves —
   that applies to every in-season league equally, not just whichever one
   happened to have a big trade recently.
7. From everything gathered, pick the 2-4 most *substantial and fresh*
   stories for that category — the ones a genuinely engaged fan would want
   to know about today. Substantial means: trades, signings, injuries,
   suspensions, coaching/front-office/athletic-director moves, contract
   disputes, retirement news, a fight/bout being announced or falling
   apart, a standout
   individual performance or notable result from that day's games, a big
   tournament/stakes-race result or leaderboard swing, or a widely-covered
   off-field storyline. Skip minor transactions and routine recaps with
   no broader significance.
8. If a category genuinely has nothing substantial and fresh that day,
   it's fine to include just 1 story, or a single short "quiet day" line
   — don't pad with stale news just to fill space.

## 3. Write it up — copyright rules (non-negotiable)

- Every story is written **in your own original words** — a 2-3 sentence
  summary of what happened and why it matters. Never copy sentences from
  the source article.
- At most one short quote per story, under 15 words, in quotation marks,
  attributed to who said it.
- Never reproduce a full headline verbatim as your story title if the
  source's headline is distinctive — paraphrase it.
- Always link to the original source article so readers can read the full
  story there.

## 4. Build today's post page

Copy `posts/2026-08-17.html` as a structural template: same HTML shell,
same Google Fonts `<link>` tags, same theme-toggle `<script>` in `<head>`
and the `<button class="theme-toggle">` + its `toggleTheme()` `<script>`
right after `<body>` (this is what makes the site start in dark mode and
lets visitors switch to light — do not drop it), same
`<div class="spectrum-bar"></div>`,
same `.jump-nav` block, and the same twelve `<section class="league-section
CATEGORY" id="slug">` blocks in NFL/CFB/NBA/NCAAM/WNBA/NCAAW/MLB/NHL/UFC/
Boxing/Golf/HorseRacing order (id values: nfl, cfb, nba, ncaam, wnba,
ncaaw, mlb, nhl, ufc, boxing, golf, horse-racing — lowercase, matching the
`.jump-nav` anchors already in the template; note the class for horse
racing is `HorseRacing` — no space, no hyphen — while its id is
`horse-racing`; don't change these).

For the new file `posts/<date>.html`:

- Set `<title>` to `Month D, YYYY — D3vil Sports`.
- Set the meta description to a one-sentence summary of the day's biggest
  headline across all categories.
- Set `.post-header .date` to the human-readable date and `<h1>` to a short
  punchy headline capturing the day's biggest storyline (not "Daily
  Roundup" — an actual headline, e.g. "MVP candidate out 6 weeks, and a
  trade that changes the AL wild card race").
- Leave the `.jump-nav` block exactly as in the template (all twelve links).
- Inside each `.league-section`, replace the placeholder `.story` blocks
  with one `.story` div per real story:
  ```html
  <div class="story">
    <h3>Short original headline for this story</h3>
    <p>2-3 sentence original summary.</p>
    <p class="src">Source: <a href="https://...">Outlet Name</a></p>
  </div>
  ```
- If a category has multiple stories, include multiple `.story` blocks in
  that section, most important first. If a category only has the
  "quiet day" case, still keep the `<section>`/`<h2>` wrapper (for the
  jump-nav anchor) but with a single one-line `.story`.

## 5. Add the entry to the homepage

In `index.html`, insert a new `.post-card` immediately after the
`<!-- POSTS:START -->` marker (so newest is always first):

```html
<a class="post-card" href="posts/<date>.html">
  <div class="date">Month D, YYYY</div>
  <h2>Same headline used on the post page</h2>
  <p>One-sentence teaser summarizing the day across the categories with real news.</p>
</a>
```

Leave every earlier `.post-card` in place below it — this is an append-only
archive. Do not delete or rewrite old posts.

## 6. Update the "latest" alias

The homepage's league chips (in the `.leagues-legend`) link to
`posts/latest.html#<slug>` — a stable URL that always points at whatever
today's post is, so those links never need editing. After finishing
`posts/<date>.html`, copy it to `posts/latest.html`, overwriting whatever
was there:

```
cp posts/<date>.html posts/latest.html
```

(On Windows/PowerShell use `Copy-Item posts/<date>.html posts/latest.html
-Force` instead.) Do this every day — it's the one file in `posts/` that
*is* meant to be overwritten rather than appended to.

## 7. Commit and push

```
git add index.html posts/
git commit -m "Add <date> roundup"
git push
```

Pushing to `main` triggers the GitHub Pages deployment automatically (via
`.github/workflows/deploy.yml`) — no separate deploy step needed.

That same push also triggers the newsletter send (a separate job in the
same workflow, using `scripts/send-newsletter.js`) if it detects a newly
added file under `posts/`. This is fully automatic — do not send an email,
call any newsletter API, or otherwise duplicate this. Just commit and push
the post as normal and the workflow handles the rest.

## 8. If something fails

If an RSS feed is unreachable or a search turns up nothing usable for a
category, don't block the whole post on it — note it in that section as a
single "Nothing significant to report today" line and continue with the
other categories. Always still commit and push whatever was successfully
gathered.
