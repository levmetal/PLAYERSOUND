import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import queueReducer, { initialQueueState, currentVideo, hasNext } from './queueReducer.js'
import { radioRequest, radioHandoff, pickSeeds, upNext, currentTags, autoplayTarget } from './radio.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const [A, B, C, D, E] = videos
const NOW = 1_790_000_000_000

const reduce = (state, ...actions) => actions.reduce(queueReducer, state)
const ids = (state) => state.items.map((item) => item.video.id)
const origins = (state) => state.items.map((item) => item.origin)

// The candidate shape /api/discover answers with.
const c = (video, title = video?.title ?? 'Pending Track') => ({
    artist: 'Artist', title, score: 0.5, reason: { seed: 'Digital Love', sharedTags: ['french house'] }, video: video ?? null,
})

const startRadio = (seeds = [A], label = seeds[0].title) =>
    queueReducer(initialQueueState, { type: 'START_RADIO', payload: { seeds, label } })
const playList = (list, startIndex = 0) =>
    queueReducer(initialQueueState, { type: 'PLAY_LIST', payload: { videos: list, startIndex, source: { type: 'search', label: 'q' } } })
const batch = (state, payload) =>
    queueReducer(state, { type: 'RADIO_BATCH', payload: { generation: state.generation, status: 'ok', now: NOW, ...payload } })
const resolved = (state, payload) =>
    queueReducer(state, { type: 'RADIO_RESOLVED', payload: { generation: state.generation, now: NOW, ...payload } })

// --- reducer ---

test('START_RADIO plays the seed alone and remembers it as the radio seed', () => {
    const state = startRadio()
    assert.deepEqual(ids(state), [A.id])
    assert.equal(currentVideo(state), A)
    assert.deepEqual(state.source, { type: 'radio', label: A.title })
    assert.deepEqual(state.radio.seeds, [A])
    assert.equal(state.radio.enabled, true)
})

test('START_RADIO from a playlist plays its first track and keeps every seed', () => {
    const state = startRadio([A, B, C], 'Mix')
    assert.deepEqual(ids(state), [A.id])
    assert.deepEqual(state.radio.seeds, [A, B, C])
    assert.deepEqual(state.source, { type: 'radio', label: 'Mix' })
})

test('START_RADIO turns radio on even when it was off', () => {
    const off = queueReducer(initialQueueState, { type: 'SET_RADIO', payload: { enabled: false } })
    const state = queueReducer(off, { type: 'START_RADIO', payload: { seeds: [A], label: 'x' } })
    assert.equal(state.radio.enabled, true)
})

test('a batch appends playable candidates as radio items and keeps the rest pending', () => {
    const state = batch(startRadio(), { candidates: [c(B), c(C), c(null)] })
    assert.deepEqual(ids(state), [A.id, B.id, C.id])
    assert.deepEqual(origins(state), ['user', 'radio', 'radio'])
    assert.deepEqual(state.items[1].reason, { seed: 'Digital Love', sharedTags: ['french house'] })
    assert.deepEqual(state.items[1].track, { artist: 'Artist', title: B.title })
    assert.deepEqual(state.radio.pending.map((p) => p.title), ['Pending Track'])
    assert.equal(state.radio.loading, false)
})

test('a batch answering an older queue is ignored', () => {
    const state = startRadio()
    const stale = queueReducer(state, {
        type: 'RADIO_BATCH', payload: { generation: state.generation - 1, status: 'ok', candidates: [c(B)], now: NOW },
    })
    assert.equal(stale, state)
})

test('starting a new list makes batches for the old one stale', () => {
    const old = startRadio()
    const fresh = queueReducer(old, { type: 'PLAY_LIST', payload: { videos: [D], startIndex: 0, source: null } })
    assert.notEqual(fresh.generation, old.generation)
})

test('a batch skips videos already queued or found unplayable', () => {
    const marked = reduce(playList([A, B, C], 2), { type: 'SKIP_UNPLAYABLE', payload: { videoId: C.id } })
    const state = batch(marked, { candidates: [c(B), c(C), c(D)] })
    assert.deepEqual(ids(state), [A.id, B.id, C.id, D.id])
    assert.equal(state.items[3].origin, 'radio')
})

test('an unidentified seed stops radio without adding anything', () => {
    const state = batch(startRadio(), { status: 'unidentified', candidates: [] })
    assert.equal(state.radio.status, 'unidentified')
    assert.deepEqual(ids(state), [A.id])
})

test('a batch with no candidates means radio has run out', () => {
    assert.equal(batch(startRadio(), { candidates: [] }).radio.status, 'exhausted')
})

test('while YouTube rate-limits, unmatched candidates wait instead of failing', () => {
    const state = batch(startRadio(), { candidates: [c(null, 'One'), c(null, 'Two')], retryAfter: 60 })
    assert.deepEqual(state.radio.pending.map((p) => p.title), ['One', 'Two'])
    assert.equal(state.radio.retryAt, NOW + 60000)
    assert.equal(state.radio.status, 'idle')
})

test('resolving pending candidates appends the matched ones and drops the ones that failed', () => {
    const [p1, p2, p3] = [c(null, 'P1'), c(null, 'P2'), c(null, 'P3')]
    const waiting = batch(startRadio(), { candidates: [p1, p2, p3] })
    const state = resolved(waiting, { requested: [p1, p2], candidates: [{ ...p1, video: D }] })
    assert.deepEqual(ids(state), [A.id, D.id])
    assert.equal(state.items[1].origin, 'radio')
    assert.deepEqual(state.radio.pending.map((p) => p.title), ['P3'])
})

test('rate-limited resolution keeps its candidates pending and waits', () => {
    const [p1, p2] = [c(null, 'P1'), c(null, 'P2')]
    const waiting = batch(startRadio(), { candidates: [p1, p2] })
    const state = resolved(waiting, { requested: [p1, p2], candidates: [p1, p2], retryAfter: 30 })
    assert.deepEqual(state.radio.pending.map((p) => p.title), ['P1', 'P2'])
    assert.equal(state.radio.retryAt, NOW + 30000)
})

test('RADIO_REQUESTED marks radio as loading', () => {
    const state = startRadio()
    assert.equal(queueReducer(state, { type: 'RADIO_REQUESTED', payload: { generation: state.generation } }).radio.loading, true)
})

test('a failed request waits 30 seconds before trying again', () => {
    const start = startRadio()
    const loading = queueReducer(start, { type: 'RADIO_REQUESTED', payload: { generation: start.generation } })
    const state = queueReducer(loading, { type: 'RADIO_FAILED', payload: { generation: loading.generation, now: NOW } })
    assert.equal(state.radio.loading, false)
    assert.equal(state.radio.retryAt, NOW + 30000)
})

test('discovery being off stops radio for this queue', () => {
    const state = startRadio()
    const off = queueReducer(state, { type: 'RADIO_FAILED', payload: { generation: state.generation, now: NOW, unavailable: true } })
    assert.equal(off.radio.status, 'unavailable')
})

test('turning radio off drops the radio items ahead and what was pending', () => {
    const full = batch(startRadio(), { candidates: [c(B), c(C), c(null)] })
    const state = queueReducer(full, { type: 'SET_RADIO', payload: { enabled: false } })
    assert.deepEqual(ids(state), [A.id])
    assert.deepEqual(state.radio.pending, [])
    assert.equal(state.radio.enabled, false)
    assert.notEqual(state.generation, full.generation)
    assert.equal(hasNext(state), false)
})

test('setting radio to its current value returns the same state object', () => {
    assert.equal(queueReducer(initialQueueState, { type: 'SET_RADIO', payload: { enabled: true } }), initialQueueState)
})

test('turning radio off keeps the radio item that is playing', () => {
    const full = batch(startRadio(), { candidates: [c(B), c(C)] })
    const onB = queueReducer(full, { type: 'NEXT' })
    const state = queueReducer(onB, { type: 'SET_RADIO', payload: { enabled: false } })
    assert.deepEqual(ids(state), [A.id, B.id])
    assert.equal(currentVideo(state), B)
})

test('the radio setting survives new lists and clearing', () => {
    const off = queueReducer(initialQueueState, { type: 'SET_RADIO', payload: { enabled: false } })
    assert.equal(reduce(off, { type: 'PLAY_LIST', payload: { videos: [A], startIndex: 0, source: null } }).radio.enabled, false)
    assert.equal(reduce(off, { type: 'CLEAR' }).radio.enabled, false)
})

test("the user's picks are queued ahead of radio items", () => {
    const state = reduce(
        batch(playList([A, B]), { candidates: [c(C)] }),
        { type: 'ENQUEUE', payload: { video: D } },
    )
    assert.deepEqual(ids(state), [A.id, B.id, D.id, C.id])
})

test('a new pick gives stopped radio another try', () => {
    const exhausted = batch(playList([A]), { candidates: [] })
    assert.equal(queueReducer(exhausted, { type: 'ENQUEUE', payload: { video: D } }).radio.status, 'idle')
    assert.equal(queueReducer(exhausted, { type: 'PLAY_NEXT', payload: { video: D } }).radio.status, 'idle')
})

// --- radioRequest ---

test('nothing to fetch when radio is off, busy, stopped, waiting or the queue is empty', () => {
    const base = startRadio()
    const withRadio = (radio) => ({ ...base, radio: { ...base.radio, ...radio } })
    assert.equal(radioRequest(withRadio({ enabled: false }), NOW), null)
    assert.equal(radioRequest(withRadio({ loading: true }), NOW), null)
    assert.equal(radioRequest(withRadio({ status: 'exhausted' }), NOW), null)
    assert.equal(radioRequest(withRadio({ retryAt: NOW + 1 }), NOW), null)
    assert.equal(radioRequest(initialQueueState, NOW), null)
})

test('nothing to fetch while more than 2 tracks are ahead', () => {
    assert.equal(radioRequest(playList([A, B, C, D]), NOW), null)
})

test('with 2 or fewer ahead it asks for a batch seeded by the last track the user chose', () => {
    const request = radioRequest(playList([A, B, C]), NOW)
    assert.equal(request.kind, 'discover')
    assert.deepEqual(request.seeds, [C])
})

test('explicit radio seeds win over the last pick', () => {
    assert.deepEqual(radioRequest(startRadio([A, B], 'Mix'), NOW).seeds, [A, B])
})

test('pending candidates are resolved before asking for a new batch', () => {
    const waiting = batch(startRadio(), { candidates: [c(null, 'P1'), c(null, 'P2')] })
    const request = radioRequest(waiting, NOW)
    assert.equal(request.kind, 'resolve')
    assert.deepEqual(request.candidates.map((p) => p.title), ['P1', 'P2'])
    assert.equal(request.count, 3)
})

test('once the wait is over it asks again', () => {
    const waiting = batch(startRadio(), { candidates: [c(null)], retryAfter: 60 })
    assert.equal(radioRequest(waiting, NOW + 59999), null)
    assert.equal(radioRequest(waiting, NOW + 60000).kind, 'resolve')
})

test('the request excludes queued and unplayable videos and the radio tracks already heard', () => {
    const marked = reduce(playList([A, B], 1), { type: 'SKIP_UNPLAYABLE', payload: { videoId: B.id } })
    const state = batch(marked, { candidates: [{ ...c(E), artist: 'Air', title: "La Femme d'Argent" }] })
    const { exclude } = radioRequest(state, NOW)
    assert.ok(exclude.includes(A.id) && exclude.includes(B.id) && exclude.includes(E.id))
    assert.ok(exclude.includes("air|la femme d'argent"))
})

test('exclude keeps the newest 500 entries', () => {
    const many = videos.concat(Array.from({ length: 600 }, (_, i) => ({ ...A, id: `id${i}` })))
    const { exclude } = radioRequest(playList(many, many.length - 1), NOW)
    assert.equal(exclude.length, 500)
    assert.ok(exclude.includes('id599'))
    assert.ok(!exclude.includes(videos[0].id))
})

test('signals go ahead of the queue in exclude and affinity rides along with discover', () => {
    const signals = { exclude: ['kavinsky|nightcall', 'old-video'], affinity: { night: -0.2 } }
    const request = radioRequest(playList([A]), NOW, signals)
    assert.deepEqual(request.exclude, ['kavinsky|nightcall', 'old-video', A.id])
    assert.deepEqual(request.affinity, { night: -0.2 })
})

test('when over 500, old signals are dropped before anything queued', () => {
    const signals = { exclude: Array.from({ length: 600 }, (_, i) => `old${i}`), affinity: {} }
    const { exclude } = radioRequest(playList([A]), NOW, signals)
    assert.equal(exclude.length, 500)
    assert.equal(exclude[499], A.id)
    assert.ok(!exclude.includes('old0'))
})

test('resolve requests carry no affinity', () => {
    const waiting = batch(startRadio(), { candidates: [c(null)] })
    assert.equal(radioRequest(waiting, NOW, { exclude: [], affinity: { night: 1 } }).affinity, undefined)
})

// --- radioHandoff ---

test("the handoff is reported when playback moves from the user's last pick into radio", () => {
    const before = batch(playList([A]), { candidates: [c(B)] })
    const after = queueReducer(before, { type: 'NEXT' })
    assert.equal(radioHandoff(before, after), 'Digital Love')
})

test('no handoff between user items or between radio items', () => {
    const users = playList([A, B])
    assert.equal(radioHandoff(users, queueReducer(users, { type: 'NEXT' })), null)
    const radio = queueReducer(batch(playList([A]), { candidates: [c(B), c(C)] }), { type: 'NEXT' })
    assert.equal(radioHandoff(radio, queueReducer(radio, { type: 'NEXT' })), null)
})

test('no handoff notice for a radio the listener started', () => {
    const before = batch(startRadio(), { candidates: [c(B)] })
    assert.equal(radioHandoff(before, queueReducer(before, { type: 'NEXT' })), null)
})

// --- pickSeeds ---

test('pickSeeds spreads the picks over the playlist, first and last included', () => {
    const list = videos.slice(0, 9)
    assert.deepEqual(pickSeeds(list, 5).map((v) => v.id), [0, 2, 4, 6, 8].map((i) => list[i].id))
})

test('pickSeeds takes every track of a short playlist', () => {
    assert.deepEqual(pickSeeds([A, B, C], 5), [A, B, C])
})

// --- player sections: jump, tag radio, seed tags, up next ---

const jump = (state, index) => queueReducer(state, { type: 'JUMP_TO', payload: { index } })
const tagRadio = (state, tag) => queueReducer(state, { type: 'START_TAG_RADIO', payload: { tag } })

test('JUMP_TO plays the item at that index, moving forward', () => {
    const state = jump(batch(playList([A, B]), { candidates: [c(C)] }), 2)
    assert.equal(currentVideo(state), C)
    assert.equal(state.direction, 1)
})

test('JUMP_TO the current index or out of range returns the same state object', () => {
    const state = playList([A, B, C], 1)
    assert.equal(jump(state, 1), state)
    assert.equal(jump(state, 7), state)
    assert.equal(jump(state, -1), state)
})

test('tag radio keeps the current track and replaces what was ahead', () => {
    const full = batch(startRadio(), { candidates: [c(B), c(C)] })
    const state = tagRadio(full, 'synthwave')
    assert.deepEqual(ids(state), [A.id])
    assert.equal(currentVideo(state), A)
    assert.deepEqual(state.source, { type: 'tag', label: 'synthwave' })
    assert.deepEqual(state.radio.tags, ['synthwave'])
    assert.deepEqual(state.radio.seeds, [])
    assert.equal(state.radio.enabled, true)
    assert.notEqual(state.generation, full.generation)
})

test('tag radio asks for tracks by tag', () => {
    const request = radioRequest(tagRadio(playList([A]), 'synthwave'), NOW)
    assert.equal(request.kind, 'discover')
    assert.deepEqual(request.tags, ['synthwave'])
    assert.deepEqual(request.seeds, [])
})

test('no handoff notice for a tag radio', () => {
    const before = batch(tagRadio(playList([A]), 'synthwave'), { candidates: [c(B)] })
    assert.equal(radioHandoff(before, queueReducer(before, { type: 'NEXT' })), null)
})

test('a batch remembers the tags Last.fm gave its seed', () => {
    const state = batch(startRadio(), { candidates: [c(B)], seedTags: { [A.id]: ['french house'] } })
    assert.deepEqual(state.radio.seedTags, { [A.id]: ['french house'] })
    assert.deepEqual(currentTags(state), ['french house'])
})

test('tag radio keeps the tags of the track that goes on playing', () => {
    const seeded = batch(startRadio(), { candidates: [c(B)], seedTags: { [A.id]: ['french house', 'disco'] } })
    assert.deepEqual(currentTags(tagRadio(seeded, 'disco')), ['french house', 'disco'])
})

test('currentTags: a radio item shows its shared tags, an unknown track none', () => {
    const onB = queueReducer(batch(startRadio(), { candidates: [c(B)] }), { type: 'NEXT' })
    assert.deepEqual(currentTags(onB), ['french house'])
    assert.deepEqual(currentTags(playList([A])), [])
})

test('upNext splits the playable items ahead by who chose them', () => {
    const withRadio = batch(playList([A, B]), { candidates: [c(C), c(D)] })
    const marked = reduce(withRadio, { type: 'JUMP_TO', payload: { index: 3 } }, { type: 'SKIP_UNPLAYABLE', payload: { videoId: D.id } })
    const state = jump(marked, 1)
    const next = upNext(state)
    assert.deepEqual(next.user, [])
    assert.deepEqual(next.radio.map(({ item, index }) => [item.video.id, index]), [[C.id, 2]])
})

test('upNext lists a user pick queued after radio items under the user', () => {
    const withRadio = batch(playList([A]), { candidates: [c(C)] })
    const state = queueReducer(withRadio, { type: 'ENQUEUE', payload: { video: E } })
    const next = upNext(state)
    assert.deepEqual(next.user.map(({ item }) => item.video.id), [E.id])
    assert.deepEqual(next.radio.map(({ item }) => item.video.id), [C.id])
})

// --- waiting for YouTube ---

test('upNext lists candidates still waiting for a video, at most 5', () => {
    const titles = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
    const state = batch(startRadio(), { candidates: [c(B), ...titles.map((t) => c(null, t))] })
    const next = upNext(state, NOW)
    assert.deepEqual(next.radio.map(({ item }) => item.video.id), [B.id])
    assert.deepEqual(next.waiting.map((w) => w.title), ['W1', 'W2', 'W3', 'W4', 'W5'])
    assert.equal(next.waitMinutes, null)
})

test('while rate-limited, upNext says how many minutes are left', () => {
    const state = batch(startRadio(), { candidates: [c(null, 'W1')], retryAfter: 600 })
    assert.equal(upNext(state, NOW).waitMinutes, 10)
    assert.equal(upNext(state, NOW + 540001).waitMinutes, 1)
    assert.equal(upNext(state, NOW + 600000).waitMinutes, null)
})

// --- autoplayTarget ---

test('autoplayTarget is nothing for an empty queue', () => {
    assert.equal(autoplayTarget(initialQueueState), null)
})

test('autoplayTarget follows the last track the user chose, by its song title', () => {
    assert.equal(autoplayTarget(playList([A, B], 0)), 'Like "Digital Love"')
})

test('autoplayTarget names the radio seed, a playlist, or a vibe', () => {
    assert.equal(autoplayTarget(startRadio([A])), 'Like "Digital Love"')
    assert.equal(autoplayTarget(startRadio([A, B, C], 'Night drive')), 'Like the playlist "Night drive"')
    assert.equal(autoplayTarget(tagRadio(playList([A]), 'synthwave')), 'Vibe: synthwave')
})

test('autoplayTarget falls back to the video title when the song is not identifiable', () => {
    const SET = videos.find((v) => v.title.includes('Boiler Room: London'))
    assert.equal(autoplayTarget(playList([SET])), `Like "${SET.title}"`)
})
