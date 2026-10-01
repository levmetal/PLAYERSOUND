import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOembedLookup, VideoLookupError } from './oembedLookup.js'

const recorded = JSON.parse(readFileSync(new URL('./__fixtures__/oembed.video.json', import.meta.url), 'utf8'))

const respond = (status, body = '') => async (url) => {
    respond.urls.push(new URL(url))
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => String(body) }
}
respond.urls = []

// oEmbed answers with the recorded JSON; the watch page with whatever `watch` is
// (a function of the URL → response fields), so each test says what YouTube did.
const details = JSON.parse(readFileSync(new URL('./__fixtures__/watch.videoDetails.json', import.meta.url), 'utf8'))
const watchPage = (body) => ({ status: 200, location: null, text: body })
const watchHtml = `<html><script>var ytInitialPlayerResponse = ${JSON.stringify(details)};</script><script>var other = 1;</script></html>`
const youtube = (watch) => async (url) => {
    const isOembed = new URL(url).pathname === '/oembed'
    if (isOembed) return { ok: true, status: 200, json: async () => recorded }
    const page = await watch()
    return { ok: page.status === 200, status: page.status, headers: { get: () => page.location }, text: async () => page.text }
}

test('a recorded oEmbed answer becomes the Video shape the rest of the app reads', async () => {
    const lookup = createOembedLookup({ fetch: respond(200, recorded) })
    const video = await lookup.video('FTQbiNvZqaY')
    assert.deepEqual(video, {
        id: 'FTQbiNvZqaY',
        title: 'Toto - Africa (Official HD Video)',
        link: 'https://www.youtube.com/watch?v=FTQbiNvZqaY',
        thumbnail: 'https://i.ytimg.com/vi/FTQbiNvZqaY/hqdefault.jpg',
        channel: { id: '', name: 'TotoVEVO', link: 'https://www.youtube.com/@TotoVEVO', verified: false, thumbnail: '' },
        description: '',
        views: 0,
        uploaded: '',
        duration: 0,
    })
})

test('asks oEmbed for the watch URL of that id, in JSON', async () => {
    const lookup = createOembedLookup({ fetch: respond(200, recorded) })
    await lookup.video('FTQbiNvZqaY')
    const asked = respond.urls.at(-2) ?? respond.urls[0]
    assert.equal(asked.origin + asked.pathname, 'https://www.youtube.com/oembed')
    assert.equal(asked.searchParams.get('format'), 'json')
    assert.equal(asked.searchParams.get('url'), 'https://www.youtube.com/watch?v=FTQbiNvZqaY')
})

const failures = [
    [401, 'unplayable', 'embedding disabled or private'],
    [403, 'unplayable', 'forbidden'],
    [400, 'not-found', 'no such id'],
    [404, 'not-found', 'gone'],
    [500, 'unavailable', 'YouTube down'],
    [503, 'unavailable', 'YouTube busy'],
]

for (const [status, code, why] of failures) {
    test(`oEmbed ${status} (${why}) is a ${code} error`, async () => {
        const lookup = createOembedLookup({ fetch: respond(status, 'nope') })
        await assert.rejects(lookup.video('FTQbiNvZqaY'), (error) => error instanceof VideoLookupError && error.code === code)
    })
}

test('a network failure is an unavailable error, not a crash', async () => {
    const lookup = createOembedLookup({ fetch: async () => { throw new TypeError('fetch failed') } })
    await assert.rejects(lookup.video('FTQbiNvZqaY'), (error) => error instanceof VideoLookupError && error.code === 'unavailable')
})

test('an answer without a title is unavailable rather than a nameless track', async () => {
    const lookup = createOembedLookup({ fetch: respond(200, { author_name: 'x' }) })
    await assert.rejects(lookup.video('FTQbiNvZqaY'), (error) => error.code === 'unavailable')
})

test('the watch page adds duration, views, description and channel id to the oEmbed data', async () => {
    const lookup = createOembedLookup({ fetch: youtube(async () => watchPage(watchHtml)) })
    const video = await lookup.video('FTQbiNvZqaY')
    assert.equal(video.title, 'Toto - Africa (Official HD Video)')
    assert.equal(video.duration, 271)
    assert.equal(video.views, 1300088325)
    assert.match(video.description, /^Official HD Video for "Africa" by Toto/)
    assert.equal(video.channel.id, 'UCeVb1p9-ZgbuNCDpITSfxVQ')
    assert.equal(video.channel.name, 'TotoVEVO')
})

test('the watch page is requested without following redirects', async () => {
    const calls = []
    const fetch = async (url, options) => {
        calls.push({ url: new URL(url), options })
        if (new URL(url).pathname === '/oembed') return { ok: true, status: 200, json: async () => recorded }
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => watchHtml }
    }
    await createOembedLookup({ fetch }).video('FTQbiNvZqaY')
    const page = calls.find((call) => call.url.pathname === '/watch')
    assert.equal(page.url.searchParams.get('v'), 'FTQbiNvZqaY')
    assert.equal(page.options.redirect, 'manual')
})

const unknownDetails = [
    ['redirects to the "sorry" page', async () => ({ status: 302, location: 'https://www.google.com/sorry/index', text: '' })],
    ['answers 429', async () => ({ status: 429, location: null, text: '' })],
    ['has no player response', async () => watchPage('<html>consent</html>')],
    ['has a player response that is not JSON', async () => watchPage('<script>var ytInitialPlayerResponse = {nope};</script>')],
    ['fails on the network', async () => { throw new TypeError('fetch failed') }],
]

for (const [what, watch] of unknownDetails) {
    test(`when the watch page ${what}, the video still comes back with unknown details`, async () => {
        const video = await createOembedLookup({ fetch: youtube(watch) }).video('FTQbiNvZqaY')
        assert.equal(video.title, 'Toto - Africa (Official HD Video)')
        assert.equal(video.duration, 0)
        assert.equal(video.views, 0)
        assert.equal(video.description, '')
    })
}

test('a live stream keeps duration 0 (it is not a song of unknown length)', async () => {
    const live = { videoDetails: { ...details.videoDetails, lengthSeconds: '0', isLiveContent: true } }
    const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(live)};</script>`
    const video = await createOembedLookup({ fetch: youtube(async () => watchPage(html)) }).video('FTQbiNvZqaY')
    assert.equal(video.duration, 0)
})
