import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import queueReducer, {
    initialQueueState,
    currentVideo,
    nextVideo,
    prevVideo,
    hasNext,
    hasPrev,
    queuePosition,
} from './queueReducer.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const [A, B, C] = videos
const SEARCH = { type: 'search', label: 'daft punk' }

const playList = (list, startIndex, source = SEARCH) =>
    queueReducer(initialQueueState, { type: 'PLAY_LIST', payload: { videos: list, startIndex, source } })

test('initial state is empty with nothing current', () => {
    assert.deepEqual(initialQueueState, { items: [], index: -1, source: null, direction: 1, unplayable: [] })
    assert.equal(currentVideo(initialQueueState), null)
    assert.equal(hasNext(initialQueueState), false)
    assert.equal(hasPrev(initialQueueState), false)
    assert.equal(queuePosition(initialQueueState), null)
})

test('PLAY_LIST starts at the given index and keeps the source', () => {
    const state = playList([A, B, C], 1)
    assert.equal(currentVideo(state), B)
    assert.equal(hasPrev(state), true)
    assert.equal(hasNext(state), true)
    assert.deepEqual(queuePosition(state), { current: 2, total: 3 })
    assert.deepEqual(state.source, SEARCH)
})

test('queued items are marked as chosen by the user', () => {
    const state = playList([A, B], 0)
    assert.deepEqual(state.items.map((item) => item.origin), ['user', 'user'])
})

test('first item has a next but no previous', () => {
    const state = playList([A, B, C], 0)
    assert.equal(hasNext(state), true)
    assert.equal(hasPrev(state), false)
})

test('last item has a previous but no next', () => {
    const state = playList([A, B, C], 2)
    assert.equal(hasNext(state), false)
    assert.equal(hasPrev(state), true)
})

test('a single-item queue has neither next nor previous', () => {
    const state = playList([A], 0)
    assert.equal(hasNext(state), false)
    assert.equal(hasPrev(state), false)
})

test('NEXT moves to the following item', () => {
    const state = queueReducer(playList([A, B, C], 1), { type: 'NEXT' })
    assert.equal(currentVideo(state), C)
})

test('NEXT on the last item returns the same state object', () => {
    const state = playList([A, B, C], 2)
    assert.equal(queueReducer(state, { type: 'NEXT' }), state)
})

test('PREV moves to the preceding item', () => {
    const state = queueReducer(playList([A, B, C], 1), { type: 'PREV' })
    assert.equal(currentVideo(state), A)
})

test('PREV on the first item returns the same state object', () => {
    const state = playList([A, B, C], 0)
    assert.equal(queueReducer(state, { type: 'PREV' }), state)
})

test('PLAY_LIST with no videos resets to the initial state', () => {
    const state = queueReducer(playList([A, B], 1), { type: 'PLAY_LIST', payload: { videos: [], startIndex: 0, source: SEARCH } })
    assert.deepEqual(state, initialQueueState)
})

test('PLAY_LIST clamps an out-of-range start index', () => {
    assert.equal(playList([A, B, C], 7).index, 2)
    assert.equal(playList([A, B, C], -2).index, 0)
})

test('PLAY_LIST copies the list, so later changes to it do not leak in', () => {
    const list = [A, B, C]
    const state = playList(list, 0)
    list.push(videos[3])
    list[0] = videos[4]
    assert.equal(state.items.length, 3)
    assert.equal(currentVideo(state), A)
})

test('CLEAR resets to the initial state', () => {
    assert.deepEqual(queueReducer(playList([A, B], 1), { type: 'CLEAR' }), initialQueueState)
})

test('an unknown action returns the same state object', () => {
    const state = playList([A, B], 0)
    assert.equal(queueReducer(state, { type: 'NOPE' }), state)
})

test('peeks at the next and previous videos, null at the ends', () => {
    const middle = playList([A, B, C], 1)
    assert.equal(nextVideo(middle), C)
    assert.equal(prevVideo(middle), A)
    assert.equal(prevVideo(playList([A, B, C], 0)), null)
    assert.equal(nextVideo(playList([A, B, C], 2)), null)
})

// --- Unplayable tracks (embedding disabled, removed, private) ---

const D = videos[3]
const skip = (state, video) => queueReducer(state, { type: 'SKIP_UNPLAYABLE', payload: { videoId: video.id } })
const next = (state) => queueReducer(state, { type: 'NEXT' })
const prev = (state) => queueReducer(state, { type: 'PREV' })

test('an unplayable track is skipped forward after moving forward', () => {
    assert.equal(currentVideo(skip(playList([A, B, C], 1), B)), C)
})

test('an unplayable track is skipped backward after moving backward', () => {
    const cameBack = prev(playList([A, B, C], 2))
    assert.equal(currentVideo(skip(cameBack, B)), A)
})

test('with nothing playable ahead, the skip goes back instead', () => {
    assert.equal(currentVideo(skip(playList([A, B], 1), B)), A)
})

test('with nothing playable behind, the skip goes forward instead', () => {
    const atFirst = prev(playList([A, B], 1))
    assert.equal(currentVideo(skip(atFirst, A)), B)
})

test('a lone unplayable track stays current', () => {
    assert.equal(currentVideo(skip(playList([A], 0), A)), A)
})

test('a skip for a track that is no longer current is ignored', () => {
    const state = playList([A, B, C], 1)
    assert.equal(skip(state, A), state)
})

test('NEXT and PREV jump over tracks already found unplayable', () => {
    const atD = skip(skip(playList([A, B, C, D], 1), B), C)
    assert.equal(currentVideo(atD), D)
    const back = prev(atD)
    assert.equal(currentVideo(back), A)
    assert.equal(currentVideo(next(back)), D)
})

test('an unplayable last track leaves no next', () => {
    const state = skip(playList([A, B, C], 2), C)
    assert.equal(currentVideo(state), B)
    assert.equal(hasNext(state), false)
    assert.equal(nextVideo(state), null)
})

test('peeking and availability ignore unplayable tracks on either side', () => {
    const state = skip(skip(playList([A, B, C], 1), B), C)
    assert.equal(currentVideo(state), A)
    assert.equal(hasNext(state), false)
    assert.equal(hasPrev(state), false)
})

test('starting a new list clears what was found unplayable', () => {
    const marked = skip(playList([A, B, C], 1), B)
    const again = queueReducer(marked, { type: 'PLAY_LIST', payload: { videos: [A, B, C], startIndex: 0, source: SEARCH } })
    assert.equal(currentVideo(next(again)), B)
})

// --- Play next / Add to queue ---

const playNext = (state, video) => queueReducer(state, { type: 'PLAY_NEXT', payload: { video } })
const enqueue = (state, video) => queueReducer(state, { type: 'ENQUEUE', payload: { video } })
const ids = (state) => state.items.map((item) => item.video.id)

test('PLAY_NEXT on an empty queue starts a one-track queue', () => {
    const state = playNext(initialQueueState, D)
    assert.deepEqual(ids(state), [D.id])
    assert.equal(currentVideo(state), D)
    assert.deepEqual(state.source, { type: 'track', label: D.title })
})

test('ENQUEUE on an empty queue starts a one-track queue', () => {
    const state = enqueue(initialQueueState, D)
    assert.equal(currentVideo(state), D)
    assert.deepEqual(state.source, { type: 'track', label: D.title })
})

test('PLAY_NEXT puts the video right after the current one', () => {
    const state = playNext(playList([A, B, C], 0), D)
    assert.deepEqual(ids(state), [A.id, D.id, B.id, C.id])
    assert.equal(currentVideo(state), A)
    assert.equal(nextVideo(state), D)
})

test('ENQUEUE puts the video at the end', () => {
    const state = enqueue(playList([A, B, C], 0), D)
    assert.deepEqual(ids(state), [A.id, B.id, C.id, D.id])
    assert.equal(currentVideo(state), A)
})

test('added videos count as chosen by the user', () => {
    const state = enqueue(playNext(playList([A], 0), B), C)
    assert.deepEqual(state.items.map((item) => item.origin), ['user', 'user', 'user'])
})

test('PLAY_NEXT moves a video queued later instead of duplicating it', () => {
    assert.deepEqual(ids(playNext(playList([A, B, C], 0), C)), [A.id, C.id, B.id])
})

test('ENQUEUE moves an already played video to the end and the current one stays current', () => {
    const state = enqueue(playList([A, B, C], 2), A)
    assert.deepEqual(ids(state), [B.id, C.id, A.id])
    assert.equal(currentVideo(state), C)
})

test('queueing the current video returns the same state object', () => {
    const state = playList([A, B, C], 1)
    assert.equal(playNext(state, B), state)
    assert.equal(enqueue(state, B), state)
})

test('picking a video found unplayable earlier clears its mark', () => {
    const marked = skip(playList([A, D, B], 1), D)
    const state = playNext(marked, D)
    assert.equal(state.unplayable.includes(D.id), false)
    assert.equal(nextVideo(state), D)
})

test('queueing keeps the source, direction and other marks', () => {
    const marked = prev(skip(playList([A, B, C, D], 1), B))
    const state = enqueue(marked, videos[4])
    assert.deepEqual(state.source, SEARCH)
    assert.equal(state.direction, marked.direction)
    assert.deepEqual(state.unplayable, [B.id])
})
