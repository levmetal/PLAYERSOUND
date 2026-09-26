// Smoke test for /api/discover against a running server (live Last.fm and
// YouTube). Checks the Sprint 2 bar: for 10 real seeds, ranked candidates
// with reasons, the matched videos actually embeddable, and a repeat call
// served from cache. Also checks an unidentifiable seed and tag radio.
// Seeds are paced, and the run stops at once if YouTube starts rate-limiting
// (the response carries retryAfter) instead of adding to it — exit code 2,
// "inconclusive", since video matching can't be judged while blocked.
// Usage: node scripts/test-discover.mjs [baseUrl]   (default http://localhost:3000)
import { readFileSync } from 'node:fs'
import resolveTrack from '../core/track/resolveTrack.js'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const SEED_COUNT = 10
const CACHED_MS = 100
const MATCHED_UP_FRONT = 3
const PAUSE_MS = 2000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const videos = JSON.parse(readFileSync(new URL('../core/__fixtures__/videos.json', import.meta.url), 'utf8'))

// Ten identifiable songs by ten different artists.
const seeds = []
for (const video of videos) {
    const track = resolveTrack(video)
    if (track && !seeds.some((s) => s.track.artist.toLowerCase() === track.artist.toLowerCase())) seeds.push({ video, track })
    if (seeds.length === SEED_COUNT) break
}

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }

async function discover(body) {
    const response = await fetch(`${BASE}/api/discover`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const timing = response.headers.get('server-timing')?.match(/dur=(\d+)/)?.[1]
    return { status: response.status, body: await response.json(), ms: timing === undefined ? null : Number(timing) }
}

async function embeddable(videoId) {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
    return (await fetch(url)).status === 200
}

let embedChecked = 0
let embedOk = 0

console.log(`Discover smoke test against ${BASE} — ${seeds.length} seeds\n`)
for (const { video, track } of seeds) {
    const label = `${track.artist} – ${track.title}`.slice(0, 44).padEnd(45)
    const first = await discover({ seeds: [video], limit: 10 })
    if (first.status !== 200) {
        check(false, `${label}: HTTP ${first.status} ${JSON.stringify(first.body)}`)
        console.log(`✖ ${label} HTTP ${first.status}`)
        continue
    }
    if (first.body.retryAfter) {
        console.log(`
⏸ YouTube is rate-limiting (retry in ${first.body.retryAfter}s) — stopping so as not to add to it.`)
        console.log('Result: inconclusive. Run again once the block has lifted.')
        process.exit(2)
    }
    const { candidates } = first.body
    const scores = candidates.map((c) => c.score)
    const perArtist = {}
    for (const c of candidates) perArtist[c.artist.toLowerCase()] = (perArtist[c.artist.toLowerCase()] ?? 0) + 1

    check(first.body.status === 'ok', `${label}: status ${first.body.status}`)
    check(candidates.length > 0, `${label}: no candidates`)
    check(scores.every((s, i) => i === 0 || s <= scores[i - 1]), `${label}: not sorted by score`)
    check(candidates.every((c) => typeof c.reason?.seed === 'string' && Array.isArray(c.reason.sharedTags)), `${label}: candidate without a reason`)
    check(!candidates.some((c) => c.artist.toLowerCase() === track.artist.toLowerCase() && c.title.toLowerCase() === track.title.toLowerCase()), `${label}: seed returned as a candidate`)
    check(Object.values(perArtist).every((n) => n <= 2), `${label}: more than 2 tracks by one artist`)

    const matched = candidates.filter((c) => c.video)
    check(matched.length >= Math.min(MATCHED_UP_FRONT, candidates.length) - 1, `${label}: only ${matched.length} candidates matched to a video`)
    const playable = await Promise.all(matched.map((c) => embeddable(c.video.id)))
    embedChecked += playable.length
    embedOk += playable.filter(Boolean).length
    matched.forEach((c, i) => { if (!playable[i]) console.log(`  ! not embeddable: ${c.artist} – ${c.title} (${c.video.id})`) })

    const repeat = await discover({ seeds: [video], limit: 10 })
    check(repeat.ms !== null && repeat.ms <= CACHED_MS, `${label}: repeat took ${repeat.ms} ms (expected ≤ ${CACHED_MS} from cache)`)
    check(JSON.stringify(repeat.body) === JSON.stringify(first.body), `${label}: repeat returned a different body`)

    const shared = candidates.filter((c) => c.reason.sharedTags.length).length
    console.log(`✔ ${label} ${String(candidates.length).padStart(2)} candidates · ${matched.length} matched · ${shared} with shared tags · ${String(first.ms).padStart(5)} ms → ${repeat.ms} ms`)
    await sleep(PAUSE_MS)
}

const boilerRoom = videos.find((v) => v.duration > 900)
const unidentified = await discover({ seeds: [boilerRoom] })
check(unidentified.body.status === 'unidentified', `long mix: expected "unidentified", got ${JSON.stringify(unidentified.body).slice(0, 120)}`)
console.log(`${unidentified.body.status === 'unidentified' ? '✔' : '✖'} long mix seed → ${unidentified.body.status}`)

const radio = await discover({ tags: ['synthwave'], limit: 10 })
check(radio.status === 200 && radio.body.candidates?.length > 0 && radio.body.candidates.every((c) => c.reason.seed === null), 'tag radio: bad response')
console.log(`${radio.status === 200 ? '✔' : '✖'} tag radio "synthwave" → ${radio.body.candidates?.length ?? 0} candidates`)

check(embedChecked === 0 || embedOk / embedChecked >= 0.9, `only ${embedOk}/${embedChecked} matched videos are embeddable`)
console.log(`\nEmbeddable matched videos: ${embedOk}/${embedChecked}`)

if (failures.length) {
    console.log(`\n${failures.length} failure(s):`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exit(1)
}
console.log('\nAll discover checks passed.')
