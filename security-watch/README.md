# Security Watch

A defensive monitor for this repo, its GitHub Actions and the live site. It also sends a daily brief on attacks being
exploited around the world right now. Alerts go to the shared ntfy topic (`NTFY_TOPIC`), never to Kit.

**It only alerts.** It has read-only permissions and never changes the repo, the workflows or any settings.
See "Responding" below for why.

## What it checks (`run.js`)

| Check | What it looks for | Alert |
|---|---|---|
| `secrets` | Keys in the tracked files **and** in every line added to history since the last run, so a key committed and then deleted is still caught. Uses known key formats (GitHub, AWS, Google, Slack, Stripe, OpenAI/Anthropic-style, private keys), plus quoted `api_key = "..."` style values with high entropy. It also matches the **real values** of this repo's secrets exactly (passed in by the workflow). It never prints a value, only its first and last characters. | urgent, p5 |
| `workflows` | Any added, changed or deleted file under `.github/workflows/` or `scripts/`, with the commit and author that changed it. It also lints workflows for risky patterns: `pull_request_target`, untrusted event text inside `${{ }}` (script injection), `write-all`, `curl \| sh`, and third-party actions not pinned to a commit SHA. | workflow change: urgent, p4. Script change and lint: daily brief |
| `actions` | Actions runs from the last 36 h. It flags a run of a workflow that isn't in the repo, any `pull_request_target` run, and any **new (workflow, event, actor) combination** it hasn't seen before. That last one is a learned baseline: it learns silently for `ACTIONS_WARMUP_DAYS` (7) after a cold start, then alerts on anything new. | urgent, p4–5 |
| `site` | Fetches the live pages (`LIVE_PAGES`) and lists every host a `<script>`, `<iframe>`, `<form>`, `<embed>` or `<object>` loads from. Any host the repo's own HTML never uses means a possible injected skimmer or defacement. It also checks that no secret value appears on the live site. | urgent, p5 |
| `intel` | World threat intel, below. | |

### World threat intel

- **CISA Known Exploited Vulnerabilities (KEV).** This is the US government's list of vulnerabilities confirmed to be
  under active attack, updated as attacks are seen. New entries go into the daily brief, with ransomware use marked ☠️.
  If an entry matches something you use (`KEV_WATCH`: GitHub, Node.js, Chrome, Windows, Apple, Android and others),
  it's pushed right away with CISA's required fix.
- **GitHub Security Advisories for the Actions ecosystem.** This catches supply-chain attacks like the March 2025
  `tj-actions/changed-files` compromise. Each advisory is checked against the exact actions and versions in this repo's
  workflows. A floating tag like `@v4` counts as affected only if no patched v4 release exists.
- **abuse.ch URLhaus.** This is the list of hosts serving malware right now. It's checked against every external link
  in the repo's pages and on the live site, so a news site that gets hijacked after a roundup links to it is flagged.
  abuse.ch may require a free Auth-Key for downloads. If the feed fails, add one as the `ABUSECH_AUTH_KEY` secret.

## Schedule and state

- `.github/workflows/security-watch.yml` runs every 4 h (`23 1-23/4 * * *`). The first run after `DIGEST_HOUR`
  (8 AM ET) sends the daily brief at priority 2: new KEV entries, the URLhaus count, Actions advisory hits,
  lower-priority findings and the status of every check.
- State lives in `.cache/state.json` through `actions/cache` (prefix `security-watch-`). It holds alerted keys (each
  finding alerts once), file hashes, the last scanned commit, the learned Actions patterns and the KEV IDs seen.
- **Cold start.** The first run records baselines without alerting on them. It does scan the **whole history** for
  secrets and alerts on anything found, and it treats KEV entries from the last 3 days as new.
- Dry runs (`DRY_RUN=1`) and runs without `NTFY_TOPIC` print alerts and never save state.

## Responding (why it doesn't block anything on its own)

Automatic responses against your own repo can lock you out or break the site on a false alarm. Your own workflow
edits also trigger the "workflow changed" alert. So the bot tells you, and the alert says what to do:

- **Leaked key:** rotate it at the provider first, then remove it from the file. History is public, so deleting the
  file isn't enough.
- **Workflow you didn't change:** repo Settings → Actions → Disable actions, then rotate every secret.
- **Injected script on the site:** check the latest Pages deploy run and revert the commit.
- **Malicious link:** edit the post to remove the link.

## Settings (env)

`CHECKS` (`secrets,workflows,actions,site,intel`), `DIGEST` (1), `DIGEST_HOUR` (8), `KEV_WATCH`, `KEV_DIGEST_MAX` (12),
`ACTIONS_WARMUP_DAYS` (7), `ACTIONS_LOOKBACK_H` (36), `MIN_ENTROPY` (3.5), `WATCH_PATHS` (`.github/workflows,scripts`),
`WATCH_SECRET_NAMES`, `SAFE_HOSTS` (extra script hosts you approve), `LIVE_URL`, `LIVE_PAGES`
(`index.html,archive.html,posts/latest.html`), `DRY_RUN`.

**Testing offline:** `FIXTURE_DIR=<dir>` serves each URL from a file named `encodeURIComponent(url)`, and `REPO_ROOT`
and `SW_CACHE` point the bot at a scratch clone and cache.

## Limits

- It watches *your* attack surface: this repo, its Actions and the site. It can't stop attacks on other people's
  systems. The world intel is there to tell you when something you depend on is being attacked.
- The Actions baseline learns from 36 h of history at a time. A brand-new attacker pattern during the 7-day warmup
  goes unflagged unless it also trips the unknown-workflow or `pull_request_target` rules.
- Account takeover is the biggest real risk, and no bot replaces 2FA with a passkey or hardware key on your GitHub
  account.
