import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { continueListening, becauseSeed, vibeChips, historyDays, STARTER_VIBES } from './homeSections.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
// "Daft Punk - Digital Love (Official Video)" — identifiable.
const SONG = videos[0]
// "Fred again.. | Boiler Room: London", 4305 s — resolveTrack can't name it.
const SET = videos.find((v) => v.title.includes('Boiler Room: London'))
const TOKYO = videos.find((v) => v.title.includes('Boiler Room: Tokyo'))
const OTHER = videos.find((v) => v.id !== SONG.id && v.title.includes('Digital Love'))
const DAY = 24 * 60 * 60 * 1000
// Noon of a UTC day; the tests' "local day" is the UTC day.
const NOW = 20_000 * DAY + DAY / 2
const localDay = (ms) => Math.floor(ms / DAY)
const entry = (video, at, listened = true) => ({ id: video.id, key: null, at, video, listened })

test('continue listening lists half-heard long tracks, newest first, with their progress', () => {
    const entries = [{ video: TOKYO, seconds: 700, at: 1 }, { video: SET, seconds: 1390, at: 2 }]
    assert.deepEqual(continueListening(entries), [
        { video: SET, seconds: 1390, progress: 1390 / SET.duration },
        { video: TOKYO, seconds: 700, progress: 700 / TOKYO.duration },
    ])
})

test('continue listening shows at most 6 tracks', () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({ video: { ...SET, id: `set-${i}` }, seconds: 100, at: i }))
    const shown = continueListening(entries)
    assert.equal(shown.length, 6)
    assert.equal(shown[0].video.id, 'set-8')
})

test('continue listening is empty without saved positions', () => {
    assert.deepEqual(continueListening([]), [])
})

test('the seed is the newest track really listened to that can be named', () => {
    const history = [entry(OTHER, 1), entry(SONG, 2), entry(SET, 3), entry(OTHER, 4, false)]
    assert.equal(becauseSeed(history), SONG)
})

test('there is no seed when nothing listened to can be named', () => {
    assert.equal(becauseSeed([entry(SET, 1), entry(SONG, 2, false)]), null)
    assert.equal(becauseSeed([{ id: SONG.id, key: 'daft punk|digital love', at: 1 }]), null)
    assert.equal(becauseSeed([]), null)
})

test('vibe chips are the liked tags, strongest first', () => {
    assert.deepEqual(vibeChips({ house: 0.6, night: 0.3, techno: -0.4, disco: 0.05 }), ['house', 'night', 'disco'])
})

test('vibe chips show at most 8 tags', () => {
    const affinity = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`tag${i}`, (i + 1) / 20]))
    const chips = vibeChips(affinity)
    assert.equal(chips.length, 8)
    assert.equal(chips[0], 'tag11')
})

test('a listener with no liked tags gets the starter vibes', () => {
    assert.deepEqual(STARTER_VIBES, ['house', 'lo-fi', 'synthwave', 'jazz', 'hip-hop', 'ambient', 'rock', 'techno'])
    assert.deepEqual(vibeChips({}), STARTER_VIBES)
    assert.deepEqual(vibeChips({ techno: -0.4 }), STARTER_VIBES)
})

test('history is grouped by day, newest first, one row per track per day', () => {
    const today10 = NOW - 2 * 60 * 60 * 1000
    const today18 = NOW + 6 * 60 * 60 * 1000 - 1
    const yesterday = NOW - DAY
    const history = [entry(SONG, yesterday), entry(SONG, today10), entry(SET, today10 + 1), entry(OTHER, today10 + 2, false), entry(SONG, today18)]
    assert.deepEqual(historyDays(history, NOW, localDay), [
        { daysAgo: 0, items: [entry(SONG, today18), entry(SET, today10 + 1)] },
        { daysAgo: 1, items: [entry(SONG, yesterday)] },
    ])
})

test('history leaves out entries saved before videos were kept', () => {
    assert.deepEqual(historyDays([{ id: SONG.id, key: null, at: NOW }], NOW, localDay), [])
})
