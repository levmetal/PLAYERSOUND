import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFallbackSearch } from './fallbackSearch.js'

const videos = JSON.parse(readFileSync(new URL('../../core/__fixtures__/videos.json', import.meta.url), 'utf8'))
const TWENTY = videos.slice(0, 20)
const EIGHTEEN = videos.slice(20, 38)

// A VideoSearch port that answers (or throws) and counts its calls.
const port = (answer) => {
    const calls = []
    return { calls, search: async (term) => { calls.push(term); if (answer instanceof Error) throw answer; return answer } }
}

test('the primary answer is used when it has videos, and the fallback is not asked', async () => {
    const primary = port(TWENTY); const fallback = port(EIGHTEEN)
    assert.deepEqual(await createFallbackSearch(primary, fallback).search('daft punk'), TWENTY)
    assert.deepEqual(fallback.calls, [])
})

test('an empty primary answer falls back', async () => {
    const primary = port([]); const fallback = port(EIGHTEEN)
    assert.deepEqual(await createFallbackSearch(primary, fallback).search('joji'), EIGHTEEN)
    assert.deepEqual([primary.calls, fallback.calls], [['joji'], ['joji']])
})

test('both empty is an empty answer', async () => {
    assert.deepEqual(await createFallbackSearch(port([]), port([])).search('zzzz'), [])
})

test('a primary failure falls back, so search keeps working during its cooldown', async () => {
    const limited = Object.assign(new Error('YouTube is limiting automated searches right now.'), { code: 'rate-limited' })
    assert.deepEqual(await createFallbackSearch(port(limited), port(EIGHTEEN)).search('joji'), EIGHTEEN)
})

test('when both fail, the primary error is the one thrown', async () => {
    const limited = Object.assign(new Error('rate limited'), { code: 'rate-limited' })
    await assert.rejects(() => createFallbackSearch(port(limited), port(new Error('refused'))).search('joji'), (error) => error === limited)
})

test('other methods of the primary port stay available', () => {
    const primary = { search: async () => [], blockedFor: () => 42 }
    assert.equal(createFallbackSearch(primary, port([])).blockedFor(), 42)
})
