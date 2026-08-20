// Sends today's roundup as a Kit (ConvertKit) broadcast, styled as a
// newspaper-style "front page" digest.
// Runs in CI only — see .github/workflows/deploy.yml. Needs KIT_API_KEY and
// POST_FILE (e.g. "posts/2026-08-19.html") set in the environment.
//
// Uses only Node's built-in fetch/fs (no npm install step needed in CI).
// Deliberately avoids Google Fonts / flexbox / CSS variables / gradients —
// email clients (Outlook especially) strip or mangle all of those. Georgia
// is a web-safe serif that renders consistently everywhere and gives the
// newspaper feel without relying on a web font load.

const fs = require("fs");

const SITE_URL = "https://kamaljac3-ui.github.io/d3vil-sports";

const LEAGUE_META = {
  NFL: { label: "NFL", color: "#6f9de3" },
  CFB: { label: "CFB", color: "#9b8cff" },
  NBA: { label: "NBA", color: "#e8a33d" },
  NCAAM: { label: "NCAAM", color: "#5fd88f" },
  WNBA: { label: "WNBA", color: "#d4649a" },
  NCAAW: { label: "NCAAW", color: "#ff9ecb" },
  MLB: { label: "MLB", color: "#d94f4f" },
  NHL: { label: "NHL", color: "#7fd0c9" },
  UFC: { label: "UFC", color: "#ff3b3b" },
  Boxing: { label: "BOXING", color: "#c9a15a" },
  Golf: { label: "GOLF", color: "#a8c15a" },
  HorseRacing: { label: "HORSE RACING", color: "#a0673f" },
};

// Fixed, year-round marquee leagues so the email always has something --
// avoids depending on seasonal categories (CFB/NCAAM/etc.) being active.
const FEATURED_LEAGUES = ["NFL", "NBA", "MLB", "UFC"];

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extract(html, regex, label, postFile) {
  const m = html.match(regex);
  if (!m) throw new Error(`Could not find ${label} in ${postFile}`);
  return m[1].trim();
}

function extractSection(html, leagueClass) {
  const sectionRe = new RegExp(
    `<section class="league-section ${leagueClass}" id="[\\w-]+">([\\s\\S]*?)<\\/section>`
  );
  const sectionMatch = html.match(sectionRe);
  if (!sectionMatch) return null;
  const storyMatch = sectionMatch[1].match(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/);
  if (!storyMatch) return null;
  return {
    headline: stripTags(storyMatch[1]),
    summary: stripTags(storyMatch[2]),
  };
}

function buildEmailHtml(postFile) {
  const html = fs.readFileSync(postFile, "utf8");

  const headline = stripTags(extract(html, /<h1>([\s\S]*?)<\/h1>/, "headline", postFile));
  const dateLabel = stripTags(
    extract(html, /class="post-header">[\s\S]*?class="date">([\s\S]*?)<\/div>/, "date", postFile)
  );
  const description = extract(
    html,
    /<meta name="description" content="([\s\S]*?)">/,
    "meta description",
    postFile
  );

  const postUrl = `${SITE_URL}/${postFile.replace(/\\/g, "/")}`;

  const featured = FEATURED_LEAGUES.map((key) => {
    const story = extractSection(html, key);
    if (!story) return null;
    return Object.assign({}, story, LEAGUE_META[key]);
  }).filter(Boolean);

  const storyRows = featured
    .map(
      (s) => `
      <tr>
        <td width="6" style="width:6px; background:${s.color}; font-size:0; line-height:0;">&nbsp;</td>
        <td style="padding:0 0 0 14px;">
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:11px; font-weight:bold; letter-spacing:1.5px; color:${s.color}; text-transform:uppercase; margin:0 0 4px;">${s.label}</div>
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:17px; font-weight:bold; color:#f5ede9; margin:0 0 6px; line-height:1.3;">${s.headline}</div>
          <div style="font-family:Georgia,'Times New Roman',serif; font-size:14px; line-height:1.55; color:#b09a92; margin:0;">${s.summary}</div>
        </td>
      </tr>
      <tr><td colspan="2" style="height:20px; line-height:20px; font-size:0;">&nbsp;</td></tr>`
    )
    .join("");

  const html_out = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0605;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Masthead -->
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="52" style="vertical-align:middle;">
                  <img src="${SITE_URL}/assets/devil-mascot.png" width="44" alt="" style="display:block; border:0;">
                </td>
                <td style="vertical-align:middle; padding-left:10px;">
                  <span style="font-family:Georgia,'Times New Roman',serif; font-size:30px; font-weight:bold; color:#f5ede9; letter-spacing:-0.5px;">D<span style="color:#ff5a3c;">3</span>vil Sports</span>
                </td>
              </tr>
            </table>
            <div style="border-top:3px solid #f5ede9; margin-top:12px;"></div>
            <div style="border-top:1px solid #3a221c; margin-top:3px; padding-top:8px; font-family:Georgia,'Times New Roman',serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#b09a92;">
              Daily Edition &nbsp;&bull;&nbsp; ${dateLabel} &nbsp;&bull;&nbsp; All Leagues
            </div>
          </td>
        </tr>

        <tr><td style="height:24px; line-height:24px; font-size:0;">&nbsp;</td></tr>

        <!-- Lead story -->
        <tr>
          <td>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:1.25; font-weight:bold; color:#f5ede9; margin:0 0 12px;">${headline}</div>
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.6; color:#d8cec8; margin:0 0 18px;">${description}</div>
            <a href="${postUrl}" style="display:inline-block; padding:11px 22px; background:#ff5a3c; color:#ffffff; text-decoration:none; font-family:Georgia,'Times New Roman',serif; font-weight:bold; font-size:14px; border-radius:4px;">Read the Full Edition &rarr;</a>
          </td>
        </tr>

        <tr><td style="height:26px; line-height:26px; font-size:0;">&nbsp;</td></tr>
        <tr><td style="border-top:1px solid #3a221c;">&nbsp;</td></tr>
        <tr><td style="height:22px; line-height:22px; font-size:0;">&nbsp;</td></tr>

        <!-- Also in today's edition -->
        <tr>
          <td style="font-family:Georgia,'Times New Roman',serif; font-size:12px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:#7a655c; padding-bottom:16px;">
            Also In Today's Edition
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${storyRows}
            </table>
          </td>
        </tr>

        <tr><td style="border-top:1px solid #3a221c;">&nbsp;</td></tr>
        <tr><td style="height:18px; line-height:18px; font-size:0;">&nbsp;</td></tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="font-family:Georgia,'Times New Roman',serif; font-size:11px; letter-spacing:0.5px; color:#7a655c; line-height:1.7;">
            D3VIL SPORTS &mdash; NFL &middot; CFB &middot; NBA &middot; NCAAM &middot; WNBA &middot; NCAAW &middot; MLB &middot; NHL &middot; UFC &middot; BOXING &middot; GOLF &middot; HORSE RACING
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`.trim();

  return { emailHtml: html_out, headline, description, postUrl };
}

async function main() {
  const postFile = process.env.POST_FILE;
  const apiKey = process.env.KIT_API_KEY;
  if (!postFile) throw new Error("POST_FILE not set");
  if (!apiKey) throw new Error("KIT_API_KEY not set");

  const { emailHtml, headline, description } = buildEmailHtml(postFile);

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

module.exports = { buildEmailHtml };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
