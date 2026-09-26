import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import signalsReducer, { initialSignals, discoverSignals } from './signalsReducer.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
// A: "Daft Punk - Digital Love (Official Video)", identifiable as daft punk|digital love.
const [A, B] = videos
// Fred again.. | Boiler Room: London — resolveTrack can't identify it.
const SET = videos.find((v) => v.title.includes('Boiler Room: London'))
const AT = 1_790_000_000_000

const radioItem = (video, tags = ['night', 'synthwave']) => ({
    video, origin: 'radio', reason: { seed: 'Digital Love', sharedTags: tags }, track: { artist: 'Kavinsky', title: 'Nightcall' },
})
const userItem = (video) => ({ video, origin: 'user' })
const listened = (state, item, seconds, finished = false) =>
    signalsReducer(state, { type: 'LISTENED', payload: { item, seconds, finished, at: AT } })
const liked = (state, item) => signalsReducer(state, { type: 'LIKED', payload: { item } })

test('initial signals are empty', () => {
    assert.deepEqual(initialSignals, { affinity: {}, excluded: [], history: [] })
})

test('a skip within 30 seconds lowers its tags and excludes the track', () => {
    const state = listened(initialSignals, radioItem(A), 12)
    assert.deepEqual(state.affinity, { night: -0.2, synthwave: -0.2 })
    assert.deepEqual(state.excluded, ['kavinsky|nightcall', A.id])
    assert.deepEqual(state.history, [{ id: A.id, key: 'kavinsky|nightcall', at: AT }])
})

test('a user pick is keyed by what resolveTrack finds', () => {
    const state = listened(initialSignals, userItem(A), 5)
    assert.deepEqual(state.affinity, {})
    assert.deepEqual(state.excluded, ['daft punk|digital love', A.id])
})

test('a track that cannot be identified is excluded by its video id', () => {
    const state = listened(initialSignals, userItem(SET), 5)
    assert.deepEqual(state.excluded, [SET.id])
    assert.deepEqual(state.history, [{ id: SET.id, key: null, at: AT }])
})

test('a track played to the end nudges its tags up', () => {
    const state = listened(initialSignals, radioItem(A), 200, true)
    assert.deepEqual(state.affinity, { night: 0.05, synthwave: 0.05 })
    assert.deepEqual(state.excluded, [])
    assert.equal(state.history.length, 1)
})

test('a skip after 30 seconds only goes into history', () => {
    const state = listened(initialSignals, radioItem(A), 45)
    assert.deepEqual(state.affinity, {})
    assert.deepEqual(state.excluded, [])
    assert.equal(state.history.length, 1)
})

test('a like raises its tags strongly', () => {
    assert.deepEqual(liked(initialSignals, radioItem(A)).affinity, { night: 0.2, synthwave: 0.2 })
})

test('a like on a track without tags changes nothing', () => {
    const state = liked(initialSignals, userItem(A))
    assert.deepEqual(state, initialSignals)
})

test('affinities are clamped to 1', () => {
    const state = liked({ ...initialSignals, affinity: { night: 0.95 } }, radioItem(A, ['night']))
    assert.deepEqual(state.affinity, { night: 1 })
})

test('affinities are rounded and tags back at zero are dropped', () => {
    const start = { ...initialSignals, affinity: { night: -0.1 } }
    const state = listened(listened(start, radioItem(A, ['night']), 200, true), radioItem(B, ['night']), 200, true)
    assert.deepEqual(state.affinity, {})
})

test('history keeps the newest 500 entries', () => {
    const history = Array.from({ length: 500 }, (_, i) => ({ id: `id${i}`, key: null, at: i }))
    const state = listened({ ...initialSignals, history }, radioItem(A), 45)
    assert.equal(state.history.length, 500)
    assert.equal(state.history[0].id, 'id1')
    assert.equal(state.history[499].id, A.id)
})

test('excluded keeps the newest 200 entries', () => {
    const excluded = Array.from({ length: 200 }, (_, i) => `id${i}`)
    const state = listened({ ...initialSignals, excluded }, radioItem(A), 3)
    assert.equal(state.excluded.length, 200)
    assert.equal(state.excluded[0], 'id2')
    assert.equal(state.excluded[199], A.id)
})

test('HYDRATE replaces the state and fills in missing parts', () => {
    const state = signalsReducer(initialSignals, { type: 'HYDRATE', payload: { affinity: { night: 0.4 } } })
    assert.deepEqual(state, { affinity: { night: 0.4 }, excluded: [], history: [] })
})

test('an unknown action returns the same state object', () => {
    assert.equal(signalsReducer(initialSignals, { type: 'NOPE' }), initialSignals)
})

test('discoverSignals excludes skipped tracks and everything in history, once each', () => {
    const state = listened(listened(initialSignals, radioItem(A), 3), userItem(SET), 60)
    assert.deepEqual(discoverSignals(state).exclude, ['kavinsky|nightcall', A.id, SET.id])
})

test('discoverSignals sends the 100 strongest non-zero affinities', () => {
    const affinity = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`tag${i}`, i % 2 ? i / 200 : -i / 200]))
    const sent = discoverSignals({ ...initialSignals, affinity }).affinity
    assert.equal(Object.keys(sent).length, 100)
    assert.ok('tag149' in sent && 'tag148' in sent)
    assert.ok(!('tag1' in sent))
})
