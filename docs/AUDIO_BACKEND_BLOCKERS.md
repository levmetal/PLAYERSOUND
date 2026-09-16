# Audio backend: dual playback engine (shipped)

Last updated 2026-09-15. Read this first if you're picking this up in a new session —
it tells you what already works, what's still open, and where the reasoning behind it
lives, without having to reconstruct the investigation that led here.

## Current state (read this, skip the history unless you need it)

**The hosted demo works again. This is done, not in-progress.**

The app ships **two interchangeable playback engines** behind one hook,
`hooks/usePlaybackEngine.js`, consumed only by `components/player.jsx`:

- **`native`** (default — what `npm run dev` uses with no config): real `<audio>`
  streaming via `pages/api/soundplayer/[...termplayer].js` + `youtubei.js`. No ads, no
  YouTube UI. Only reaches YouTube reliably from a **residential IP** — see "Why two
  engines exist" below for why this is a hard constraint, not a bug to fix.
- **`iframe`** (what the deployed Vercel demo uses): mounts YouTube's own IFrame
  Player API (`youtube-nocookie.com`) directly in the visitor's browser. The request
  never touches our server, so the IP-reputation block below cannot apply to it.

Selected via `NEXT_PUBLIC_PLAYBACK_MODE` (`native` | `iframe`, see
`.env.local.example`). The native engine auto-falls-back to `iframe` at runtime if the
`<audio>` element errors. MediaSession (lock-screen/notification controls) is wired
for `native` only.

**Live right now:**
- `https://playersound.vercel.app` — `NEXT_PUBLIC_PLAYBACK_MODE=iframe` is set in
  Vercel's Production environment variables. Verified in the actual deployed site
  (not just locally): the iframe mounts at `youtube-nocookie.com`, play/pause/seek all
  work against the real YouTube player, and zero requests hit `/api/soundplayer`.
- Local `npm run dev` — defaults to `native`, verified play/pause/seek/volume all work
  identically to before this change.

Implementation commit: `feat(audio): add IFrame playback engine alongside the native
one` on `main`. Read `hooks/usePlaybackEngine.js` directly for exact behavior — it's
short and the comments explain the non-obvious parts (why MediaSession is
native-only, why the iframe mount can't be hidden, etc).

### Not yet verified — real gaps, not hypothetical ones

- **Embedding-disabled videos in `iframe` mode.** The code path exists (`onError` →
  "Este video no está disponible para reproducir embebido."), but no video known to
  have embedding disabled has actually been clicked through to confirm the message
  renders correctly instead of hanging.
- **Mobile background playback**, for real, on a phone. Expected behavior per how
  each engine works: `native` should survive lock-screen/backgrounding fine (real
  `<audio>` + MediaSession); `iframe` likely does not (cross-origin frame, no
  MediaSession wiring) — but this is reasoning from how browsers generally behave,
  not something actually watched happen on a device.
- **The native→iframe runtime fallback path.** Reasoned through and reads correctly
  in the code, but never actually forced (e.g. by pointing `native` mode at a host
  that's blocked) to watch it flip over live.
- **Ad appearance over time.** See the one manual test result below — it's a single
  data point, not a guarantee. Worth an occasional recheck, not active monitoring.

## Why two engines exist (background)

YouTube's InnerTube `/player` API blocks requests from datacenter/cloud IPs
(Vercel, Render, any VPS) with `Sign in to confirm you're not a bot`, regardless of
which client the request pretends to be. This was confirmed exhaustively: a
diagnostic route tested all 15 InnerTube clients `youtubei.js` supports (`IOS,
ANDROID, ANDROID_VR, VISIONOS, WEB, MWEB, WEB_EMBEDDED, WEB_CREATOR, TV, TV_SIMPLY,
TV_EMBEDDED, YTMUSIC, YTMUSIC_ANDROID, YTKIDS, YTSTUDIO_ANDROID`) from the live Vercel
deployment — **all 15 failed**. The same code, from the developer's residential IP,
worked every time. IP reputation is the dominant signal, not client spoofing and not
(directly) the absence of a PO token — a controlled A/B (same code, same clients, no
PO token in either case) isolated IP as the only variable that changed the outcome.

The failure happens inside `getBasicInfo()` (the InnerTube `/player` call) itself,
before `chooseFormat()`, before `download()`, before a single byte is requested from
`googlevideo.com`. That rules out most "how to stream YouTube without getting
blocked" advice — spoofing headers, parsing the DASH manifest, deciphering the `n`
parameter, using short byte-ranges — all of it operates *after* a successful
`/player` response, which this repo already does correctly and which we never reach
in production.

Options considered and rejected for fixing the server-side path directly: a
`bgutil-ytdlp-pot-provider` sidecar (works, but swaps one arms race for another that
needs permanent babysitting), cookies from a real Google account (account-ban risk),
a residential/rotating proxy (recurring cost). The dual-engine architecture sidesteps
the problem instead of fighting it: `native` only ever runs from IPs that were never
blocked to begin with (contributors' own machines), and `iframe` moves the request to
the visitor's own browser, where it was never a bot in the first place.

Fuller two-session investigation trail — exact log output, the `patch-package` fix
for an unrelated `youtubei.js`/Next.js 12 bundling crash that was blocking things
*before* the bot wall was even reached, and the discarded options in more detail — is
preserved in git history for this file if you need the blow-by-blow; it's been
compressed out of the current version to keep this doc scannable now that the
decision has shipped.

### The one ad test that was run (manual, not automated)

Browser automation could not complete an ad test itself — one attempt was
contaminated by an ad-blocking extension already active in that Chrome profile
(masked whether `youtube.com/embed` itself was blocking ads or the extension was),
and another got stuck at `0:00` forever because synthetic clicks don't satisfy the
browser's autoplay-with-sound gesture requirement inside a cross-origin iframe. If
you need to re-test this, it needs an actual human click — don't retry it via
automation.

The user then tested manually across multiple incognito browsers with no extensions,
using `kJQP7kiw5Fk` (Despacito — a monetized major-label video picked specifically to
be likely to carry ads): **no ad played on either `youtube.com/embed` or
`youtube-nocookie.com/embed`.** This is one video and ad fill is probabilistic —
"didn't show this time" isn't "will never show" — but it's consistent with IFrame
embeds generally having much lower ad fill than direct youtube.com views. The
implementation uses `youtube-nocookie.com` regardless, since it sends no tracking
cookie before playback starts and performed identically to the standard domain in
this test. The in-app "demo" notice deliberately doesn't promise "no ads" — it says
"vía YouTube" and lets reality be a pleasant surprise rather than a broken promise.

## Useful facts for quick reproduction

- Production URL: `https://playersound.vercel.app` (aliased; Vercel project is
  `levmetals-projects/playersound`). `npx vercel link` then `npx vercel logs <url>` to
  get real runtime logs — `gh api repos/levmetal/PLAYERSOUND/commits/main/status` /
  `.../deployments` only show *build* status, never runtime errors.
- To check/change the Production env var: `npx vercel env ls` /
  `npx vercel env add NEXT_PUBLIC_PLAYBACK_MODE production`, then
  `npx vercel deploy --prod --force` to actually redeploy with the new value (env var
  changes don't retroactively apply to already-built deployments).
- Known-good, non-region-locked test video ids used throughout this investigation:
  `fJ9rUzIMcZQ` (Bohemian Rhapsody), `xFYQQPAOz7Y`, `kJQP7kiw5Fk` (Despacito),
  `DfG6VKnjrVw`.
