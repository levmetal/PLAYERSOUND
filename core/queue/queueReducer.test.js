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
    assert.deepEqual(initialQueueState, { items: [], index: -1, source: null })
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
