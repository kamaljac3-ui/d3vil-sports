// Pulls newsletter numbers from Kit (ConvertKit) and writes them as CSVs a
// Google Sheet can read live with =IMPORTDATA(...). Totals and rates only —
// never subscriber emails or names (the output is published in a public repo).
// Runs in CI only — see .github/workflows/kit-stats.yml. Needs KIT_API_KEY.
// OUT_DIR (default "kit-stats-out") is the kit-stats branch worktree.
//
// Writes:
//   summary.csv    — one row appended per run (running history for charts)
//   broadcasts.csv — every sent broadcast with its latest stats (rewritten each run)
//
// Uses only Node's built-in fetch/fs (no npm install step needed in CI).

const fs = require("fs");
const path = require("path");

const API = "https://api.kit.com/v4";
const KEY = process.env.KIT_API_KEY;
const OUT = path.resolve(process.env.OUT_DIR || "kit-stats-out");
const DRY = process.env.DRY_RUN === "1";
// Sends to this few people or fewer are test sends (test-send.yml targets one tag).
const TEST_MAX_RECIPIENTS = +(process.env.TEST_MAX_RECIPIENTS || 1);

const etDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
const TODAY = etDate();
const log = (...a) => console.log("[kit-stats]", ...a);

async function kit(pathAndQuery) {
  const res = await fetch(API + pathAndQuery, { headers: { "X-Kit-Api-Key": KEY } });
  const body = await res.text();
  if (!res.ok) throw new Error(`Kit ${pathAndQuery} -> ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

// Follows Kit v4 cursor pagination and returns every item under `key`.
async function kitAll(endpoint, key) {
  const out = [];
  let after = "";
  for (let page = 0; page < 50; page++) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const data = await kit(`${endpoint}${sep}per_page=500${after ? `&after=${encodeURIComponent(after)}` : ""}`);
    out.push(...(data[key] || []));
    if (!data.pagination?.has_next_page) break;
    after = data.pagination.end_cursor;
  }
  return out;
}

// Kit reports rates as percentages (e.g. 52.4); normalise anything that looks
// like a 0–1 fraction so the sheet always shows percent.
const pct = (rate, num, den) => {
  if (den > 0 && num != null) return +((100 * num) / den).toFixed(1);
  if (rate == null) return "";
  return +(rate <= 1 ? rate * 100 : rate).toFixed(1);
};

const brandOf = (subject = "") =>
  /world news/i.test(subject) ? "World News" : /sports|d3vil/i.test(subject) ? "Sports" : "Other";

// Subjects come back with HTML entities (&rsquo;, &amp;) — make them readable.
const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s = "") =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))
      : ENTITIES[e.toLowerCase()] ?? m);

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(",");

// Recipient-weighted averages (total opens / total recipients), so a big
// send counts more than a tiny one — same way Kit's own dashboard reads.
function averages(rows) {
  const r = rows.reduce((s, x) => s + x.recipients, 0);
  const o = rows.reduce((s, x) => s + (x.opens || 0), 0);
  const c = rows.reduce((s, x) => s + (x.clickers || 0), 0);
  return {
    sends: rows.length,
    open: r ? +((100 * o) / r).toFixed(1) : "",
    click: r ? +((100 * c) / r).toFixed(1) : "",
  };
}

async function main() {
  if (!KEY) throw new Error("KIT_API_KEY not set");

  // Active subscribers (Kit's default status filter).
  const subs = await kit("/subscribers?include_total_count=true&per_page=1");
  const totalSubscribers = subs.pagination?.total_count ?? "";
  log("active subscribers:", totalSubscribers);

  // Growth over the last 30 days. Optional — don't fail the run if the
  // endpoint shape changes or the plan doesn't include it.
  let growth = {};
  try {
    const start = etDate(new Date(Date.now() - 30 * 864e5));
    const g = await kit(`/account/growth_stats?starting=${start}&ending=${TODAY}`);
    growth = g.stats || {};
    log("30-day growth:", JSON.stringify(growth));
  } catch (e) {
    log("growth stats unavailable:", e.message);
  }

  const broadcasts = await kitAll("/broadcasts", "broadcasts");
  log("broadcasts found:", broadcasts.length);

  const rows = [];
  for (const b of broadcasts) {
    const { broadcast } = await kit(`/broadcasts/${b.id}/stats`);
    const st = broadcast?.stats || {};
    if (rows.length === 0) log("sample raw stats:", JSON.stringify(st));
    if (st.status && st.status !== "completed") continue; // drafts / scheduled / sending
    const recipients = st.recipients || 0;
    if (!recipients) continue;
    // Kit gives emails_opened as a count but clicks only as a rate (unique
    // clickers / recipients); back the count out so averages can be weighted.
    const clickRate = pct(st.click_rate);
    rows.push({
      id: b.id,
      sent: (b.send_at || b.published_at || b.created_at || "").slice(0, 10),
      brand: brandOf(b.subject),
      subject: decode(b.subject),
      recipients,
      opens: st.emails_opened ?? null,
      open_rate: pct(st.open_rate, st.emails_opened, recipients),
      clickers: clickRate === "" ? null : Math.round((clickRate / 100) * recipients),
      click_rate: clickRate,
      total_clicks: st.total_clicks ?? "",
      unsubscribes: st.unsubscribes ?? "",
      test: recipients <= TEST_MAX_RECIPIENTS ? "yes" : "",
    });
  }
  rows.sort((a, b) => (a.sent < b.sent ? 1 : a.sent > b.sent ? -1 : 0));

  const real = rows.filter((r) => !r.test);
  const all = averages(real);
  const sports = averages(real.filter((r) => r.brand === "Sports"));
  const world = averages(real.filter((r) => r.brand === "World News"));

  const summaryHeader = [
    "date", "active_subscribers", "new_subscribers_30d", "unsubscribes_30d", "net_new_30d",
    "sends", "avg_open_rate", "avg_click_rate",
    "sports_sends", "sports_open_rate", "sports_click_rate",
    "world_news_sends", "world_news_open_rate", "world_news_click_rate",
  ];
  const summaryRow = [
    TODAY, totalSubscribers, growth.new_subscribers ?? "",
    growth.cancellations != null ? Math.abs(growth.cancellations) : "", // Kit reports these as negative
    growth.net_new_subscribers ?? "",
    all.sends, all.open, all.click,
    sports.sends, sports.open, sports.click,
    world.sends, world.open, world.click,
  ];

  const bcHeader = [
    "sent", "brand", "subject", "recipients", "opens", "open_rate", "click_rate",
    "total_clicks", "unsubscribes", "test_send", "broadcast_id",
  ];
  const bcLines = rows.map((r) => csvRow([
    r.sent, r.brand, r.subject, r.recipients, r.opens ?? "", r.open_rate, r.click_rate,
    r.total_clicks, r.unsubscribes, r.test, r.id,
  ]));

  const report = [
    `### Kit stats — ${TODAY}`,
    `- Active subscribers: **${totalSubscribers}**` +
      (growth.new_subscribers != null ? ` (+${growth.new_subscribers} new in the last 30 days)` : ""),
    `- All sends (${all.sends}): **${all.open}%** open · **${all.click}%** click`,
    `- Sports (${sports.sends}): ${sports.open}% open · ${sports.click}% click`,
    `- World News (${world.sends}): ${world.open}% open · ${world.click}% click`,
    `- Test sends excluded from averages: ${rows.length - real.length}`,
  ].join("\n");
  console.log("\n" + report + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");

  if (DRY) return log("dry run — nothing written");

  fs.mkdirSync(OUT, { recursive: true });
  const summaryFile = path.join(OUT, "summary.csv");
  const existing = fs.existsSync(summaryFile)
    ? fs.readFileSync(summaryFile, "utf8").trim().split("\n").slice(1)
    : [];
  // One row per day: a manual rerun replaces today's row instead of duplicating it.
  const history = existing.filter((l) => !l.startsWith(TODAY + ","));
  fs.writeFileSync(summaryFile, [csvRow(summaryHeader), ...history, csvRow(summaryRow)].join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "broadcasts.csv"), [csvRow(bcHeader), ...bcLines].join("\n") + "\n");
  log("wrote", summaryFile, "and broadcasts.csv");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
