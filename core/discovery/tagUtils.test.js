import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeTags } from './tagUtils.js'

const lastfm = (name) => JSON.parse(readFileSync(new URL(`../../adapters/lastfm/__fixtures__/${name}.json`, import.meta.url), 'utf8'))
const toTags = (body) => body.toptags.tag.map((tag) => ({ name: tag.name, count: Number(tag.count) }))
const format = (tags) => tags.map((tag) => `${tag.name}:${tag.count}`).join(', ')

test('lowercases and drops the artist\'s own name (real track tags)', () => {
    const tags = normalizeTags(toTags(lastfm('track.getTopTags')), { artists: ['Daft Punk'] })
    assert.equal(format(tags), 'electronic:100, dance:71, poptron:46, house:38, electronica:15, french:1, techno:1, french house:1')
})

test('drops bare years and the artist name', () => {
    const tags = [
        { name: 'synthwave', count: 100 }, { name: 'synthpop', count: 94 }, { name: 'pop', count: 51 },
        { name: '2019', count: 37 }, { name: 'The Weeknd', count: 12 },
    ]
    assert.equal(format(normalizeTags(tags, { artists: ['The Weeknd'] })), 'synthwave:100, synthpop:94, pop:51')
})

test('keeps distinct multi-word tags apart', () => {
    const tags = [{ name: 'Psychedelic Rock', count: 100 }, { name: 'psychedelic', count: 91 }, { name: 'indie rock', count: 38 }]
    assert.equal(format(normalizeTags(tags)), 'psychedelic rock:100, psychedelic:91, indie rock:38')
})

test('merges synonyms keeping the highest count, and drops stoplisted tags', () => {
    const tags = [{ name: 'Hip-Hop', count: 100 }, { name: 'hip hop', count: 80 }, { name: 'rap', count: 60 }, { name: 'seen live', count: 10 }]
    assert.equal(format(normalizeTags(tags)), 'hip-hop:100, rap:60')
})

test('turns 1980s into 80s and merges it', () => {
    const tags = [{ name: '1980s', count: 40 }, { name: '80s', count: 30 }, { name: 'new wave', count: 50 }]
    assert.equal(format(normalizeTags(tags)), 'new wave:50, 80s:40')
})

test('maps the listed synonyms to one name', () => {
    const cases = [
        ['hiphop', 'hip-hop'], ['rnb', 'r&b'], ['rhythm and blues', 'r&b'], ['synth pop', 'synthpop'],
        ['synth-pop', 'synthpop'], ['lofi', 'lo-fi'], ['lo fi', 'lo-fi'], ['kpop', 'k-pop'],
        ['dnb', 'drum and bass'], ['drum n bass', 'drum and bass'],
    ]
    for (const [input, expected] of cases) {
        assert.equal(normalizeTags([{ name: input, count: 10 }])[0]?.name, expected, input)
    }
})

test('names equal without spaces or hyphens merge into the first seen', () => {
    assert.equal(format(normalizeTags([{ name: 'post punk', count: 20 }, { name: 'post-punk', count: 50 }])), 'post punk:50')
})

test('drops zero counts and collapses whitespace', () => {
    assert.equal(format(normalizeTags([{ name: '  indie   pop ', count: 5 }, { name: 'ambient', count: 0 }])), 'indie pop:5')
})

test('cuts to the limit', () => {
    const tags = toTags(lastfm('artist.getTopTags'))
    assert.equal(normalizeTags(tags, { artists: ['Daft Punk'], limit: 3 }).length, 3)
})

test('names that differ only by accents merge into the first seen (real Soda Stereo tags)', () => {
    const tags = [{ name: 'rock en espanol', count: 60 }, { name: 'rock en español', count: 45 }, { name: 'rock', count: 80 }]
    assert.equal(format(normalizeTags(tags)), 'rock:80, rock en espanol:60')
})
