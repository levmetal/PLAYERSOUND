// Per-rule breakdown of resolveTrack over the captured search fixtures.
// Usage: node scripts/resolve-report.mjs [--list]
import { readFileSync } from 'node:fs'
import resolveTrack from '../core/track/resolveTrack.js'

const videos = JSON.parse(readFileSync(new URL('../core/__fixtures__/videos.json', import.meta.url), 'utf8'))
const music = videos.filter((video) => video.duration > 0 && video.duration <= 900)
const results = music.map((video) => ({ video, track: resolveTrack(video) }))

const counts = {}
for (const { track } of results) {
    const key = track ? track.rule : 'unidentified'
    counts[key] = (counts[key] ?? 0) + 1
}

const pct = (n) => `${((n / music.length) * 100).toFixed(1)}%`
console.log(`${videos.length} fixtures, ${music.length} music-length (0 < duration <= 15 min)\n`)
for (const key of ['R1', 'R2', 'R3', 'R4', 'unidentified']) {
    console.log(`${key.padEnd(13)} ${String(counts[key] ?? 0).padStart(3)}  ${pct(counts[key] ?? 0)}`)
}
const resolved = music.length - (counts.unidentified ?? 0)
console.log(`\nresolved      ${String(resolved).padStart(3)}  ${pct(resolved)}  (target >= 80%)`)

if (process.argv.includes('--list')) {
    console.log('')
    for (const { video, track } of results) {
        const out = track ? `${track.rule} ${track.artist} / ${track.title}` : 'null'
        console.log(`${video.title.slice(0, 60).padEnd(60)} -> ${out}`)
    }
}
