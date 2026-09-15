# Audio backend: current blockers and next steps

Written 2026-09-15 after a debugging session. Read this before touching the audio
resolver again — it explains what's already fixed, what's still broken, why, and
what's worth trying next, so a fresh session doesn't have to re-derive it.

## The problem, in one paragraph

The app streams YouTube audio through `pages/api/soundplayer/[...termplayer].js`,
which uses `youtubei.js` (InnerTube) to resolve a playable stream and pipes bytes to
the client. Deployed on Vercel, every request to this route returned a 500. Two
separate bugs were stacked on top of each other: a Next.js/Vercel bundling bug (now
fixed) was hiding the real, harder problem underneath — YouTube's bot detection
outright blocks the request before we even get a stream to pipe. **The bundling bug
is fixed. The bot-detection wall is not, and is the actual reason audio doesn't play
in production today.**

## Architecture today

- `pages/api/soundplayer/[...termplayer].js` — the audio resolver. Tries a fixed
  client fallback chain (`CLIENT_FALLBACK_CHAIN = ['VISIONOS', 'IOS', 'ANDROID_VR']`,
  see the comment above it) via `youtubei.js`, remembers whichever client worked per
  video id (`lastWorkingClient`), streams bytes with Range/206 support.
- `.env.local.example` documents `NEXT_PUBLIC_AUDIO_API_BASE`, an escape hatch to
  point the frontend at an **external** audio service instead of this local route —
  the comment there references `https://yt-audio-l01p.onrender.com`, "once it's back
  up," implying a separate Render-hosted service existed for this and is currently
  down. That service's code isn't in this repo.
- `backup-2026-07-14` branch (local only, not on origin) holds an older, abandoned
  implementation that fought the exact same YouTube bot-detection problem with fake
  User-Agents, pre-fetched session cookies, and client-switching — none of it stuck,
  which is why the app was rewritten around `youtubei.js` instead. Worth reading its
  commit messages (`fix: use real browser User-Agent + Google referer for yt-dlp`,
  `fix: pre-fetch anonymous YouTube session cookies before yt-dlp call`, `fix: try
  Android/Music/iOS clients to bypass YouTube bot detection`) as evidence this is a
  long-running fight, not a one-off bug.

## What's already fixed (confirmed via real Vercel logs, not guessing)

1. **`getInnertube()` cached a rejected promise** — one transient init failure broke
   the endpoint for the process's whole lifetime. Fixed: resets `innertubePromise` to
   `null` on rejection so it retries.
2. **InnerTube's cache wrote to `process.cwd()/.cache`** — throws on Vercel, whose
   deployed function filesystem is read-only outside `/tmp`. Fixed: cache dir moved
   to `os.tmpdir()`.
3. **The actual cause of the 500**: `youtubei.js`'s compiled `Utils.js`,
   `StreamingInfo.js`, `Player.js`, `Session.js`, and `parser.js` all import their own
   `package.json` via `import ... with { type: 'json' }` (import attributes). Next.js
   12's bundled file tracer can't parse that syntax, silently drops the *entire*
   dependency list of whichever file it fails on, and a file only reachable through
   `Utils.js`'s own import (`utils/user-agents.js`) never made it into the deployed
   function → `ERR_MODULE_NOT_FOUND` crash on every cold start, before our own
   try/catch ever ran (that's why it showed Next's generic `/500` page, not our
   custom error text). Fixed via `patch-package` (`patches/youtubei.js+18.0.0.patch`,
   reapplied automatically by the `postinstall` script on every `npm install`):
   rewrote the five `with { type: 'json' }` imports to use `createRequire` instead,
   which every tool can parse and returns the identical parsed object.
   - Confirmed with real `vercel logs` output before and after: the exact
     `ERR_MODULE_NOT_FOUND` for `user-agents.js` reproduced on a fully clean,
     cache-free forced redeploy (ruling out stale build cache), then disappeared
     after the patch — the deployed function now reaches our own route code instead
     of crashing at import time (`X-Matched-Path` changed from `/500` to
     `/api/soundplayer/[...termplayer]`).

If a future session sees `ERR_MODULE_NOT_FOUND` from inside `node_modules/youtubei.js`
again after a dependency upgrade, re-check whether the patch still applies cleanly
(`npx patch-package youtubei.js` regenerates it) — a `youtubei.js` version bump could
shift line numbers or fix this upstream and make the patch redundant/conflicting.

## What's still broken: YouTube's bot detection

After the fix above, `/api/soundplayer/<id>` reaches our code and gets a real
response from YouTube — which is itself a block:

```
could not resolve audio for this video: video unavailable: Sign in to confirm you're not a bot
```

This was tested exhaustively, not assumed:

- Deployed a temporary diagnostic route that tried **every** InnerTube client
  `youtubei.js` supports (`IOS, ANDROID, ANDROID_VR, VISIONOS, WEB, MWEB,
  WEB_EMBEDDED, WEB_CREATOR, TV, TV_SIMPLY, TV_EMBEDDED, YTMUSIC, YTMUSIC_ANDROID,
  YTKIDS, YTSTUDIO_ANDROID` — 15 total, including the obscure ones not in the
  existing `CLIENT_FALLBACK_CHAIN`/`scripts/test-clients.mjs` list) against a real
  video, run from the actual live Vercel production deployment (not locally — local
  requests come from a residential IP and never hit this wall).
- **All 15 failed**, each with a bot-detection or sign-in-wall variant
  (`Sign in to confirm you're not a bot`, `Please sign in`, or an outright 400/video
  unavailable). No client swap fixes this.
- The diagnostic route was deleted immediately after (never committed to git) — if
  you need to re-run this test, recreate it from this doc's description rather than
  looking for it in the repo.

Confirmed via web search (August 2026 data) that this is expected, not
misconfiguration: YouTube scores requests on IP reputation plus a **Proof-of-Origin
(PO) token** minted by its BotGuard JavaScript challenge (required since 2024).
Datacenter/cloud IP ranges (Vercel, Render, any VPS) get flagged at a roughly 1-in-4
rate on first contact regardless of which client pretends to be making the request.
Client spoofing alone (what the current `CLIENT_FALLBACK_CHAIN` approach relies on)
stopped being sufficient once PO token enforcement rolled out broadly — this is
almost certainly also why the abandoned `backup-2026-07-14` branch's user-agent/client
tricks never fully worked either.

**Open question, not yet tested**: whether Render's specific IP ranges happen to
fare better than Vercel's. Untested — worth 10 minutes to check before assuming a
full Docker rebuild is required (see checklist below).

## Options discussed for fixing the bot wall (none built yet)

The user chose to explore Docker + `yt-dlp` instead of continuing with
`youtubei.js`+Vercel, on the reasoning that `yt-dlp` is far more actively maintained
against YouTube's countermeasures. That's a reasonable direction, but **`yt-dlp`
alone does not sidestep the PO token requirement** — it hits the same wall unless
paired with one of these:

1. **PO token provider sidecar** (`bgutil-ytdlp-pot-provider`,
   https://github.com/Brainicism/bgutil-ytdlp-pot-provider) — a second Docker
   container (prebuilt image, `docker run ... brainicism/bgutil-ytdlp-pot-provider`)
   that runs an HTTP server simulating YouTube's BotGuard challenge to mint valid PO
   tokens on demand, which `yt-dlp`'s POT plugin framework then attaches to requests.
   No account risk, no recurring cost, but it's another moving part to keep running
   and updated, and it can break if YouTube changes the BotGuard challenge (the
   project tends to patch quickly, per its history).
   - **This was the option the user was leaning toward** when this doc was written.
2. **Cookies from a real, logged-in Google account** (`--cookies-from-browser` /
   cookies.txt) — simplest to wire up, but risks that account being flagged/banned,
   and cookies need periodic refreshing.
3. **Residential/rotating proxy** in front of outbound requests — most likely to work
   reliably, but has a real recurring dollar cost and adds latency.
4. **Do nothing extra yet, test plain `yt-dlp` on Render first** — cheapest to try,
   but per the research above, likely to hit the same wall; treat this as a quick
   sanity check, not a real plan.

No decision was finalized — the conversation was paused here specifically so it
could be picked up fresh, possibly by a different session testing options in
parallel.

## Concrete things to try in a new session

In rough order of cheapest/fastest first:

- [ ] **Test whether Render's IP happens to not be blocked.** Spin up the simplest
      possible `yt-dlp` (or even current `youtubei.js`) call on a free/cheap Render
      web service and hit it the same way the Vercel diagnostic was tested (see
      "What's still broken" above for the client list and video ids used). If Render
      somehow isn't flagged, that alone might unblock things without any Docker/PO
      token work at all. Cheap, worth ruling out first.
- [ ] **Prototype the PO token provider approach.** `docker-compose` with two
      services: `brainicism/bgutil-ytdlp-pot-provider` (unmodified, don't expose its
      port beyond `127.0.0.1`/the internal network — see its README's security note)
      and a new small Node service wrapping the `yt-dlp` CLI (via `child_process`,
      consistent with this repo being all-JS) that queries the provider for a token
      before each YouTube request. Test resolving + streaming a real video end to
      end from wherever this gets deployed (Render supports Docker natively) before
      wiring it into the main app.
  - Once it works, point `NEXT_PUBLIC_AUDIO_API_BASE` (already wired in
    `pages/search/[search].jsx`'s `getServerSideProps`, per `CLAUDE.md`) at it instead
    of rebuilding `/api/soundplayer` itself — that env var exists exactly for this.
- [ ] **If PO token route stalls, try cookies as a fast unblock** while the more
      durable solution is built, understanding the account-risk tradeoff explained
      above.
- [ ] **Re-run the full 15-client diagnostic** against whatever new backend gets
      built, the same way it was done here, before declaring victory — don't assume
      one working request means the bot wall is gone; retest across multiple videos
      and repeat requests (the current in-repo `scripts/test-clients.mjs` is close
      but is missing `YTKIDS`/`YTSTUDIO_ANDROID`; extend it, or recreate the
      deleted diagnostic route, to include those too).
- [ ] Once a backend actually works reliably, run `npm run test:audio` (the existing
      smoke test at `scripts/test-audio-endpoint.mjs`) against it to confirm
      Range/206 seeking still works end to end, not just single-shot playback.

## Useful facts for quick reproduction

- Production URL: `https://playersound.vercel.app` (aliased; the project is
  `levmetals-projects/playersound` — `npx vercel link` then `npx vercel logs <url>` to
  get real runtime logs, not just build status).
- `gh api repos/levmetal/PLAYERSOUND/commits/main/status` / `.../deployments` only
  show Vercel's *build* status (always green so far) — they say nothing about
  runtime errors. Use `vercel logs`/`vercel inspect --logs` for that.
- Known-good test video ids used throughout this investigation: `fJ9rUzIMcZQ`
  (Bohemian Rhapsody), `xFYQQPAOz7Y`, `kJQP7kiw5Fk`, `DfG6VKnjrVw` — all real,
  popular, non-region-locked videos, so a failure on these is the bot wall, not a
  video-specific issue.
