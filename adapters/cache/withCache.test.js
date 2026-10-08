import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withCache } from './withCache.js'
import { createMemoryCache } from './memoryCache.js'

// A target that counts how often each method really runs.
const countingTarget = (results = {}) => {
    const calls = { tags: 0, similar: 0, other: 0 }
    return {
        calls,
        target: {
            tags: async (artist) => { calls.tags += 1; return results.tags ?? [`${artist}-tag`] },
            similar: async ({ artist, title }) => { calls.similar += 1; return results.similar ?? [`${artist}|${title}`] },
            other: async () => { calls.other += 1; return 'raw' },
        },
    }
}

const setup = (results) => {
    const { calls, target } = countingTarget(results)
    const cache = createMemoryCache()
    const cached = withCache(target, {
        cache,
        prefix: 'lastfm',
        methods: {
            tags: { ttl: 60, key: (artist) => artist.toLowerCase() },
            similar: { ttl: 60, key: ({ artist, title }) => `${artist}|${title}`.toLowerCase() },
        },
    })
    return { calls, cache, cached }
}

test('a repeat call is served from the cache', async () => {
    const { calls, cached } = setup()
    assert.deepEqual(await cached.tags('Daft Punk'), ['Daft Punk-tag'])
    assert.deepEqual(await cached.tags('daft punk'), ['Daft Punk-tag'])
    assert.equal(calls.tags, 1)
})

test('keys are prefixed with the target and method name', async () => {
    const { cache, cached } = setup()
    await cached.similar({ artist: 'Daft Punk', title: 'Digital Love' })
    assert.deepEqual(await cache.get('lastfm:similar:daft punk|digital love'), ['Daft Punk|Digital Love'])
})

test('an empty result is cached too', async () => {
    const { calls, cached } = setup({ similar: [] })
    await cached.similar({ artist: 'x', title: 'y' })
    assert.deepEqual(await cached.similar({ artist: 'x', title: 'y' }), [])
    assert.equal(calls.similar, 1)
})

test('errors are not cached', async () => {
    let attempts = 0
    const target = { tags: async () => { attempts += 1; if (attempts === 1) throw new Error('flaky'); return ['ok'] } }
    const cached = withCache(target, { cache: createMemoryCache(), prefix: 'p', methods: { tags: { ttl: 60, key: () => 'k' } } })
    await assert.rejects(cached.tags(), /flaky/)
    assert.deepEqual(await cached.tags(), ['ok'])
    assert.equal(attempts, 2)
})

test('identical calls in flight share one underlying call', async () => {
    const { calls, cached } = setup()
    const results = await Promise.all([cached.tags('Justice'), cached.tags('Justice'), cached.tags('JUSTICE')])
    assert.equal(calls.tags, 1)
    assert.deepEqual(results, [['Justice-tag'], ['Justice-tag'], ['Justice-tag']])
})

test('methods without cache settings pass straight through', async () => {
    const { calls, cached } = setup()
    await cached.other()
    await cached.other()
    assert.equal(calls.other, 2)
})

test('a method with cacheIf caches only the values it accepts', async () => {
    let answer = []
    let runs = 0
    const target = { search: async () => { runs += 1; return answer } }
    const cached = withCache(target, {
        cache: createMemoryCache(),
        prefix: 'yt',
        methods: { search: { ttl: 60, key: (term) => term, cacheIf: (videos) => videos.length > 0 } },
    })
    assert.deepEqual(await cached.search('joji'), [])
    assert.deepEqual(await cached.search('joji'), [])
    assert.equal(runs, 2, 'an empty answer is asked again')
    answer = ['video']
    assert.deepEqual(await cached.search('joji'), ['video'])
    assert.deepEqual(await cached.search('joji'), ['video'])
    assert.equal(runs, 3, 'a non-empty answer is cached')
})

test('a cached value that cacheIf rejects (stored before the rule existed) is asked again', async () => {
    const cache = createMemoryCache()
    await cache.set('yt:search:joji', [], 60)
    let runs = 0
    const target = { search: async () => { runs += 1; return ['video'] } }
    const cached = withCache(target, { cache, prefix: 'yt', methods: { search: { ttl: 60, key: (term) => term, cacheIf: (videos) => videos.length > 0 } } })
    assert.deepEqual(await cached.search('joji'), ['video'])
    assert.equal(runs, 1)
})
