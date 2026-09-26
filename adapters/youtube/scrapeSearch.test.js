import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createScrapeSearch, YoutubeRateLimitError } from './scrapeSearch.js'

// A real youtube.search() result, trimmed to 3 videos — what parsing a page yields.
const recorded = JSON.parse(readFileSync(new URL('./__fixtures__/search-response.json', import.meta.url), 'utf8'))
// What YouTube answered during the Sprint 2 smoke test once it started limiting us.
const SORRY = { status: 302, location: 'https://www.google.com/sorry/index?continue=https://www.youtube.com/results', html: '' }
const PAGE = { status: 200, location: null, html: '<html>…var ytInitialData = …</html>' }
// scrape-youtube's error when a page has no results data in it.
const parseFailure = () => new TypeError("Cannot read properties of undefined (reading 'split')")

const clock = () => {
    let t = 0
    return { now: () => t, advance: (ms) => { t += ms } }
}

const setup = ({ pages = [PAGE], parse = async () => recorded.videos } = {}) => {
    const fetched = []
    const sleeps = []
    const time = clock()
    let i = 0
    const adapter = createScrapeSearch({
        fetchPage: async (term) => { fetched.push(term); return pages[Math.min(i++, pages.length - 1)] },
        parsePage: parse,
        sleep: async (ms) => { sleeps.push(ms) },
        now: time.now,
    })
    return { adapter, fetched, sleeps, time }
}

test('returns the videos parsed from the results page', async () => {
    const { adapter, fetched } = setup()
    assert.deepEqual(await adapter.search('radiohead creep'), recorded.videos)
    assert.deepEqual(fetched, ['radiohead creep'])
})

test('retries a page that fails to parse', async () => {
    let calls = 0
    const { adapter, sleeps } = setup({ parse: async () => { calls += 1; if (calls === 1) throw parseFailure(); return recorded.videos } })
    assert.deepEqual(await adapter.search('radiohead creep'), recorded.videos)
    assert.deepEqual(sleeps, [800])
})

test('gives up after 3 attempts with growing backoff', async () => {
    const { adapter, fetched, sleeps } = setup({ parse: async () => { throw parseFailure() } })
    await assert.rejects(adapter.search('radiohead creep'), /reading 'split'/)
    assert.equal(fetched.length, 3)
    assert.deepEqual(sleeps, [800, 1600])
})

test('retries an unexpected HTTP status', async () => {
    const { adapter, fetched } = setup({ pages: [{ status: 500, location: null, html: '' }, PAGE] })
    assert.deepEqual(await adapter.search('radiohead creep'), recorded.videos)
    assert.equal(fetched.length, 2)
})

test('a redirect to Google\'s "sorry" page is a rate limit, not retried', async () => {
    const { adapter, fetched, sleeps } = setup({ pages: [SORRY, PAGE] })
    await assert.rejects(adapter.search('radiohead creep'), (error) =>
        error instanceof YoutubeRateLimitError && error.code === 'rate-limited')
    assert.equal(fetched.length, 1)
    assert.deepEqual(sleeps, [])
})

test('while rate limited, searches fail fast without fetching', async () => {
    const { adapter, fetched, time } = setup({ pages: [SORRY, PAGE] })
    await assert.rejects(adapter.search('a'))
    time.advance(60_000)
    await assert.rejects(adapter.search('b'), YoutubeRateLimitError)
    assert.equal(fetched.length, 1)
    assert.equal(adapter.blockedFor(), 540_000)
})

test('after the 10-minute cooldown it searches again', async () => {
    const { adapter, fetched, time } = setup({ pages: [SORRY, PAGE] })
    await assert.rejects(adapter.search('a'))
    time.advance(600_001)
    assert.equal(adapter.blockedFor(), 0)
    assert.deepEqual(await adapter.search('b'), recorded.videos)
    assert.equal(fetched.length, 2)
})
