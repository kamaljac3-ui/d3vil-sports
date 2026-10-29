// Adds search and social-share tags to the site at deploy time, and writes
// sitemap.xml. Runs in CI only, inside the deploy job just before the Pages
// upload — see .github/workflows/deploy.yml. It edits the checked-out copy,
// never the repo, so the daily routine's posts stay exactly as written and
// nothing here can trigger a newsletter send. Safe to run twice (skips
// anything already tagged).
//
// Per page:
//   - <title>: posts lead with their headline instead of just the date
//   - canonical URL (latest.html points at its dated post, so Google doesn't
//     see the two as duplicates)
//   - Open Graph / Twitter tags for link previews
//   - NewsArticle structured data on dated posts
//
// Uses only Node's built-in fs/path (no npm install step needed in CI).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://kamaljac3-ui.github.io/d3vil-sports";
const SITE_NAME = "48th State Sports";
const IMAGE = `${SITE}/assets/stateforty8-mark-dark.png`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const write = (rel, s) => fs.writeFileSync(path.join(ROOT, rel), s);
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const decode = (s) => s.replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&rsquo;|&#8217;/g, "’")
  .replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// "October 24, 2026" -> "2026-10-24"
function isoFromLong(s) {
  const m = /([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(s || "");
  if (!m || !MONTHS.includes(m[1])) return null;
  return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function tagPage(rel, { url, title, description, article }) {
  let html = read(rel);
  if (html.includes('rel="canonical"')) return false; // already done
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(title)}</title>`);
  const desc = description ||
    decode((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || "");
  const pageTitle = title || decode(text((/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || SITE_NAME));
  const tags = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="${article ? "article" : "website"}">`,
    `<meta property="og:title" content="${attr(pageTitle)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    `<meta name="twitter:card" content="summary">`,
  ];
  if (article) {
    tags.push(`<meta property="article:published_time" content="${article.date}">`);
    const ld = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      // Google ignores headlines past 110 characters; cut at a word boundary.
      headline: article.headline.length > 110 ? article.headline.slice(0, 107).replace(/\s+\S*$/, "") + "…" : article.headline,
      description: desc,
      datePublished: article.date,
      dateModified: article.date,
      url,
      mainEntityOfPage: url,
      image: [IMAGE],
      author: { "@type": "Organization", name: SITE_NAME, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: IMAGE } },
    };
    tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  html = html.replace("</head>", tags.join("\n") + "\n</head>");
  write(rel, html);
  return true;
}

const sitemap = []; // [url, lastmod]
const today = new Date().toISOString().slice(0, 10);

// Daily posts (and latest.html, a copy of the newest one).
const postFiles = fs.readdirSync(path.join(ROOT, "posts")).filter((f) => f.endsWith(".html")).sort();
for (const f of postFiles) {
  const rel = `posts/${f}`;
  const html = read(rel);
  const headline = decode(text((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [])[1] || ""));
  const longDate = text((/<div class="date">([\s\S]*?)<\/div>/.exec(html) || [])[1] || "");
  const date = /^\d{4}-\d{2}-\d{2}\.html$/.test(f) ? f.slice(0, 10) : isoFromLong(longDate);
  if (!date) { console.log("[seo] skipped (no date):", rel); continue; }
  const url = `${SITE}/posts/${date}.html`;
  const title = headline ? `${headline} | ${SITE_NAME}` : null;
  tagPage(rel, { url, title, article: headline ? { headline, date } : null });
  if (f !== "latest.html") sitemap.push([url, date]);
}

// Section pages.
tagPage("index.html", { url: `${SITE}/` });
sitemap.unshift([`${SITE}/`, today]);
if (fs.existsSync(path.join(ROOT, "archive.html"))) { // built by archive.js
  tagPage("archive.html", { url: `${SITE}/archive.html` });
  sitemap.splice(1, 0, [`${SITE}/archive.html`, today]);
}
for (const f of fs.readdirSync(path.join(ROOT, "commentary")).filter((x) => x.endsWith(".html"))) {
  const rel = `commentary/${f}`;
  const url = f === "index.html" ? `${SITE}/commentary/` : `${SITE}/commentary/${f}`;
  tagPage(rel, { url });
  sitemap.push([url, today]);
}

write("sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemap.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`);
console.log(`[seo] tagged pages, sitemap.xml has ${sitemap.length} URLs`);
