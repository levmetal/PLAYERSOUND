import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createDiscoverService } from './discover.js'

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const lastfm = (name) => read(`../adapters/lastfm/__fixtures__/${name}.json`)
const videos = read('../core/__fixtures__/videos.json')
const byTitle = (prefix) => videos.find((v) => v.title.startsWith(prefix))

const DIGITAL_LOVE = byTitle('Daft Punk - Digital Love (Official Video)') // resolves via R3
const LIGERA = byTitle('Soda Stereo - De Música Ligera (Official Video)')
const BOILER_ROOM = byTitle('Fred again.. | Boiler Room') // 72 min → unidentified

// Recorded Last.fm data in the shape the adapter returns.
const SIMILAR = lastfm('track.getSimilar').similartracks.track.map((t) => ({
    artist: t.artist.name, title: t.name, match: Number(t.match), playcount: Number(t.playcount),
}))
const TRACK_TAGS = lastfm('track.getTopTags').toptags.tag.map((t) => ({ name: t.name, count: Number(t.count) }))
const ARTIST_TAGS = lastfm('artist.getTopTags').toptags.tag.map((t) => ({ name: t.name, count: Number(t.count) }))
const SIMILAR_ARTISTS = lastfm('artist.getSimilar').similarartists.artist.map((a) => ({ name: a.name, match: Number(a.match) }))
const toHits = (body) => body.results.trackmatches.track.map((t) => ({ artist: t.artist, title: t.name, listeners: Number(t.listeners) }))
const SEARCH_REVERSED = toHits(lastfm('track.search.reversed')) // "Titi Me Pregunto Bad Bunny 2022"
const SEARCH_WEAK = toHits(lastfm('track.search')) // "Daft Punk Digital Love": ≤ 2 372 listeners
const TITI_REVERSED = byTitle('Titi Me Pregunto - Bad Bunny') // third-party upload, reversed title
const TAG_TOP = lastfm('tag.getTopTracks').tracks.track.map((t) => ({ artist: t.artist.name, title: t.name, rank: Number(t['@attr'].rank) }))

// Fake MusicCatalog: Daft Punk has everything recorded; Soda Stereo has no
// similar tracks and no track tags, which exercises both fallbacks.
const fakeCatalog = ({ fail = false } = {}) => {
    const calls = { similarTracks: [], similarArtists: [], artistTopTracks: [], trackTags: [], artistTags: [], tagTopTracks: [], searchTrack: [] }
    const guard = () => { if (fail) throw new Error('Last.fm down') }
    return {
        calls,
        catalog: {
            similarTracks: async (track, limit) => {
                guard()
                calls.similarTracks.push([track, limit])
                if (track.artist === 'Daft Punk') return SIMILAR
                // What Last.fm knows once the reversed title is corrected (live answer, trimmed).
                if (track.artist === 'Bad Bunny' && track.title === 'Tití Me Preguntó') {
                    return [{ artist: 'Bad Bunny', title: 'NUEVAYoL', match: 1, playcount: 1 }, { artist: 'Daddy Yankee', title: 'Gasolina', match: 0.4, playcount: 1 }]
                }
                return []
            },
            searchTrack: async (text, limit) => { calls.searchTrack.push([text, limit]); return text.startsWith('Titi Me Pregunto') ? SEARCH_REVERSED : SEARCH_WEAK },
            similarArtists: async (artist, limit) => { calls.similarArtists.push([artist, limit]); return SIMILAR_ARTISTS.slice(0, limit) },
            artistTopTracks: async (artist, limit) => {
                calls.artistTopTracks.push([artist, limit])
                return Array.from({ length: limit }, (_, i) => ({ artist, title: `${artist} hit ${i + 1}`, playcount: 1000 * (i + 1) }))
            },
            trackTags: async (track) => { calls.trackTags.push(track); return track.artist === 'Daft Punk' ? TRACK_TAGS : [] },
            artistTags: async (artist) => { calls.artistTags.push(artist); return artist === 'Daft Punk' || artist === 'Soda Stereo' ? ARTIST_TAGS : [] },
            tagTopTracks: async (tag, limit) => { calls.tagTopTracks.push([tag, limit]); return TAG_TOP },
        },
    }
}

// Fake resolver: the first `count` candidates get a stand-in video.
const fakeResolver = () => {
    const calls = []
    return {
        calls,
        resolveTop: async (candidates, options) => {
            calls.push(options)
            return candidates.map((c, i) => ({ ...c, video: i < options.count ? { id: `video-${i}` } : null }))
        },
    }
}

const setup = (catalogOptions) => {
    const catalog = fakeCatalog(catalogOptions)
    const resolver = fakeResolver()
    return { ...catalog, resolver, service: createDiscoverService({ catalog: catalog.catalog, resolver }) }
}

test('seeds that are not songs come back unidentified without calling Last.fm', async () => {
    const { service, calls } = setup()
    assert.deepEqual(await service.discover({ seeds: [BOILER_ROOM] }), { status: 'unidentified', seedTracks: [], candidates: [] })
    assert.deepEqual(calls.similarTracks, [])
})

test('one seed returns ranked candidates with reasons, the first 5 playable', async () => {
    const { service } = setup()
    const result = await service.discover({ seeds: [DIGITAL_LOVE] })
    assert.equal(result.status, 'ok')
    assert.deepEqual(
        { ...result.seedTracks[0], tags: result.seedTracks[0].tags.slice(0, 3) },
        { artist: 'Daft Punk', title: 'Digital Love', rule: 'R3', confidence: 'medium', tags: ['electronic', 'dance', 'poptron'] },
    )
    assert.equal(result.candidates.length, 20)
    assert.ok(result.candidates.slice(0, 5).every((c) => c.video))
    assert.ok(result.candidates.every((c) => c.reason.seed === 'Digital Love'))
    const scores = result.candidates.map((c) => c.score)
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a))
})

test('asks for 50 similar tracks and tags for at most 15 distinct candidate artists', async () => {
    const { service, calls } = setup()
    await service.discover({ seeds: [DIGITAL_LOVE] })
    assert.deepEqual(calls.similarTracks, [[{ artist: 'Daft Punk', title: 'Digital Love' }, 50]])
    assert.ok(calls.artistTags.length <= 15)
    assert.equal(new Set(calls.artistTags).size, calls.artistTags.length)
})

test('the seed itself is never a candidate', async () => {
    const { service } = setup()
    const withSeed = { ...DIGITAL_LOVE }
    const result = await service.discover({ seeds: [withSeed] })
    assert.ok(!result.candidates.some((c) => c.artist === 'Daft Punk' && c.title === 'Digital Love'))
})

test('excluded tracks and videos are honoured', async () => {
    const { service, resolver } = setup()
    const result = await service.discover({ seeds: [DIGITAL_LOVE], exclude: ['justice|d.a.n.c.e.', 'abc123'] })
    assert.ok(!result.candidates.some((c) => c.artist === 'Justice' && c.title === 'D.A.N.C.E.'))
    assert.deepEqual(new Set(resolver.calls[0].excludeVideoIds), new Set(['abc123', DIGITAL_LOVE.id]))
})

test('with no similar tracks it falls back to similar artists\' top tracks', async () => {
    const { service, calls } = setup()
    const result = await service.discover({ seeds: [LIGERA] })
    assert.deepEqual(calls.similarArtists, [['Soda Stereo', 5]])
    assert.equal(calls.artistTopTracks.length, 5)
    const fallbackArtists = new Set(SIMILAR_ARTISTS.slice(0, 5).map((a) => a.name))
    assert.ok(result.candidates.length > 0)
    assert.ok(result.candidates.every((c) => fallbackArtists.has(c.artist)))
})

test('with no track tags the seed takes its artist\'s tags', async () => {
    const { service } = setup()
    const result = await service.discover({ seeds: [LIGERA] })
    assert.deepEqual(result.seedTracks[0].tags.slice(0, 2), ['electronic', 'house'])
})

test('uses at most 5 seeds', async () => {
    const { service, calls } = setup()
    await service.discover({ seeds: Array.from({ length: 7 }, () => DIGITAL_LOVE).map((v, i) => ({ ...v, id: `s${i}`, title: `Daft Punk - Track ${i}` })) })
    assert.equal(calls.similarTracks.length, 5)
})

test('tag radio uses the tag\'s top tracks, with no seed in the reason', async () => {
    const { service, calls } = setup()
    const result = await service.discover({ tags: ['synthwave'] })
    assert.deepEqual(calls.tagTopTracks, [['synthwave', 50]])
    assert.equal(result.status, 'ok')
    assert.deepEqual(result.seedTracks, [])
    const tagTracks = new Set(TAG_TOP.map((t) => `${t.artist}|${t.title}`))
    assert.ok(result.candidates.every((c) => tagTracks.has(`${c.artist}|${c.title}`) && c.reason.seed === null))
})

test('respects the limit', async () => {
    const { service } = setup()
    assert.equal((await service.discover({ seeds: [DIGITAL_LOVE], limit: 8 })).candidates.length, 8)
})

test('a Last.fm failure propagates', async () => {
    const { service } = setup({ fail: true })
    await assert.rejects(service.discover({ seeds: [DIGITAL_LOVE] }), /Last.fm down/)
})

test("R5: a reversed title Last.fm doesn't know is corrected through its search", async () => {
    const { service, calls } = setup()
    const result = await service.discover({ seeds: [TITI_REVERSED] })
    assert.deepEqual(calls.searchTrack, [['Titi Me Pregunto Bad Bunny 2022', 5]])
    assert.deepEqual(
        { ...result.seedTracks[0], tags: undefined },
        { artist: 'Bad Bunny', title: 'Tití Me Preguntó', rule: 'R5', confidence: 'low', tags: undefined },
    )
    assert.deepEqual(result.candidates.map((c) => c.title), ['NUEVAYoL', 'Gasolina'])
    assert.deepEqual(calls.similarArtists, [])
})

test('search hits under 10 000 listeners never correct a seed', async () => {
    const { service, calls } = setup()
    const result = await service.discover({ seeds: [LIGERA] })
    assert.equal(calls.searchTrack.length, 1)
    assert.equal(result.seedTracks[0].rule, 'R3')
    assert.deepEqual(calls.similarArtists, [['Soda Stereo', 5]])
})

test('a seed Last.fm knows as written never triggers a search', async () => {
    const { service, calls } = setup()
    await service.discover({ seeds: [DIGITAL_LOVE] })
    assert.deepEqual(calls.searchTrack, [])
})
