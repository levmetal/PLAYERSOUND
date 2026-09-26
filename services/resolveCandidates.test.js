import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createResolveCandidates } from './resolveCandidates.js'

const videos = JSON.parse(readFileSync(new URL('../core/__fixtures__/videos.json', import.meta.url), 'utf8'))
const byTitle = (prefix) => {
    const video = videos.find((v) => v.title.startsWith(prefix))
    if (!video) throw new Error(`no fixture titled ${prefix}`)
    return video
}

// YouTube search stand-in: term → real captured results, recording each term asked.
const fakeSearch = (resultsByTerm) => {
    const terms = []
    return { terms, search: async (term) => { terms.push(term); return resultsByTerm[term] ?? [] } }
}

const DIGITAL_LOVE = byTitle('Daft Punk - Digital Love (Official Video)')
const LIGERA_REVERSED = byTitle('De Musica Ligera - Soda Stereo - Video Oficial')
const LIGERA_OFFICIAL = byTitle('Soda Stereo - De Música Ligera (Official Video)')
const CREEP = byTitle('Radiohead - Creep')
const BOILER_ROOM = byTitle('Fred again.. | Boiler Room')
const ROGAN = byTitle('Joe Rogan Experience')

test('searches "<artist> <title>" and returns the result that is that song', async () => {
    const videoSearch = fakeSearch({ 'Daft Punk Digital Love': [DIGITAL_LOVE] })
    const resolver = createResolveCandidates({ videoSearch })
    assert.equal(await resolver.resolve({ artist: 'Daft Punk', title: 'Digital Love' }), DIGITAL_LOVE)
    assert.deepEqual(videoSearch.terms, ['Daft Punk Digital Love'])
})

test('skips results that resolve to a different artist, matching accents loosely', async () => {
    const videoSearch = fakeSearch({ 'Soda Stereo De Música Ligera': [LIGERA_REVERSED, LIGERA_OFFICIAL] })
    const resolver = createResolveCandidates({ videoSearch })
    assert.equal(await resolver.resolve({ artist: 'Soda Stereo', title: 'De Música Ligera' }), LIGERA_OFFICIAL)
})

test('matches when one title contains the other (Last.fm "Remasterizado" naming)', async () => {
    const title = 'De Música Ligera - Remasterizado 2007'
    const videoSearch = fakeSearch({ [`Soda Stereo ${title}`]: [LIGERA_OFFICIAL] })
    const resolver = createResolveCandidates({ videoSearch })
    assert.equal(await resolver.resolve({ artist: 'Soda Stereo', title }), LIGERA_OFFICIAL)
})

test('nothing that is the song resolves to null, never a random first result', async () => {
    const videoSearch = fakeSearch({ 'Daft Punk Digital Love': [ROGAN, BOILER_ROOM, CREEP] })
    const resolver = createResolveCandidates({ videoSearch })
    assert.equal(await resolver.resolve({ artist: 'Daft Punk', title: 'Digital Love' }), null)
})

// --- resolveTop ---

const cand = (artist, title) => ({ artist, title, score: 0.5, playcount: 1, reason: { seed: 'S', sharedTags: [] } })
const DL = cand('Daft Punk', 'Digital Love')
const LIG = cand('Soda Stereo', 'De Música Ligera')
const CR = cand('Radiohead', 'Creep')
const MISSING = cand('Nobody', 'Nothing')

const resolverFor = () => createResolveCandidates({
    videoSearch: fakeSearch({
        'Daft Punk Digital Love': [DIGITAL_LOVE],
        'Soda Stereo De Música Ligera': [LIGERA_OFFICIAL],
        'Radiohead Creep': [CREEP],
    }),
})

test('resolveTop attaches videos to the first N and leaves the rest for later', async () => {
    const result = await resolverFor().resolveTop([DL, LIG, CR], { count: 2 })
    assert.deepEqual(result.map((c) => c.video?.id ?? null), [DIGITAL_LOVE.id, LIGERA_OFFICIAL.id, null])
})

test('resolveTop drops candidates that were tried and failed, and tries the next', async () => {
    const result = await resolverFor().resolveTop([MISSING, DL, LIG], { count: 2 })
    assert.deepEqual(result.map((c) => c.title), ['Digital Love', 'De Música Ligera'])
    assert.ok(result.every((c) => c.video))
})

test('resolveTop treats an excluded or already used video as a failure', async () => {
    const twin = cand('Daft Punk', 'Digital Love (Radio Edit)')
    const result = await resolverFor().resolveTop([DL, twin, CR], { count: 3, excludeVideoIds: [CREEP.id] })
    assert.deepEqual(result.map((c) => c.title), ['Digital Love'])
})

test('resolveTop stops after maxAttempts', async () => {
    const videoSearch = fakeSearch({})
    const resolver = createResolveCandidates({ videoSearch })
    const result = await resolver.resolveTop([MISSING, MISSING, MISSING, DL], { count: 1, maxAttempts: 2 })
    assert.equal(videoSearch.terms.length, 2)
    assert.deepEqual(result.map((c) => c.video ?? null), [null, null])
})

test('resolveTop runs at most 3 searches at once', async () => {
    let active = 0
    let peak = 0
    const videoSearch = {
        search: async () => {
            active += 1
            peak = Math.max(peak, active)
            for (let i = 0; i < 5; i++) await Promise.resolve()
            active -= 1
            return []
        },
    }
    await createResolveCandidates({ videoSearch }).resolveTop(Array.from({ length: 8 }, (_, i) => cand('A', `T${i}`)), { count: 8 })
    assert.equal(peak, 3)
})

test('resolveTop goes through an injected resolve (so it can be cached)', async () => {
    const asked = []
    const resolve = async (track) => { asked.push(track.title); return track.title === 'Digital Love' ? DIGITAL_LOVE : null }
    const resolver = createResolveCandidates({ videoSearch: fakeSearch({}), resolve })
    const result = await resolver.resolveTop([MISSING, DL], { count: 1 })
    assert.deepEqual(asked, ['Nothing', 'Digital Love'])
    assert.deepEqual(result.map((c) => c.video?.id), [DIGITAL_LOVE.id])
    assert.equal(resolver.resolve, resolve)
})
