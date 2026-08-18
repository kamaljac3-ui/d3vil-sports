# Full Slate — daily update procedure

This file is the complete, self-contained procedure for producing one day's
roundup. Follow it exactly so the site stays consistent day to day.

## 1. Figure out "today"

Run `date -u +%Y-%m-%d` (UTC) to get today's date. If a post for that date
already exists at `posts/<date>.html`, stop — today's post is already done,
do not duplicate it.

## 2. Gather material, per category

Cover all ten, in this order: **NFL, CFB, NBA, NCAAM, WNBA, NCAAW, MLB, NHL,
UFC, Boxing**. (CFB = college football. NCAAM = men's college basketball.
NCAAW = women's college basketball. UFC covers MMA generally, not just
UFC-promoted cards.)

For each category:

1. Pull the baseline ESPN news RSS feed:
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
2. Also do a broad web search for what's actually being talked about around
   that category in the last 24-48 hours. RSS alone under-covers
   front-office drama, contract disputes, suspensions, fight-card
   changes, and off-field storylines — search explicitly for those too.
   **Off-field stories are in scope, including relationship/dating news
   about players/fighters, as long as it's a real story multiple outlets
   are actually covering** — not manufactured filler, and not anything
   from a single unreliable tabloid source.
3. Note that CFB, NCAAM, and NCAAW are seasonal — during their offseason,
   news will mostly be recruiting, transfer portal, and coaching moves.
   That's fine, cover what's actually happening rather than forcing
   in-season-style content.
4. From everything gathered, pick the 2-4 most *substantial* stories for
   that category — the ones a genuinely engaged fan would want to know
   about today. Substantial means: trades, signings, injuries,
   suspensions, coaching/front-office moves, contract disputes, retirement
   news, a fight/bout being announced or falling apart, significant game
   or result with real stakes, or a widely-covered off-field storyline.
   Skip minor transactions and routine recaps with no broader
   significance.
5. If a category genuinely has nothing substantial that day, it's fine to
   include just 1 story, or a single short "quiet day" line — don't pad.

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
same Google Fonts `<link>` tags, same `<div class="spectrum-bar"></div>`,
same `.jump-nav` block, and the same ten `<section class="league-section
CATEGORY" id="slug">` blocks in NFL/CFB/NBA/NCAAM/WNBA/NCAAW/MLB/NHL/
UFC/Boxing order (id values: nfl, cfb, nba, ncaam, wnba, ncaaw, mlb, nhl,
ufc, boxing — lowercase, matching the `.jump-nav` anchors already in the
template; don't change these).

For the new file `posts/<date>.html`:

- Set `<title>` to `Month D, YYYY — Full Slate`.
- Set the meta description to a one-sentence summary of the day's biggest
  headline across all categories.
- Set `.post-header .date` to the human-readable date and `<h1>` to a short
  punchy headline capturing the day's biggest storyline (not "Daily
  Roundup" — an actual headline, e.g. "MVP candidate out 6 weeks, and a
  trade that changes the AL wild card race").
- Leave the `.jump-nav` block exactly as in the template (all ten links).
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

## 6. Commit and push

```
git add index.html posts/
git commit -m "Add <date> roundup"
git push
```

Pushing to `main` triggers the GitHub Pages deployment automatically (via
`.github/workflows/deploy.yml`) — no separate deploy step needed.

## 7. If something fails

If an RSS feed is unreachable or a search turns up nothing usable for a
category, don't block the whole post on it — note it in that section as a
single "Nothing significant to report today" line and continue with the
other categories. Always still commit and push whatever was successfully
gathered.
