import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import positionsReducer, { initialPositions, isLong, resumeAt, dueForSave, MAX_ENTRIES } from './positions.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
// "Daft Punk - Digital Love (Official Video)", 265 s.
const SONG = videos[0]
// "Fred again.. | Boiler Room: London", 4305 s.
const SET = videos.find((v) => v.title.includes('Boiler Room: London'))
const TOKYO = videos.find((v) => v.title.includes('Boiler Room: Tokyo'))
const AT = 1_790_000_000_000
const DAY = 24 * 60 * 60 * 1000

const save = (state, video, seconds, at = AT) => positionsReducer(state, { type: 'SAVE', payload: { video, seconds, at } })
const forget = (state, videoId) => positionsReducer(state, { type: 'FORGET', payload: { videoId } })
const hydrate = (stored, now = AT) => positionsReducer(initialPositions, { type: 'HYDRATE', payload: { stored, now } })

test('initial positions are empty', () => {
    assert.deepEqual(initialPositions, { entries: [] })
})

test('a track of 10 minutes or more is long; shorter or unknown ones are not', () => {
    assert.equal(isLong({ ...SET, duration: 600 }), true)
    assert.equal(isLong({ ...SET, duration: 599 }), false)
    assert.equal(isLong({ ...SET, duration: 0 }), false)
    assert.equal(isLong(SONG), false)
    assert.equal(isLong(SET), true)
})

test('a song is never saved', () => {
    assert.equal(save(initialPositions, SONG, 120), initialPositions)
})

test('a long track is saved with its video, the second reached and when', () => {
    assert.deepEqual(save(initialPositions, SET, 1390).entries, [{ video: SET, seconds: 1390, at: AT }])
})

test('saving the same track again replaces its entry and makes it the newest', () => {
    let state = save(initialPositions, SET, 1390)
    state = save(state, TOKYO, 700, AT + 1)
    state = save(state, SET, 1500, AT + 2)
    assert.deepEqual(state.entries.map((e) => [e.video.id, e.seconds]), [[TOKYO.id, 700], [SET.id, 1500]])
})

test('a save in the first minute forgets the track: nothing to resume', () => {
    const state = save(save(initialPositions, SET, 1390), SET, 40)
    assert.deepEqual(state.entries, [])
})

test('a save in the last 30 seconds forgets the track: it counts as finished', () => {
    const state = save(save(initialPositions, SET, 1390), SET, SET.duration - 30)
    assert.deepEqual(state.entries, [])
    assert.equal(save(initialPositions, SET, SET.duration - 31).entries.length, 1)
})

test('forget removes the entry', () => {
    const state = forget(save(initialPositions, SET, 1390), SET.id)
    assert.deepEqual(state.entries, [])
})

test('forgetting a track that has no entry changes nothing', () => {
    assert.equal(forget(initialPositions, SET.id), initialPositions)
})

test('the store keeps at most 200 entries; the oldest goes first', () => {
    let state = initialPositions
    for (let i = 0; i < MAX_ENTRIES; i += 1) state = save(state, { ...SET, id: `set-${i}` }, 100, AT + i)
    state = save(state, TOKYO, 700, AT + MAX_ENTRIES)
    assert.equal(MAX_ENTRIES, 200)
    assert.equal(state.entries.length, 200)
    assert.equal(state.entries[0].video.id, 'set-1')
    assert.equal(state.entries.at(-1).video.id, TOKYO.id)
})

test('resume starts 5 seconds before the saved second', () => {
    assert.equal(resumeAt(save(initialPositions, SET, 1390), SET, AT), 1385)
})

test('a track with no entry, or a song, starts at 0', () => {
    assert.equal(resumeAt(initialPositions, SET, AT), 0)
    assert.equal(resumeAt(save(initialPositions, SET, 1390), SONG, AT), 0)
})

test('an entry older than 30 days no longer resumes', () => {
    const state = save(initialPositions, SET, 1390)
    assert.equal(resumeAt(state, SET, AT + 30 * DAY), 1385)
    assert.equal(resumeAt(state, SET, AT + 30 * DAY + 1), 0)
})

test('hydrate keeps the stored entries and drops expired ones', () => {
    const stored = { version: 1, entries: [
        { video: TOKYO, seconds: 700, at: AT - 31 * DAY },
        { video: SET, seconds: 1390, at: AT - DAY },
    ] }
    assert.deepEqual(hydrate(stored).entries, [{ video: SET, seconds: 1390, at: AT - DAY }])
})

test('hydrate ignores a missing or malformed store', () => {
    assert.deepEqual(hydrate(undefined), initialPositions)
    assert.deepEqual(hydrate({ version: 2, entries: [] }), initialPositions)
    assert.deepEqual(hydrate({ version: 1, entries: 'nope' }), initialPositions)
    assert.deepEqual(
        hydrate({ version: 1, entries: [{ video: null, seconds: 1, at: AT }, { video: SET, seconds: 'x', at: AT }, { video: SET, seconds: 900, at: AT }] }).entries,
        [{ video: SET, seconds: 900, at: AT }]
    )
})

test('a save is due once the position has moved 15 seconds either way', () => {
    assert.equal(dueForSave(1390, 1404), false)
    assert.equal(dueForSave(1390, 1405), true)
    assert.equal(dueForSave(1390, 200), true)
})
