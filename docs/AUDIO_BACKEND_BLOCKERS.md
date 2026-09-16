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

### Where exactly the block happens (this rules out a lot of advice)

Every meaningful failure in the 15-client diagnostic came back as
**`stage: 'playability'`** — that stage is checked immediately after
`yt.getBasicInfo(videoId, { client })`, i.e. the InnerTube **`/player` API call**.
We never reach `chooseFormat()`, never reach `download()`, never issue a single
request to `googlevideo.com`.

This matters because most advice found online about "streaming YouTube audio without
getting blocked" describes things that happen *after* a successful `/player`
response. None of it can help here. Point by point, against what this repo already
does:

| Common advice | Verdict here |
|---|---|
| Spoof mobile client headers (Android/iOS user-agents) | Already done — that's exactly what `youtubei.js`'s client presets send. All 15 tested, all blocked. Not sufficient. |
| Parse the DASH manifest, isolate an audio-only itag (e.g. 140) | Already done via `chooseFormat({ type: 'audio' })`. A bandwidth optimization, not an evasion. |
| Decipher the `n` parameter locally | Already done by `youtubei.js` — that's what the cached `player.js` is for (see the `os.tmpdir()` fix above). It solves *throttling* (slow transfers), not the sign-in wall. |
| Request short byte-ranges instead of one continuous connection | Already done (Range/206 support). Also happens after `/player`, so it cannot affect this block. |
| **Route traffic through residential proxies** | **The only load-bearing item.** Everything else is downstream of a problem we never get to. |

### The controlled A/B we already have

Worth stating explicitly, because it was collected across two sessions and is easy to
miss: the **same code, same InnerTube clients, and no PO token in either case** was
run from two places:

- From the developer's home machine (**residential IP**): works. Repeatedly returned
  `206` with ~5.8 MB of real audio for `fJ9rUzIMcZQ`.
- From the live Vercel deployment (**datacenter IP**): all 15 clients blocked.

The only variable that changed is the originating IP. **IP reputation is the dominant
signal, not the absence of a PO token** — if the PO token were the gating factor,
local would fail too, and it doesn't.

Corollary worth weighing before building anything: a PO token sidecar exists to make
a *flagged datacenter IP* acceptable. Getting onto a non-flagged IP in the first place
sidesteps the need for one entirely — which is a simpler system, not a more complex
one. That reorders the options below.

### A fourth option the earlier list missed: self-host on a residential connection

Not previously considered, and given the A/B above it's arguably the cheapest path to
something that actually works: run the audio backend container **on a machine on the
developer's own home network** and expose it via Cloudflare Tunnel, Tailscale Funnel,
or similar, then point `NEXT_PUBLIC_AUDIO_API_BASE` at that hostname. The frontend
stays on Vercel; only the audio resolver moves.

- Upside: residential IP by construction (the exact condition already proven to
  work), no recurring proxy cost, no PO token infrastructure, no account/cookie risk.
- Downside: the machine has to stay on, home upstream bandwidth becomes the ceiling
  for concurrent listeners, and a dynamic residential IP means relying on the tunnel
  rather than a static address. Fine for personal/hobby scale; does not scale to real
  traffic.

**Open question, not tested and no longer planned**: whether Render's specific IP
ranges happen to fare better than Vercel's. Superseded by the decision below — the
bot wall stopped being something to work around at all.

## Final decision: two playback engines, not one fixed backend

Docker + `yt-dlp` + a PO token sidecar (`bgutil-ytdlp-pot-provider`) was explored as
the fix for the bot wall and explicitly **not chosen**. It would have worked, but it
trades one arms race (client spoofing) for another (BotGuard challenge solving) that
still needs babysitting forever. Cookies and residential proxies were also discussed
and rejected for the reasons above (account risk / recurring cost).

Instead: **stop trying to make the server-side resolver work in production at all.**
The app now ships two independent playback engines behind one interface:

- **Native engine** — the existing code, completely unchanged
  (`pages/api/soundplayer/`, `youtubei.js`, the `patch-package` patch, the
  `postinstall` script, `scripts/test-clients.mjs` / `test-audio-endpoint.mjs`).
  Real `<audio>` streaming, no ads, no YouTube player UI. Works perfectly from a
  residential IP (i.e. `npm run dev` on any contributor's machine) — this **is** the
  fix for the bot wall for that use case, because the audio never gets fetched from
  a datacenter IP in the first place.
- **IFrame engine** — new. The visitor's own browser talks to YouTube's official
  IFrame Player API directly (`youtube-nocookie.com/embed/...`). The bot wall
  structurally cannot apply: the request carries the visitor's own residential IP
  and cookies, not the server's. This is what the hosted Vercel demo uses.

Selected via `NEXT_PUBLIC_PLAYBACK_MODE` (`native` default, `iframe` set on Vercel),
with automatic fallback from native → iframe if the native engine fails at runtime.
Full implementation plan lives in the approved plan file used to build this (see git
history around the commit that introduces `hooks/usePlaybackEngine.js` for the
concrete file-by-file breakdown) — this doc only needs to record the *why* and the
one empirical result the plan depended on.

### IFrame ad test — decisive, ran by the user directly (not automation)

Browser automation (`claude-in-chrome`) could not complete this test itself: a
first pass was contaminated by an ad-blocking extension already active in that
Chrome profile (silently zero network requests to `youtube.com/embed`, while
`youtube-nocookie.com/embed` loaded — a dead giveaway), and a second pass got stuck
at `0:00` indefinitely because synthetic CDP clicks don't count as the kind of
"real user gesture" the browser's autoplay-with-sound policy requires inside a
cross-origin iframe. Both are recorded here so a future session doesn't waste time
re-attempting this via automation — it needs an actual human click.

The user then tested manually: multiple browsers, incognito, no extensions,
`kJQP7kiw5Fk` (Despacito — a monetized major-label video, chosen specifically
because it's likely to carry ads). **No ad played on either `youtube.com/embed` or
`youtube-nocookie.com/embed`.**

Caveat, stated plainly: this is one video, and YouTube's ad fill is probabilistic —
even direct youtube.com views don't get an ad on every play. "Didn't show this time"
is not "will never show." But it's consistent with known, general behavior: IFrame
embeds have substantially lower ad fill than watching directly on youtube.com,
regardless of which of the two embed domains is used. Since both domains behaved
identically here, the implementation uses `youtube-nocookie.com` anyway — it sends
no tracking cookie before playback starts, so it's never worse, only possibly
better.

**Practical takeaway for the IFrame engine's UI copy**: don't promise "no ads" —
say something honest like "reproducido vía YouTube" and let reality be a pleasant
surprise rather than a broken promise.

## Status

- [x] Root-caused and fixed the Vercel deploy crash (`patch-package` on
      `youtubei.js`).
- [x] Exhaustively confirmed the bot wall blocks all 15 InnerTube clients from
      Vercel's IP, and root-caused it to IP reputation via a controlled A/B
      (residential works, datacenter doesn't, same code, no PO token either way).
- [x] Decided against building PO-token/proxy/cookie infrastructure — chose the
      dual-engine architecture instead.
- [x] Validated (manually, by the user) that the IFrame engine doesn't reliably
      show ads for at least one monetized video, across multiple clean browser
      profiles.
- [ ] Ship the dual-engine implementation (`hooks/usePlaybackEngine.js`,
      `NEXT_PUBLIC_PLAYBACK_MODE`, MediaSession API on the native engine, updated
      README/CLAUDE.md) — in progress as of this doc's last edit.

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
