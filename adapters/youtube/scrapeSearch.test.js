import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createScrapeSearch } from './scrapeSearch.js'

// A real youtube.search() response, trimmed to 3 videos.
const recorded = JSON.parse(readFileSync(new URL('./__fixtures__/search-response.json', import.meta.url), 'utf8'))
// The error scrape-youtube throws intermittently on back-to-back searches.
const flake = () => new TypeError("Cannot read properties of undefined (reading 'split')")

const recordSleeps = () => {
    const calls = []
    return { calls, sleep: async (ms) => { calls.push(ms) } }
}

test('returns only the videos from the search response', async () => {
    const adapter = createScrapeSearch({ search: async () => recorded, sleep: async () => {} })
    assert.deepEqual(await adapter.search('radiohead creep'), recorded.videos)
})

test('passes the term through to the library', async () => {
    const terms = []
    const adapter = createScrapeSearch({ search: async (term) => { terms.push(term); return recorded }, sleep: async () => {} })
    await adapter.search('radiohead creep')
    assert.deepEqual(terms, ['radiohead creep'])
})

test('retries after the intermittent library error', async () => {
    let calls = 0
    const { calls: sleeps, sleep } = recordSleeps()
    const adapter = createScrapeSearch({
        search: async () => { calls += 1; if (calls === 1) throw flake(); return recorded },
        sleep,
    })
    assert.deepEqual(await adapter.search('radiohead creep'), recorded.videos)
    assert.deepEqual(sleeps, [800])
})

test('gives up after 3 attempts with growing backoff', async () => {
    let calls = 0
    const { calls: sleeps, sleep } = recordSleeps()
    const adapter = createScrapeSearch({ search: async () => { calls += 1; throw flake() }, sleep })
    await assert.rejects(adapter.search('radiohead creep'), /reading 'split'/)
    assert.equal(calls, 3)
    assert.deepEqual(sleeps, [800, 1600])
})
