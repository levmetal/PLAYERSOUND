import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryCache } from './memoryCache.js'

const clock = (start = 0) => {
    let t = start
    return { now: () => t, advance: (ms) => { t += ms } }
}

test('returns a stored value before its TTL', async () => {
    const time = clock()
    const cache = createMemoryCache({ now: time.now })
    await cache.set('k', { a: 1 }, 60)
    time.advance(59_000)
    assert.deepEqual(await cache.get('k'), { a: 1 })
})

test('misses once the TTL has passed', async () => {
    const time = clock()
    const cache = createMemoryCache({ now: time.now })
    await cache.set('k', 'v', 60)
    time.advance(60_001)
    assert.equal(await cache.get('k'), undefined)
})

test('an unknown key is a miss', async () => {
    assert.equal(await createMemoryCache().get('nope'), undefined)
})

test('null is stored as a value, not a miss', async () => {
    const cache = createMemoryCache()
    await cache.set('k', null, 60)
    assert.equal(await cache.get('k'), null)
})

test('past maxEntries the least recently used entry is evicted', async () => {
    const cache = createMemoryCache({ maxEntries: 2 })
    await cache.set('a', 1, 60)
    await cache.set('b', 2, 60)
    await cache.get('a')
    await cache.set('c', 3, 60)
    assert.equal(await cache.get('b'), undefined)
    assert.equal(await cache.get('a'), 1)
    assert.equal(await cache.get('c'), 3)
})
