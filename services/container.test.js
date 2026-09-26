import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createContainer } from './container.js'

test('public edition can discover but not download', () => {
    const container = createContainer({ edition: 'public' })
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
    const container = createContainer({ edition: 'local' })
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
