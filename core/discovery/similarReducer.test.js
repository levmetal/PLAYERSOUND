import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import similarReducer, { initialSimilar, viewList, vibeTags, similarRequest, listFor, requestFor } from './similarReducer.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
// A: "Daft Punk - Digital Love (Official Video)" — identifiable. SET: a Boiler Room set — not.
const [A, B] = videos
const SET = videos.find((v) => v.title.includes('Boiler Room: London'))
const NO_SIGNALS = { exclude: [], affinity: {} }

const reduce = (state, ...actions) => actions.reduce(similarReducer, state)
const cand = (artist, title, extra = {}) => ({
    artist, title, score: 0.5, reason: { seed: 'Digital Love', sharedTags: ['french house'] }, video: null, ...extra,
})
const KAVINSKY = cand('Kavinsky', 'Nightcall')
const AIR = cand('Air', 'La Femme d\'Argent')
const ID_KAV = 'kavinsky|nightcall'

const onTrack = (video = A) => reduce(initialSimilar, { type: 'TRACK_CHANGED', payload: { videoId: video.id } })
const loaded = (state, key, candidates, tags) =>
    reduce(state, { type: 'LIST_REQUESTED', payload: { key } }, { type: 'LIST_LOADED', payload: { key, candidates, tags } })

test('initial state is empty', () => {
    assert.deepEqual(initialSimilar, {
        trackId: null, browseTag: null, lists: {}, tags: {}, resolving: {}, videos: {}, unavailable: false,
    })
})

test('TRACK_CHANGED sets the track and leaves any browsed vibe', () => {
    const browsing = reduce(onTrack(), { type: 'BROWSE', payload: { tag: 'house' } })
    const state = reduce(browsing, { type: 'TRACK_CHANGED', payload: { videoId: B.id } })
    assert.equal(state.trackId, B.id)
    assert.equal(state.browseTag, null)
})

test('TRACK_CHANGED to the same track returns the same state object', () => {
    const state = onTrack()
    assert.equal(similarReducer(state, { type: 'TRACK_CHANGED', payload: { videoId: A.id } }), state)
})

test('BROWSE picks a vibe and tapping it again leaves it', () => {
    const state = onTrack()
    const browsing = similarReducer(state, { type: 'BROWSE', payload: { tag: 'house' } })
    assert.equal(browsing.browseTag, 'house')
    assert.equal(similarReducer(browsing, { type: 'BROWSE', payload: { tag: 'house' } }).browseTag, null)
    assert.equal(similarReducer(browsing, { type: 'BROWSE', payload: { tag: 'disco' } }).browseTag, 'disco')
})

test('LIST_REQUESTED starts a loading list', () => {
    const state = similarReducer(onTrack(), { type: 'LIST_REQUESTED', payload: { key: `track:${A.id}` } })
    assert.deepEqual(state.lists[`track:${A.id}`], { status: 'loading', candidates: [] })
})

test('asking again for a list that is loading, done or unidentified returns the same state object', () => {
    const key = `track:${A.id}`
    const loading = similarReducer(onTrack(), { type: 'LIST_REQUESTED', payload: { key } })
    assert.equal(similarReducer(loading, { type: 'LIST_REQUESTED', payload: { key } }), loading)
    const done = reduce(loading, { type: 'LIST_LOADED', payload: { key, candidates: [KAVINSKY], tags: [] } })
    assert.equal(similarReducer(done, { type: 'LIST_REQUESTED', payload: { key } }), done)
    const unidentified = reduce(onTrack(), { type: 'LIST_UNIDENTIFIED', payload: { key } })
    assert.equal(similarReducer(unidentified, { type: 'LIST_REQUESTED', payload: { key } }), unidentified)
})

test('a list that failed can be asked for again', () => {
    const key = `track:${A.id}`
    const failed = reduce(onTrack(), { type: 'LIST_REQUESTED', payload: { key } }, { type: 'LIST_FAILED', payload: { key } })
    assert.equal(failed.lists[key].status, 'error')
    assert.equal(similarReducer(failed, { type: 'LIST_REQUESTED', payload: { key } }).lists[key].status, 'loading')
})

test('LIST_LOADED stores the candidates and, for a track list, the track\'s tags', () => {
    const key = `track:${A.id}`
    const state = loaded(onTrack(), key, [KAVINSKY, AIR], ['electronic', 'french house'])
    assert.deepEqual(state.lists[key], { status: 'done', candidates: [KAVINSKY, AIR] })
    assert.deepEqual(state.tags[A.id], ['electronic', 'french house'])
})

test('a tag list does not set any track\'s tags', () => {
    const state = loaded(onTrack(), 'tag:house', [KAVINSKY], ['house'])
    assert.deepEqual(state.tags, {})
})

test('LIST_UNIDENTIFIED marks the list', () => {
    const key = `track:${SET.id}`
    assert.equal(similarReducer(onTrack(SET), { type: 'LIST_UNIDENTIFIED', payload: { key } }).lists[key].status, 'unidentified')
})

test('LIST_FAILED with unavailable turns discovery off for good', () => {
    const state = similarReducer(onTrack(), { type: 'LIST_FAILED', payload: { key: `track:${A.id}`, unavailable: true } })
    assert.equal(state.unavailable, true)
    assert.equal(viewList(state).status, 'unavailable')
})

test('only the newest 50 lists are kept', () => {
    let state = onTrack()
    for (let i = 0; i < 52; i++) state = loaded(state, `tag:t${i}`, [KAVINSKY])
    assert.equal(Object.keys(state.lists).length, 50)
    assert.ok(!('tag:t0' in state.lists) && !('tag:t1' in state.lists))
    assert.ok('tag:t51' in state.lists)
})

test('resolving a clicked candidate: loading, then the video, then it replaces the row\'s empty video', () => {
    const key = `track:${A.id}`
    const state = loaded(onTrack(), key, [KAVINSKY], [])
    const resolving = similarReducer(state, { type: 'CANDIDATE_RESOLVING', payload: { id: ID_KAV } })
    assert.equal(viewList(resolving).candidates[0].resolving, 'loading')
    const resolved = similarReducer(resolving, { type: 'CANDIDATE_RESOLVED', payload: { id: ID_KAV, video: B } })
    const row = viewList(resolved).candidates[0]
    assert.equal(row.video, B)
    assert.equal(row.resolving, null)
})

test('a candidate whose search found nothing, or was rate-limited, says so', () => {
    const state = loaded(onTrack(), `track:${A.id}`, [KAVINSKY], [])
    const none = similarReducer(state, { type: 'CANDIDATE_FAILED', payload: { id: ID_KAV, limited: false } })
    assert.equal(viewList(none).candidates[0].resolving, 'none')
    const limited = similarReducer(state, { type: 'CANDIDATE_FAILED', payload: { id: ID_KAV, limited: true } })
    assert.equal(viewList(limited).candidates[0].resolving, 'limited')
})

test('a candidate that arrived with a video keeps it', () => {
    const state = loaded(onTrack(), `track:${A.id}`, [{ ...KAVINSKY, video: B }], [])
    assert.equal(viewList(state).candidates[0].video, B)
})

// --- viewList / vibeTags ---

test('the list on screen is the track\'s, or the browsed vibe\'s', () => {
    const state = loaded(loaded(onTrack(), `track:${A.id}`, [KAVINSKY], ['electronic']), 'tag:house', [AIR])
    const track = viewList(state)
    assert.deepEqual([track.key, track.kind, track.tag, track.status], [`track:${A.id}`, 'track', null, 'done'])
    const browsing = viewList(reduce(state, { type: 'BROWSE', payload: { tag: 'house' } }))
    assert.deepEqual([browsing.key, browsing.kind, browsing.tag], ['tag:house', 'tag', 'house'])
    assert.equal(browsing.candidates[0].artist, 'Air')
})

test('a list with no entry yet shows as loading, so a tap gets a skeleton at once', () => {
    const view = viewList(reduce(onTrack(), { type: 'BROWSE', payload: { tag: 'house' } }))
    assert.equal(view.status, 'loading')
    assert.deepEqual(view.candidates, [])
})

test('vibeTags are the playing track\'s tags, empty when unknown', () => {
    const state = loaded(onTrack(), `track:${A.id}`, [KAVINSKY], ['electronic'])
    assert.deepEqual(vibeTags(state), ['electronic'])
    assert.deepEqual(vibeTags(reduce(state, { type: 'TRACK_CHANGED', payload: { videoId: B.id } })), [])
})

// --- similarRequest ---

test('nothing to ask without a track, when discovery is off, or when the list is already there', () => {
    assert.equal(similarRequest(initialSimilar, A, NO_SIGNALS), null)
    const off = similarReducer(onTrack(), { type: 'LIST_FAILED', payload: { key: 'x', unavailable: true } })
    assert.equal(similarRequest(off, A, NO_SIGNALS), null)
    const loading = similarReducer(onTrack(), { type: 'LIST_REQUESTED', payload: { key: `track:${A.id}` } })
    assert.equal(similarRequest(loading, A, NO_SIGNALS), null)
    assert.equal(similarRequest(loaded(onTrack(), `track:${A.id}`, [KAVINSKY], []), A, NO_SIGNALS), null)
})

test('a track that is not a song is reported unidentified without a request', () => {
    assert.deepEqual(similarRequest(onTrack(SET), SET, NO_SIGNALS), { kind: 'unidentified', key: `track:${SET.id}` })
})

test('a song asks Last.fm only: its own list, 12 candidates, no videos', () => {
    const request = similarRequest(onTrack(), A, { exclude: ['x|y'], affinity: { night: 0.4 } })
    assert.deepEqual(request, {
        kind: 'fetch',
        key: `track:${A.id}`,
        body: { seeds: [A], exclude: ['x|y'], affinity: { night: 0.4 }, limit: 12, resolve: 0 },
    })
})

test('a browsed vibe asks for that tag, no videos', () => {
    const state = reduce(onTrack(), { type: 'BROWSE', payload: { tag: 'house' } })
    assert.deepEqual(similarRequest(state, A, NO_SIGNALS), {
        kind: 'fetch', key: 'tag:house', body: { tags: ['house'], exclude: [], affinity: {}, limit: 12, resolve: 0 },
    })
})

test('a browsed vibe is asked for even when the playing track is not a song', () => {
    const state = reduce(onTrack(SET), { type: 'BROWSE', payload: { tag: 'house' } })
    assert.equal(similarRequest(state, SET, NO_SIGNALS).kind, 'fetch')
})

test('a failed list is asked for again', () => {
    const key = `track:${A.id}`
    const failed = reduce(onTrack(), { type: 'LIST_REQUESTED', payload: { key } }, { type: 'LIST_FAILED', payload: { key } })
    assert.equal(similarRequest(failed, A, NO_SIGNALS).kind, 'fetch')
})

test('the request keeps the newest 500 exclusions', () => {
    const exclude = Array.from({ length: 600 }, (_, i) => `id${i}`)
    const { body } = similarRequest(onTrack(), A, { exclude, affinity: {} })
    assert.equal(body.exclude.length, 500)
    assert.equal(body.exclude[499], 'id599')
})

// --- a list for a track that isn't playing (Home: "Because you listened to …") ---

test("requestFor asks for a song's own list, the same one the player would use", () => {
    assert.deepEqual(requestFor(initialSimilar, A, NO_SIGNALS), {
        kind: 'fetch',
        key: `track:${A.id}`,
        body: { seeds: [A], exclude: [], affinity: {}, limit: 12, resolve: 0 },
    })
})

test('requestFor asks for nothing when the list is there or loading, or discovery is off', () => {
    const asked = reduce(initialSimilar, { type: 'LIST_REQUESTED', payload: { key: `track:${A.id}` } })
    assert.equal(requestFor(asked, A, NO_SIGNALS), null)
    assert.equal(requestFor(loaded(initialSimilar, `track:${A.id}`, [KAVINSKY]), A, NO_SIGNALS), null)
    assert.equal(requestFor({ ...initialSimilar, unavailable: true }, A, NO_SIGNALS), null)
})

test('requestFor asks again for a list that failed', () => {
    const failed = reduce(initialSimilar,
        { type: 'LIST_REQUESTED', payload: { key: `track:${A.id}` } },
        { type: 'LIST_FAILED', payload: { key: `track:${A.id}` } })
    assert.equal(requestFor(failed, A, NO_SIGNALS).kind, 'fetch')
})

test("listFor shows a track's list with row ids and found videos, loading until asked", () => {
    assert.deepEqual(listFor(initialSimilar, A.id), { status: 'loading', candidates: [] })
    const state = reduce(loaded(initialSimilar, `track:${A.id}`, [KAVINSKY, AIR]),
        { type: 'CANDIDATE_RESOLVED', payload: { id: ID_KAV, video: B } })
    const list = listFor(state, A.id)
    assert.equal(list.status, 'done')
    assert.deepEqual(list.candidates.map((c) => [c.id, c.video?.id ?? null]), [[ID_KAV, B.id], ["air|la femme d'argent", null]])
})

test('listFor says when discovery is off', () => {
    assert.equal(listFor({ ...initialSimilar, unavailable: true }, A.id).status, 'unavailable')
})
