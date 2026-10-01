import { test } from 'node:test'
import assert from 'node:assert/strict'
import { savableTracks, defaultPlaylistName } from './saveQueue.js'

const video = (id) => ({ id, title: `Track ${id}`, duration: 200 })
const [A, B, C] = ['a', 'b', 'c'].map(video)
const user = (v) => ({ video: v, origin: 'user' })
const radio = (v) => ({ video: v, origin: 'radio' })

test("autoplay's picks are not part of the saved queue", () => {
    assert.deepEqual(savableTracks({ items: [user(A), user(B), radio(C)], index: 0 }), [A, B])
})

test('a video queued twice is saved once, at its first position', () => {
    assert.deepEqual(savableTracks({ items: [user(A), user(B), user(A)], index: 0 }), [A, B])
})

test('tracks already played and the one playing are saved, in queue order', () => {
    assert.deepEqual(savableTracks({ items: [user(A), user(B), user(C)], index: 2 }), [A, B, C])
})

test('an empty queue saves nothing', () => {
    assert.deepEqual(savableTracks({ items: [], index: -1 }), [])
})

const names = [
    [{ type: 'search', label: 'khruangbin' }, 'khruangbin'],
    [{ type: 'playlist', label: 'Favorites · shuffled' }, 'Favorites'],
    [{ type: 'playlist', label: 'Night drive' }, 'Night drive'],
    [{ type: 'track', label: 'Toto - Africa (Official HD Video)' }, 'My queue'],
    [{ type: 'radio', label: 'x' }, 'My queue'],
    [{ type: 'search', label: '   ' }, 'My queue'],
    [null, 'My queue'],
    [undefined, 'My queue'],
]

for (const [source, expected] of names) {
    test(`a queue from ${JSON.stringify(source)} is named "${expected}"`, () => {
        assert.equal(defaultPlaylistName(source), expected)
    })
}

test('a very long label is cut to 60 characters', () => {
    const name = defaultPlaylistName({ type: 'search', label: 'x'.repeat(90) })
    assert.equal(name.length, 60)
})
