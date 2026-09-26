import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeCache } from './runtimeCache.js'

// Mimics @vercel/functions' getCache(): get() resolves undefined on a miss.
const fakeRuntime = () => {
    const store = new Map()
    const calls = []
    const runtime = {
        get: async (key) => store.get(key),
        set: async (key, value, options) => { calls.push({ key, value, options }); store.set(key, value) },
    }
    return { getCache: (options) => { calls.push({ getCache: options }); return runtime }, store, calls }
}

test('round-trips a value through the runtime cache with its TTL', async () => {
    const fake = fakeRuntime()
    const cache = createRuntimeCache({ getCache: fake.getCache })
    await cache.set('k', ['a'], 120)
    assert.deepEqual(await cache.get('k'), ['a'])
    assert.deepEqual(fake.calls.find((c) => c.key).options, { ttl: 120 })
})

test('uses the playersound namespace', () => {
    const fake = fakeRuntime()
    createRuntimeCache({ getCache: fake.getCache })
    assert.deepEqual(fake.calls[0], { getCache: { namespace: 'playersound' } })
})

test('null survives the round trip', async () => {
    const cache = createRuntimeCache({ getCache: fakeRuntime().getCache })
    await cache.set('k', null, 60)
    assert.equal(await cache.get('k'), null)
})

test('a miss stays a miss', async () => {
    const cache = createRuntimeCache({ getCache: fakeRuntime().getCache })
    assert.equal(await cache.get('nope'), undefined)
})

test('runtime cache failures never reach the caller', async () => {
    const broken = { get: async () => { throw new Error('cache down') }, set: async () => { throw new Error('cache down') } }
    const cache = createRuntimeCache({ getCache: () => broken })
    assert.equal(await cache.get('k'), undefined)
    await cache.set('k', 1, 60)
})
