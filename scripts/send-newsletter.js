// Sends today's roundup as a Kit (ConvertKit) broadcast.
// Runs in CI only — see .github/workflows/deploy.yml. Needs KIT_API_KEY and
// POST_FILE (e.g. "posts/2026-08-18.html") set in the environment.
//
// Uses only Node's built-in fetch/fs (no npm install step needed in CI).

const fs = require("fs");

const SITE_URL = "https://kamaljac3-ui.github.io/d3vil-sports";

function extract(html, regex, label) {
  const m = html.match(regex);
  if (!m) throw new Error(`Could not find ${label} in ${process.env.POST_FILE}`);
  return m[1].trim();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

async function main() {
  const postFile = process.env.POST_FILE;
  const apiKey = process.env.KIT_API_KEY;
  if (!postFile) throw new Error("POST_FILE not set");
  if (!apiKey) throw new Error("KIT_API_KEY not set");

  const html = fs.readFileSync(postFile, "utf8");

  const headline = stripTags(extract(html, /<h1>([\s\S]*?)<\/h1>/, "headline"));
  const dateLabel = stripTags(
    extract(html, /class="post-header">[\s\S]*?class="date">([\s\S]*?)<\/div>/, "date")
  );
  const description = extract(
    html,
    /<meta name="description" content="([\s\S]*?)">/,
    "meta description"
  );

  const postUrl = `${SITE_URL}/${postFile.replace(/\\/g, "/")}`;

  const emailHtml = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:28px 24px;background:#0c0605;color:#f5ede9;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#b09a92;margin-bottom:8px;">${dateLabel}</div>
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;color:#f5ede9;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#d8cec8;margin:0 0 24px;">${description}</p>
    <a href="${postUrl}" style="display:inline-block;padding:12px 22px;background:#ff5a3c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">Read today's full roundup &rarr;</a>
    <p style="font-size:12px;color:#7a655c;margin-top:32px;">D3vil Sports — NFL, CFB, NBA, NCAAM, WNBA, NCAAW, MLB, NHL, UFC, Boxing, Golf &amp; Horse Racing, every day.</p>
  </div>`.trim();

  const res = await fetch("https://api.kit.com/v4/broadcasts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      subject: `D3vil Sports — ${headline}`,
      preview_text: description.slice(0, 140),
      content: emailHtml,
      description: `Auto-sent for ${postFile}`,
      public: false,
      send_at: new Date().toISOString(),
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Kit API error ${res.status}: ${body}`);
  }
  console.log("Broadcast created:", body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
