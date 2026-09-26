import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rankCandidates, mergeCandidates, trackKey } from './rankCandidates.js'

// Real track.getSimilar response for Daft Punk – Digital Love, mapped like the adapter does.
const recorded = JSON.parse(readFileSync(new URL('../../adapters/lastfm/__fixtures__/track.getSimilar.json', import.meta.url), 'utf8'))
const similar = recorded.similartracks.track.map((t) => ({
    artist: t.artist.name, title: t.name, match: Number(t.match), playcount: Number(t.playcount), seed: 'Digital Love',
}))

// Real artist.getTopTracks response: five Soda Stereo tracks.
const topTracks = JSON.parse(readFileSync(new URL('../../adapters/lastfm/__fixtures__/artist.getTopTracks.json', import.meta.url), 'utf8'))
    .toptracks.track.map((t) => ({ artist: t.artist.name, title: t.name, match: 0.8, playcount: Number(t.playcount), seed: 'Seed' }))

const candidate = (artist, title, overrides = {}) => ({ artist, title, match: 0.5, playcount: 1000, seed: 'Seed', ...overrides })
const rank = (candidates, options = {}) => rankCandidates({ candidates, seedTags: [], candidateTags: {}, ...options })

test('trackKey is the lowercased, trimmed artist|title', () => {
    assert.equal(trackKey(' Daft Punk ', 'Digital Love '), 'daft punk|digital love')
})

test('keeps at most 2 tracks per artist (real top tracks, all Soda Stereo)', () => {
    assert.equal(topTracks.length, 5)
    assert.equal(rank(topTracks).length, 2)
})

test('shared tags with the seed lift a candidate and are given as the reason', () => {
    const seedTags = [{ name: 'electronic', count: 100 }, { name: 'house', count: 60 }]
    const candidateTags = {
        justice: [{ name: 'electronic', count: 100 }, { name: 'house', count: 40 }],
        radiohead: [{ name: 'alternative rock', count: 100 }],
    }
    const ranked = rank([candidate('Radiohead', 'Creep'), candidate('Justice', 'D.A.N.C.E.')], { seedTags, candidateTags })
    assert.equal(ranked[0].artist, 'Justice')
    assert.deepEqual(ranked[0].reason, { seed: 'Seed', sharedTags: ['electronic', 'house'] })
    assert.deepEqual(ranked[1].reason.sharedTags, [])
})

test('the less-played of two otherwise equal candidates ranks first', () => {
    const ranked = rank([candidate('Big', 'Hit', { playcount: 50_000_000 }), candidate('Small', 'Gem', { playcount: 1000 })])
    assert.deepEqual(ranked.map((c) => c.artist), ['Small', 'Big'])
})

test('affinity for a candidate\'s tags raises or lowers its score', () => {
    const candidateTags = { a: [{ name: 'night', count: 100 }] }
    const score = (affinity) => rank([candidate('A', 'Track')], { candidateTags, affinity })[0].score
    assert.ok(score({ night: 1 }) > score({}))
    assert.ok(score({ night: -1 }) < score({}))
})

test('excluded tracks are never returned', () => {
    const ranked = rank([candidate('Justice', 'D.A.N.C.E.'), candidate('Air', 'La femme d\'argent')], { exclude: ['justice|d.a.n.c.e.'] })
    assert.deepEqual(ranked.map((c) => c.artist), ['Air'])
})

test('cuts to the limit', () => {
    assert.equal(rank(similar, { limit: 5 }).length, 5)
})

test('scores are rounded to 4 decimals', () => {
    const [top] = rank([candidate('A', 'T', { match: 0.123456789 })])
    assert.equal(top.score, Number(top.score.toFixed(4)))
})

test('ties keep the original order', () => {
    const ranked = rank([candidate('First', 'One'), candidate('Second', 'Two')])
    assert.deepEqual(ranked.map((c) => c.artist), ['First', 'Second'])
})

test('mergeCandidates averages match over seeds, so shared suggestions rise', () => {
    const seedA = { artist: 'A', title: 'Seed A' }
    const seedB = { artist: 'B', title: 'Seed B' }
    const merged = mergeCandidates([
        { seed: seedA, candidates: [candidate('Solo', 'Pick', { match: 0.9 }), candidate('Both', 'Pick', { match: 0.5 })] },
        { seed: seedB, candidates: [candidate('Both', 'Pick', { match: 0.5 })] },
    ])
    const byArtist = Object.fromEntries(merged.map((c) => [c.artist, c]))
    assert.equal(byArtist.Both.match, 0.5)
    assert.equal(byArtist.Solo.match, 0.45)
    assert.equal(rank(merged)[0].artist, 'Both')
})

test('mergeCandidates credits the seed that matched a candidate best', () => {
    const merged = mergeCandidates([
        { seed: { artist: 'A', title: 'Weak seed' }, candidates: [candidate('X', 'Y', { match: 0.2 })] },
        { seed: { artist: 'B', title: 'Strong seed' }, candidates: [candidate('x', 'y', { match: 0.8 })] },
    ])
    assert.equal(merged.length, 1)
    assert.equal(merged[0].seed, 'Strong seed')
})
