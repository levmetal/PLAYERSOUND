#!/usr/bin/env node
// One-off diagnostic (not part of the app): tries EVERY InnerTube client
// against a couple of videos already confirmed to fail on IOS/ANDROID/
// TV_EMBEDDED/WEB_EMBEDDED/TV, to see empirically which (if any) client
// still gets real audio bytes back today. This landscape shifts week to
// week, so trusting docs/blog posts over an actual live test is the point.
import { Innertube, UniversalCache } from 'youtubei.js'
import path from 'path'

const ALL_CLIENTS = [
  'IOS', 'ANDROID', 'ANDROID_VR', 'VISIONOS',
  'WEB', 'MWEB', 'WEB_EMBEDDED', 'WEB_CREATOR',
  'TV', 'TV_SIMPLY', 'TV_EMBEDDED',
  'YTMUSIC', 'YTMUSIC_ANDROID',
]

const HARD_VIDEOS = [
  { id: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito' },
]
const CONTROL_VIDEO = { id: 'dQw4w9WgXcQ', title: 'Rick Astley (known-good control)' }

async function tryClient(yt, videoId, client) {
  try {
    const info = await yt.getBasicInfo(videoId, { client })
    if (info.playability_status?.status !== 'OK') {
      return { client, ok: false, stage: 'playability', reason: info.playability_status?.reason }
    }
    const format = info.chooseFormat({ type: 'audio', quality: 'best' })
    const totalSize = format.content_length
    const stream = await info.download({
      type: 'audio', quality: 'best',
      ...(totalSize ? { range: { start: 0, end: Math.min(totalSize - 1, 65535) } } : {}),
    })
    const { done, value } = await stream.getReader().read()
    if (done || !value?.length) return { client, ok: false, stage: 'stream', reason: 'empty stream' }
    return { client, ok: true, bytes: value.length }
  } catch (err) {
    return { client, ok: false, stage: 'exception', reason: err.message }
  }
}

async function main() {
  const cacheDir = path.join(process.cwd(), '.cache', 'youtubei')
  const yt = await Innertube.create({ cache: new UniversalCache(true, cacheDir) })

  for (const video of [CONTROL_VIDEO, ...HARD_VIDEOS]) {
    console.log(`\n=== ${video.title} (${video.id}) ===`)
    for (const client of ALL_CLIENTS) {
      const result = await tryClient(yt, video.id, client)
      console.log(
        result.ok
          ? `  OK    ${client.padEnd(16)} (${result.bytes} bytes)`
          : `  FAIL  ${client.padEnd(16)} [${result.stage}] ${result.reason}`
      )
    }
  }
}

main().catch(err => {
  console.error('crashed:', err)
  process.exitCode = 1
})
