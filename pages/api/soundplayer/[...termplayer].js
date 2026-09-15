import { Innertube, UniversalCache } from 'youtubei.js'
import path from 'path'
import os from 'os'

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
    responseLimit: false,
  },
}

// Stream resolver: extracts a playable audio-only stream for one video id and
// pipes it straight to the client, with Range/206 support for seeking.
// Kept separate from the search/catalog endpoint on purpose (different cost,
// different failure modes) — see docs/plan notes on catalog vs. stream resolver.

let innertubePromise = null
function getInnertube() {
  if (!innertubePromise) {
    // Persistent cache avoids re-fetching/re-parsing YouTube's player.js on
    // every request (that's also what generates the player.js cache files).
    // Must live under os.tmpdir(), not process.cwd() — serverless platforms
    // (Vercel) ship the deployed function bundle read-only and only allow
    // writes under the OS temp dir; a plain process.cwd() path throws
    // EROFS/EACCES there and breaks every request. /tmp still persists
    // across warm invocations of the same instance, so the cache still pays
    // off — just not across cold starts, which is fine.
    const cacheDir = path.join(os.tmpdir(), 'youtubei-cache')
    innertubePromise = Innertube.create({ cache: new UniversalCache(true, cacheDir) }).catch((err) => {
      // Don't cache a rejected promise — a transient init/network failure
      // would otherwise permanently break this endpoint for the process's
      // lifetime, since every future request would just re-await the same
      // rejection instead of retrying.
      innertubePromise = null
      throw err
    })
  }
  return innertubePromise
}

// YouTube throttles/blocks some googlevideo.com audio requests, but
// enforcement varies per InnerTube client and changes over time (the same
// cat-and-mouse game Discord music bots / yt-dlp / Lavalink's youtube-source
// plugin deal with). Empirically tested against several heavily-protected
// official tracks (see scripts/test-clients.mjs and the project plan notes):
// IOS and ANDROID_VR only get a ~1MB "free preview" window before failing on
// any later range of the same file, while VISIONOS reliably streams the
// entire file. Kept in this order (best-known-working first) with IOS/
// ANDROID_VR as a lower-value fallback (better than nothing if VISIONOS ever
// gets clamped down too) — clients that failed outright in testing (ANDROID,
// WEB, MWEB, WEB_EMBEDDED, WEB_CREATOR, TV, TV_SIMPLY, TV_EMBEDDED, YTMUSIC*)
// are left out to avoid wasted round trips.
const CLIENT_FALLBACK_CHAIN = ['VISIONOS', 'IOS', 'ANDROID_VR']

// Remembers which client worked last for a given video so repeat requests
// (e.g. seeking, which issues a new Range request) skip straight to it
// instead of re-running the whole fallback chain. Per-process, unbounded —
// fine at hobby-project scale, would need an eviction policy at real scale.
const lastWorkingClient = new Map()

function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader || !totalSize) return null
  const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader)
  if (!match) return null
  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= totalSize) return null
  return { start, end }
}

function orderedClients(videoId) {
  const remembered = lastWorkingClient.get(videoId)
  if (!remembered) return CLIENT_FALLBACK_CHAIN
  return [remembered, ...CLIENT_FALLBACK_CHAIN.filter(c => c !== remembered)]
}

// Tries each client in order. For each one, resolves the format AND pulls the
// first chunk of real bytes before declaring success — getBasicInfo/download
// resolving without throwing is not enough, since the 403 from googlevideo
// only surfaces once bytes are actually pulled from the returned stream.
async function resolveWorkingStream(yt, videoId, rangeHeader) {
  let lastErr = new Error('no audio format available for this video')

  for (const client of orderedClients(videoId)) {
    let info
    try {
      info = await yt.getBasicInfo(videoId, { client })
    } catch (err) {
      lastErr = err
      continue
    }

    if (info.playability_status?.status !== 'OK') {
      // Playability can be client-specific (e.g. one client gets a soft
      // bot-detection error like "the page needs to be reloaded" while
      // another resolves fine) — keep trying the rest of the chain.
      lastErr = new Error(`video unavailable: ${info.playability_status?.reason || 'unknown reason'}`)
      continue
    }

    let format
    try {
      format = info.chooseFormat({ type: 'audio', quality: 'best' })
    } catch (err) {
      lastErr = err
      continue
    }

    const totalSize = format.content_length
    const range = parseRange(rangeHeader, totalSize) || (totalSize ? { start: 0, end: totalSize - 1 } : undefined)

    try {
      const stream = await info.download({ type: 'audio', quality: 'best', ...(range ? { range } : {}) })
      const reader = stream.getReader()
      const firstChunk = await reader.read()
      lastWorkingClient.set(videoId, client)
      return {
        client,
        mimeType: format.mime_type?.split(';')[0] || 'audio/webm',
        totalSize,
        range,
        reader,
        firstChunk,
      }
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr
}

export default async function handler(req, res) {
  const { termplayer } = req.query
  const videoId = Array.isArray(termplayer) ? termplayer[0] : termplayer

  if (!videoId) {
    res.writeHead(400)
    return res.end('missing video id')
  }

  try {
    const yt = await getInnertube()
    const { mimeType, totalSize, range, reader, firstChunk } = await resolveWorkingStream(yt, videoId, req.headers.range)

    if (range) {
      res.writeHead(206, {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
        'Content-Length': range.end - range.start + 1,
        'Accept-Ranges': 'bytes',
      })
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        // Only advertise range support when we actually know the total size —
        // without it we can't honor an arbitrary byte-range request, so
        // claiming Accept-Ranges here would make a later seek silently
        // restart playback from byte 0 instead of jumping to the requested
        // position.
        ...(totalSize ? { 'Content-Length': totalSize, 'Accept-Ranges': 'bytes' } : {}),
      })
    }

    req.on('close', () => {
      reader.cancel().catch(() => {})
    })

    if (!firstChunk.done) res.write(Buffer.from(firstChunk.value))
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (err) {
    console.error(`soundplayer error for ${videoId}:`, err.message)
    if (!res.headersSent) {
      res.writeHead(err.message?.includes('unavailable') ? 404 : 500)
      res.end(`could not resolve audio for this video: ${err.message}`)
    } else {
      res.end()
    }
  }
}
