import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createContainer } from './container.js'

test('public edition can discover but not download', () => {
    const container = createContainer({ edition: 'public', lastfmApiKey: 'k' })
    assert.equal(container.can('discover'), true)
    assert.equal(container.can('download'), false)
    assert.deepEqual(container.capabilities.playback, ['iframe'])
})

test('no edition or an unknown one falls back to public', () => {
    for (const edition of [undefined, 'staging']) {
        const container = createContainer({ edition })
        assert.equal(container.can('download'), false)
        assert.deepEqual(container.capabilities.playback, ['iframe'])
    }
})

test('local edition can also download and play local files first', () => {
    const container = createContainer({ edition: 'local', lastfmApiKey: 'k' })
    assert.equal(container.can('discover'), true)
    assert.equal(container.can('download'), true)
    assert.deepEqual(container.capabilities.playback, ['localFile', 'native', 'iframe'])
})

test('an unknown capability is never granted', () => {
    assert.equal(createContainer({ edition: 'local' }).can('teleport'), false)
})

test('exposes the search service', () => {
    assert.equal(typeof createContainer({ edition: 'public' }).search.search, 'function')
})

test('uses the in-memory cache outside Vercel', () => {
    assert.equal(createContainer({ edition: 'public', vercel: false }).cacheKind, 'memory')
})

test('uses the Vercel Runtime Cache on Vercel', () => {
    assert.equal(createContainer({ edition: 'public', vercel: true }).cacheKind, 'runtime')
})

test('discovery is off without a Last.fm key', () => {
    const container = createContainer({ edition: 'public' })
    assert.equal(container.can('discover'), false)
    assert.equal(container.discover, undefined)
})

test('discovery is on with a Last.fm key', () => {
    const container = createContainer({ edition: 'public', lastfmApiKey: 'k' })
    assert.equal(container.can('discover'), true)
    assert.equal(typeof container.discover.discover, 'function')
    assert.equal(typeof container.resolver.resolveTop, 'function')
})

test('tells a music-data source failure apart from other errors', async () => {
    const { LastfmError } = await import('../adapters/lastfm/lastfmMusic.js')
    const container = createContainer({ edition: 'public', lastfmApiKey: 'k' })
    assert.equal(container.isSourceError(new LastfmError(29, 'Rate limit exceeded')), true)
    assert.equal(container.isSourceError(new Error('bug')), false)
})

test('recognizes a YouTube rate limit and reports no block at start', async () => {
    const { YoutubeRateLimitError } = await import('../adapters/youtube/scrapeSearch.js')
    const container = createContainer({ edition: 'public' })
    assert.equal(container.isRateLimited(new YoutubeRateLimitError()), true)
    assert.equal(container.isRateLimited(new Error('other')), false)
    assert.equal(container.youtubeBlockedFor(), 0)
})
