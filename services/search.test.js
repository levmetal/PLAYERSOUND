import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSearchService } from './search.js'

const videos = JSON.parse(readFileSync(new URL('../core/__fixtures__/videos.json', import.meta.url), 'utf8')).slice(0, 3)

const fakeVideoSearch = (result = videos) => {
    const terms = []
    return { terms, search: async (term) => { terms.push(term); return result } }
}

test('searches the trimmed term and returns the videos unchanged', async () => {
    const videoSearch = fakeVideoSearch()
    const service = createSearchService({ videoSearch })
    assert.equal(await service.search('  radiohead creep '), videos)
    assert.deepEqual(videoSearch.terms, ['radiohead creep'])
})

test('a blank term returns no results without searching', async () => {
    const videoSearch = fakeVideoSearch()
    const service = createSearchService({ videoSearch })
    assert.deepEqual(await service.search(''), [])
    assert.deepEqual(await service.search('   '), [])
    assert.deepEqual(videoSearch.terms, [])
})

test('an adapter failure propagates', async () => {
    const failure = new Error('search down')
    const service = createSearchService({ videoSearch: { search: async () => { throw failure } } })
    await assert.rejects(service.search('radiohead'), (error) => error === failure)
})
