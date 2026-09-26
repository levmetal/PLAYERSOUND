import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import shuffle from './shuffle.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const [A, B, C] = videos
const always = (value) => () => value

test('with rng always 0 every item swaps with the first', () => {
    assert.deepEqual(shuffle([A, B, C], always(0)), [B, C, A])
})

test('with rng just under 1 every item stays in place', () => {
    assert.deepEqual(shuffle([A, B, C], always(0.999)), [A, B, C])
})

test('keeps every item and leaves the input untouched', () => {
    const list = videos.slice(0, 10)
    const copy = [...list]
    let seed = 7
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const shuffled = shuffle(list, rng)
    assert.deepEqual(list, copy)
    assert.equal(shuffled.length, list.length)
    assert.deepEqual([...shuffled].sort((x, y) => x.id.localeCompare(y.id)), [...list].sort((x, y) => x.id.localeCompare(y.id)))
})

test('empty and single-item lists come back as they are', () => {
    assert.deepEqual(shuffle([], always(0)), [])
    assert.deepEqual(shuffle([A], always(0)), [A])
})
