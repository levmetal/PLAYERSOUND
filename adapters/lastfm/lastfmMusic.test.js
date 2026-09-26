import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLastfmMusic, LastfmError } from './lastfmMusic.js'

const recorded = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), 'utf8'))

const jsonResponse = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
})

// Serves a recorded response per Last.fm method and remembers every URL asked for.
const fakeFetch = (bodies) => {
    const urls = []
    const fetch = async (url) => {
        const parsed = new URL(url)
        urls.push(parsed)
        return jsonResponse(bodies[parsed.searchParams.get('method')])
    }
    return { fetch, urls }
}

const catalogWith = (method, fixture) => {
    const fake = fakeFetch({ [method]: recorded(fixture ?? method) })
    return { catalog: createLastfmMusic({ apiKey: 'test-key', fetch: fake.fetch }), urls: fake.urls }
}

test('similarTracks maps track.getSimilar to artist, title, match and playcount', async () => {
    const { catalog } = catalogWith('track.getSimilar')
    const tracks = await catalog.similarTracks({ artist: 'Daft Punk', title: 'Digital Love' })
    assert.equal(tracks.length, 50)
    assert.deepEqual(tracks[0], { artist: 'Daft Punk', title: 'Aerodynamic', match: 1, playcount: 10082923 })
})

test('requests carry method, key, JSON format and autocorrect', async () => {
    const { catalog, urls } = catalogWith('track.getSimilar')
    await catalog.similarTracks({ artist: 'Daft Punk', title: 'Digital Love' }, 50)
    const params = Object.fromEntries(urls[0].searchParams)
    assert.equal(urls[0].origin + urls[0].pathname, 'https://ws.audioscrobbler.com/2.0/')
    assert.deepEqual(params, {
        method: 'track.getSimilar', artist: 'Daft Punk', track: 'Digital Love', limit: '50',
        autocorrect: '1', api_key: 'test-key', format: 'json',
    })
})

test('similarArtists turns string matches into numbers', async () => {
    const { catalog } = catalogWith('artist.getSimilar')
    const artists = await catalog.similarArtists('Soda Stereo')
    assert.deepEqual(artists.slice(0, 2), [{ name: 'Gustavo Cerati', match: 1 }, { name: 'Charly García', match: 0.412368 }])
})

test('artistTopTracks maps to artist, title and a numeric playcount', async () => {
    const { catalog } = catalogWith('artist.getTopTracks')
    const [first] = await catalog.artistTopTracks('Soda Stereo')
    assert.deepEqual(first, { artist: 'Soda Stereo', title: 'De Música Ligera - Remasterizado 2007', playcount: 1856716 })
})

test('trackTags returns raw tag names with counts', async () => {
    const { catalog } = catalogWith('track.getTopTags')
    const tags = await catalog.trackTags({ artist: 'Daft Punk', title: 'Digital Love' })
    assert.deepEqual(tags.slice(0, 2), [{ name: 'electronic', count: 100 }, { name: 'dance', count: 71 }])
    assert.ok(tags.some((tag) => tag.name === 'Daft Punk'))
})

test('artistTags returns raw tag names with counts', async () => {
    const { catalog } = catalogWith('artist.getTopTags')
    const tags = await catalog.artistTags('Daft Punk')
    assert.deepEqual(tags[1], { name: 'House', count: 63 })
})

test('tagTopTracks maps to artist, title and a numeric rank', async () => {
    const { catalog } = catalogWith('tag.getTopTracks')
    const [first] = await catalog.tagTopTracks('synthwave')
    assert.deepEqual(first, { artist: 'The Weeknd', title: 'Blinding Lights', rank: 1 })
})

test('searchTrack maps to artist, title and numeric listeners', async () => {
    const { catalog } = catalogWith('track.search')
    const results = await catalog.searchTrack('Daft Punk Digital Love')
    assert.deepEqual(results[1], { artist: 'Daft Punk', title: 'Daft Punk - Digital Love', listeners: 2372 })
})

test('"not found" resolves to an empty list', async () => {
    const { catalog } = catalogWith('track.getSimilar', 'track.getSimilar.notfound')
    assert.deepEqual(await catalog.similarTracks({ artist: 'Titi Me Pregunto', title: 'Bad Bunny 2022' }), [])
})

test('any other Last.fm error rejects with its code and message', async () => {
    const catalog = createLastfmMusic({
        apiKey: 'bad', fetch: async () => jsonResponse({ error: 10, message: 'Invalid API key' }, 403),
    })
    await assert.rejects(catalog.artistTags('Daft Punk'), (error) =>
        error instanceof LastfmError && error.code === 10 && error.message === 'Invalid API key')
})

test('an HTTP failure without a Last.fm error body rejects', async () => {
    const catalog = createLastfmMusic({
        apiKey: 'k', fetch: async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('html') } }),
    })
    await assert.rejects(catalog.artistTags('Daft Punk'), (error) => error instanceof LastfmError && error.code === 'http')
})

test('never has more than 4 requests in flight', async () => {
    let active = 0
    let peak = 0
    const body = recorded('artist.getTopTags')
    const fetch = async () => {
        active += 1
        peak = Math.max(peak, active)
        for (let i = 0; i < 5; i++) await Promise.resolve()
        active -= 1
        return jsonResponse(body)
    }
    const catalog = createLastfmMusic({ apiKey: 'k', fetch })
    await Promise.all(Array.from({ length: 10 }, () => catalog.artistTags('Daft Punk')))
    assert.equal(peak, 4)
})
