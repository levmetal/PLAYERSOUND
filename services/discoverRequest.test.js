import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDiscoverRequest, parseResolveRequest } from './discoverRequest.js'

const videos = JSON.parse(readFileSync(new URL('../core/__fixtures__/videos.json', import.meta.url), 'utf8'))
const SEED = videos[0]

const ok = (result) => { assert.equal(result.ok, true, result.error); return result.value }
const fails = (result, pattern) => { assert.equal(result.ok, false); assert.match(result.error, pattern) }

// --- /api/discover ---

test('a real search result is accepted as a seed, with defaults filled in', () => {
    const value = ok(parseDiscoverRequest({ seeds: [SEED] }))
    assert.deepEqual(value, {
        seeds: [{
            id: SEED.id, title: SEED.title, description: SEED.description, duration: SEED.duration,
            channel: { name: SEED.channel.name, verified: SEED.channel.verified },
        }],
        tags: [], exclude: [], affinity: {}, limit: 20,
    })
})

test('unknown seed fields are dropped', () => {
    const value = ok(parseDiscoverRequest({ seeds: [{ ...SEED, evil: '<script>' }] }))
    assert.equal('evil' in value.seeds[0], false)
})

test('tags alone are enough (tag radio)', () => {
    assert.deepEqual(ok(parseDiscoverRequest({ tags: ['synthwave'] })).tags, ['synthwave'])
})

test('a body with neither seeds nor tags is rejected', () => {
    fails(parseDiscoverRequest({}), /seed or a tag/)
    fails(parseDiscoverRequest(null), /seed or a tag/)
})

test('seeds must have a string id and title, 10 at most', () => {
    fails(parseDiscoverRequest({ seeds: [{ title: 'x' }] }), /seeds/)
    fails(parseDiscoverRequest({ seeds: 'x' }), /seeds/)
    fails(parseDiscoverRequest({ seeds: Array.from({ length: 11 }, () => SEED) }), /seeds/)
})

test('tags must be up to 3 non-empty strings of 40 characters or fewer', () => {
    fails(parseDiscoverRequest({ tags: ['a', 'b', 'c', 'd'] }), /tags/)
    fails(parseDiscoverRequest({ tags: [''] }), /tags/)
    fails(parseDiscoverRequest({ tags: ['x'.repeat(41)] }), /tags/)
    fails(parseDiscoverRequest({ tags: [5] }), /tags/)
})

test('exclude must be up to 500 strings', () => {
    assert.deepEqual(ok(parseDiscoverRequest({ seeds: [SEED], exclude: ['abc', 'a|b'] })).exclude, ['abc', 'a|b'])
    fails(parseDiscoverRequest({ seeds: [SEED], exclude: [1] }), /exclude/)
    fails(parseDiscoverRequest({ seeds: [SEED], exclude: Array.from({ length: 501 }, () => 'x') }), /exclude/)
})

test('affinity values must be numbers between -1 and 1, 100 entries at most', () => {
    assert.deepEqual(ok(parseDiscoverRequest({ seeds: [SEED], affinity: { night: 0.6, edm: -0.4 } })).affinity, { night: 0.6, edm: -0.4 })
    fails(parseDiscoverRequest({ seeds: [SEED], affinity: { night: 2 } }), /affinity/)
    fails(parseDiscoverRequest({ seeds: [SEED], affinity: { night: 'x' } }), /affinity/)
    fails(parseDiscoverRequest({ seeds: [SEED], affinity: [] }), /affinity/)
    const big = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`t${i}`, 0]))
    fails(parseDiscoverRequest({ seeds: [SEED], affinity: big }), /affinity/)
})

test('limit must be an integer from 1 to 50', () => {
    assert.equal(ok(parseDiscoverRequest({ seeds: [SEED], limit: 50 })).limit, 50)
    for (const limit of [0, 51, 2.5, '10']) fails(parseDiscoverRequest({ seeds: [SEED], limit }), /limit/)
})

// --- /api/discover/resolve ---

const candidate = { artist: 'Daft Punk', title: 'Digital Love', score: 0.7, reason: { seed: 'x', sharedTags: [] }, video: null }

test('resolve accepts candidates and fills defaults', () => {
    assert.deepEqual(ok(parseResolveRequest({ candidates: [candidate] })), { candidates: [candidate], count: 5, exclude: [] })
})

test('resolve needs 1 to 10 candidates with string artist and title', () => {
    fails(parseResolveRequest({}), /candidates/)
    fails(parseResolveRequest({ candidates: [] }), /candidates/)
    fails(parseResolveRequest({ candidates: [{ artist: 'x' }] }), /candidates/)
    fails(parseResolveRequest({ candidates: Array.from({ length: 11 }, () => candidate) }), /candidates/)
})

test('resolve count must be an integer from 1 to 10', () => {
    assert.equal(ok(parseResolveRequest({ candidates: [candidate], count: 10 })).count, 10)
    for (const count of [0, 11, 1.5]) fails(parseResolveRequest({ candidates: [candidate], count }), /count/)
})
