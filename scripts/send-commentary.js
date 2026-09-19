// Sends a one-off Kit broadcast for a Commentary piece (see commentary/).
// Unlike scripts/send-newsletter.js, this is never triggered by a push --
// commentary pieces are manual, roughly every 1-2 weeks, and each send is
// a deliberate action (workflow_dispatch only, see
// .github/workflows/send-commentary.yml). Reusable across every future
// installment: point COMMENTARY_FILE at the new piece's HTML file and
// everything else (title, subtitle, excerpt) is extracted automatically,
// the same way send-newsletter.js extracts from a dated post. Mirrors
// D3vil World News's script of the same name -- same template, same
// extraction logic, just re-branded for 48th State Sports.
//
// Deliberately avoids Google Fonts / flexbox / CSS variables / gradients
// in the email body itself -- email clients (Outlook especially) strip or
// mangle all of those, same reasoning as send-newsletter.js. The full
// "aged scroll" visual treatment only exists on the live site; the email
// is a plain, reliable teaser with a prominent link to read the full
// piece there.

const fs = require("fs");

const SITE_URL = "https://kamaljac3-ui.github.io/d3vil-sports";

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&rarr;/g, "→").replace(/\s+/g, " ").trim();
}

function extract(html, regex, label) {
  const m = html.match(regex);
  if (!m) throw new Error(`Could not find ${label} in commentary file`);
  return m[1].trim();
}

function buildEmailHtml(commentaryFile) {
  const html = fs.readFileSync(commentaryFile, "utf8");

  const title = stripTags(extract(html, /<h1>([\s\S]*?)<\/h1>/, "title"));
  const subtitle = stripTags(
    extract(html, /class="subtitle">([\s\S]*?)<\/p>/, "subtitle")
  );
  // First paragraph of Part I as the excerpt hook.
  const excerpt = stripTags(
    extract(html, /<span class="part-num">I<\/span>[\s\S]*?<p>([\s\S]*?)<\/p>/, "excerpt")
  );

  const slug = commentaryFile.replace(/^commentary\//, "").replace(/\.html$/, "");
  const pieceUrl = `${SITE_URL}/commentary/${slug}.html`;

  const html_out = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151009;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; background:#e9ddc3;">

        <tr>
          <td style="background:#3a2718; height:14px; line-height:14px; font-size:0;">&nbsp;</td>
        </tr>

        <tr>
          <td style="padding:36px 36px 8px;">
            <div style="text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#7c2c26; font-weight:bold; margin-bottom:14px;">
              A Commentary &middot; 48th State Sports
            </div>
            <div style="text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:1.25; font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:#3c2d1c; margin-bottom:16px;">
              ${title}
            </div>
            <div style="text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:15px; font-style:italic; color:#6d5a41; line-height:1.5; margin-bottom:22px;">
              ${subtitle}
            </div>
            <div style="border-top:2px solid #916a2f; width:120px; margin:0 auto 26px;"></div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px;">
            <div style="font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.7; color:#3c2d1c;">
              ${excerpt}
            </div>
          </td>
        </tr>

        <tr><td style="height:30px; line-height:30px; font-size:0;">&nbsp;</td></tr>

        <tr>
          <td align="center" style="padding:0 36px 8px;">
            <a href="${pieceUrl}" style="display:inline-block; padding:14px 30px; background:#7c2c26; color:#f1dcb8; text-decoration:none; font-family:Georgia,'Times New Roman',serif; font-weight:bold; font-size:15px; letter-spacing:0.5px;">Read the Full Piece &rarr;</a>
          </td>
        </tr>

        <tr><td style="height:34px; line-height:34px; font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="border-top:1px solid #c9b489; padding:22px 36px 30px;">
            <div style="text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:13px; font-style:italic; color:#6d5a41; line-height:1.6;">
              This is the first in an ongoing commentary series from 48th State &mdash; new installments roughly every one to two weeks.
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#3a2718; height:14px; line-height:14px; font-size:0;">&nbsp;</td>
        </tr>

      </table>
    </td>
  </tr>
</table>`.trim();

  return { emailHtml: html_out, title, subtitle, pieceUrl };
}

async function main() {
  const commentaryFile = process.env.COMMENTARY_FILE;
  const subject = process.env.SUBJECT;
  const apiKey = process.env.KIT_API_KEY;
  // Optional one-off override for test sends -- scopes the broadcast to a
  // single Kit tag instead of the whole account, same convention as
  // send-newsletter.js / test-send.yml. For 48th State Sports commentary
  // pieces, kamal's standing choice (2026-09-19, "The Clipper Curse") is
  // to scope to the "sports-subscriber" tag (id 23371585) rather than
  // send unscoped to the whole shared account -- unlike the daily digest,
  // which does go to everyone. Always pass TARGET_TAG_ID for a Sports
  // commentary send unless explicitly told otherwise.
  const targetTagId = process.env.TARGET_TAG_ID;
  if (!commentaryFile) throw new Error("COMMENTARY_FILE not set");
  if (!subject) throw new Error("SUBJECT not set");
  if (!apiKey) throw new Error("KIT_API_KEY not set");

  const { emailHtml, title, pieceUrl } = buildEmailHtml(commentaryFile);

  const res = await fetch("https://api.kit.com/v4/broadcasts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify({
      subject,
      preview_text: `A new commentary from 48th State: ${title}`.slice(0, 140),
      content: emailHtml,
      description: `Commentary send: ${commentaryFile}`,
      public: false,
      send_at: new Date().toISOString(),
      ...(targetTagId
        ? { subscriber_filter: [{ all: [{ type: "tag", ids: [Number(targetTagId)] }] }] }
        : {}),
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Kit API error ${res.status}: ${body}`);
  }
  console.log("Broadcast created:", body);
  console.log("Piece URL:", pieceUrl);
}

module.exports = { buildEmailHtml };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
