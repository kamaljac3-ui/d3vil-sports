// Builds archive.html: every daily roundup ever published, newest first,
// grouped by month. Runs in CI only, in the deploy job before seo.js (so the
// archive gets SEO tags and a sitemap entry too). Like seo.js it writes into
// the checked-out copy only and is never committed.
//
// The page reuses index.html's head, header and footer, so it always matches
// the homepage, and the same .post-card markup the homepage uses.
//
// Uses only Node's built-in fs/path (no npm install step needed in CI).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const pick = (re, s) => ((re.exec(s) || [])[1] || "").trim();

const files = fs.readdirSync(path.join(ROOT, "posts"))
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
  .sort()
  .reverse();

const months = new Map(); // "October 2026" -> [cards]
for (const f of files) {
  const html = read(`posts/${f}`);
  const longDate = pick(/<div class="date">([\s\S]*?)<\/div>/, html);
  const headline = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/, html);
  const desc = pick(/<meta name="description" content="([^"]*)"/, html);
  const month = longDate.replace(/ \d{1,2},/, "") || f.slice(0, 7);
  if (!months.has(month)) months.set(month, []);
  months.get(month).push(
    `      <a class="post-card" href="posts/${f}">\n` +
    `        <div class="date">${longDate}</div>\n` +
    `        <h2>${headline}</h2>\n` +
    (desc ? `        <p>${desc}</p>\n` : "") +
    `      </a>`);
}

const body = [...months].map(([m, cards]) =>
  `    <h2 class="archive-month">${m}</h2>\n${cards.join("\n")}`).join("\n\n");

const index = read("index.html");
const head = index.slice(0, index.indexOf("<main>"))
  .replace(/<title>[\s\S]*?<\/title>/, "<title>All roundups | 48th State Sports</title>")
  .replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="Every 48th State Sports daily roundup since August 2026: ${files.length} editions covering the NFL, NBA, MLB, college sports and more.">`);
const foot = index.slice(index.indexOf("</main>"));

fs.writeFileSync(path.join(ROOT, "archive.html"),
  `${head}<main>\n  <div class="wrap">\n    <a class="back-link" href="./">&larr; Home</a>\n` +
  `    <h1 class="archive-title">All roundups</h1>\n` +
  `    <p class="archive-sub">${files.length} daily editions, newest first.</p>\n\n${body}\n  </div>\n${foot}`);
console.log(`[archive] archive.html lists ${files.length} posts in ${months.size} months`);
