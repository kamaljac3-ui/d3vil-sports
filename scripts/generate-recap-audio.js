// Generates the 7-day audio recap and updates the site's audio player.
// Runs in CI only — see .github/workflows/deploy.yml. Needs
// ELEVENLABS_API_KEY set in the environment. Only actually called on the
// day of the week the workflow gates it to (see the "recap" job's
// "Detect recap day" step) — this script itself always builds and
// generates when invoked, it doesn't do its own day-of-week check.

const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "..", "posts");
const AUDIO_DIR = path.join(__dirname, "..", "audio");
const INDEX_FILE = path.join(__dirname, "..", "index.html");
const VOICE_ID = "nUEpF21E0nXsKMw4L4CS"; // Shaun - Boston
const RECAP_DAYS = 7;
const KEEP_RECAPS = 4; // ~1 month of weekly recaps

function stripTags(s) {
  return s
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "of", "for",
  "with", "is", "are", "was", "were", "after", "over", "into", "its", "his",
  "her", "their",
]);

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildRecapScript() {
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .sort();
  const lastN = files.slice(-RECAP_DAYS);

  if (lastN.length === 0) {
    throw new Error("No dated posts found to build a recap from");
  }

  let script = [];
  script.push(`D3vil Sports, seven day recap.`);
  script.push(`Here's what happened across every league over the last seven days.`);

  for (const file of lastN) {
    const html = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const dateLabel = stripTags(html.match(/class="date">([\s\S]*?)<\/div>/)[1]);
    const headline = stripTags(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
    const headlineTokens = new Set(tokenize(headline));

    const storyRe = /<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
    const scored = [];
    let sm;
    while ((sm = storyRe.exec(html))) {
      const h3 = stripTags(sm[1]);
      const tokens = tokenize(h3);
      const score = tokens.filter((t) => headlineTokens.has(t)).length;
      scored.push({ headline: h3, summary: stripTags(sm[2]), score });
    }
    scored.sort((a, b) => b.score - a.score);
    const topTwo = scored.slice(0, 2);
    const storyLines = topTwo.map((s) => `${s.headline}. ${s.summary}`).join("\n\n");

    script.push(`\n${dateLabel}. ${headline}\n\n${storyLines}`);
  }

  script.push(`\nThat's your seven day catch-up. Full daily roundups and sources at D three vil sports dot com.`);

  return { text: script.join("\n\n"), coveredDates: lastN };
}

async function generateAudio(text, apiKey) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${body}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function enforceRetention() {
  if (!fs.existsSync(AUDIO_DIR)) return;
  const files = fs
    .readdirSync(AUDIO_DIR)
    .filter((f) => /^recap-\d{4}-\d{2}-\d{2}\.mp3$/.test(f))
    .sort();
  const toRemove = files.slice(0, Math.max(0, files.length - KEEP_RECAPS));
  for (const f of toRemove) {
    fs.unlinkSync(path.join(AUDIO_DIR, f));
    console.log(`Removed old recap: ${f}`);
  }
}

function updateHomepage(dateLabel, mp3Path) {
  let html = fs.readFileSync(INDEX_FILE, "utf8");

  const playerBlock = `
    <div class="recap-box" id="recap-box">
      <div class="recap-label">Weekly audio recap</div>
      <div class="recap-sub">Seven days of headlines, updated ${dateLabel}</div>
      <audio id="recapPlayer" controls src="${mp3Path}"></audio>
      <div class="recap-speed-row">
        <span class="recap-speed-label">Speed</span>
        <div class="recap-speed-options">
          <button class="recap-speed-btn" data-speed="0.75">0.75x</button>
          <button class="recap-speed-btn active" data-speed="1">1x</button>
          <button class="recap-speed-btn" data-speed="1.25">1.25x</button>
          <button class="recap-speed-btn" data-speed="1.5">1.5x</button>
          <button class="recap-speed-btn" data-speed="2">2x</button>
        </div>
      </div>
    </div>
    <script>
      (function(){
        var player = document.getElementById('recapPlayer');
        var buttons = document.querySelectorAll('.recap-speed-btn');
        buttons.forEach(function(btn){
          btn.addEventListener('click', function(){
            player.playbackRate = parseFloat(btn.dataset.speed);
            buttons.forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
          });
        });
      })();
    </script>`;

  if (html.includes('id="recap-box"')) {
    html = html.replace(
      /<div class="recap-box" id="recap-box">[\s\S]*?<\/script>/,
      playerBlock.trim()
    );
  } else {
    // Insert right before the posts list, still inside .wrap — anchoring on
    // a single unambiguous opening tag instead of counting closing </div>s,
    // which previously matched past .wrap's own closing tag and landed the
    // player outside the container entirely.
    html = html.replace(
      /(\s*)(<div id="posts">)/,
      `$1${playerBlock}\n$1$2`
    );
  }

  fs.writeFileSync(INDEX_FILE, html, "utf8");
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const { text, coveredDates } = buildRecapScript();
  console.log(`Recap script: ${text.length} chars, covering ${coveredDates.join(", ")}`);

  const audioBuffer = await generateAudio(text, apiKey);
  console.log(`Generated audio: ${audioBuffer.length} bytes`);

  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const datedFile = path.join(AUDIO_DIR, `recap-${today}.mp3`);
  const latestFile = path.join(AUDIO_DIR, "latest-recap.mp3");

  fs.writeFileSync(datedFile, audioBuffer);
  fs.writeFileSync(latestFile, audioBuffer);
  console.log(`Saved: ${datedFile} and ${latestFile}`);

  enforceRetention();

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  updateHomepage(dateLabel, "audio/latest-recap.mp3");
  console.log("Updated homepage with new recap player");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildRecapScript };
