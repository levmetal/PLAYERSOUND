import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { smallThumbnail } from './thumbnail.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const playlist = readFileSync(new URL('../../adapters/youtube/__fixtures__/innertube.playlist.json', import.meta.url), 'utf8')
// A real signed playlist thumbnail, as the playlist adapter passes it on.
const SIGNED = playlist.match(/https:\/\/i\.ytimg\.com\/vi\/[^/"]+\/hqdefault\.jpg\?sqp=[^"]+/)[0]

test('a search thumbnail becomes the small 16:9 one of the same video', () => {
    assert.equal(videos[0].thumbnail, 'https://i.ytimg.com/vi/FxzBvqY5PP0/hqdefault.jpg')
    assert.equal(smallThumbnail(videos[0].thumbnail), 'https://i.ytimg.com/vi/FxzBvqY5PP0/mqdefault.jpg')
})

test('every captured search thumbnail gets a small one', () => {
    for (const video of videos) {
        assert.equal(smallThumbnail(video.thumbnail), `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`, video.title)
    }
})

test('a signed playlist thumbnail becomes the plain small one, without the signature', () => {
    const id = SIGNED.match(/\/vi\/([^/]+)\//)[1]
    assert.equal(smallThumbnail(SIGNED), `https://i.ytimg.com/vi/${id}/mqdefault.jpg`)
})

test('a small thumbnail stays as it is', () => {
    assert.equal(smallThumbnail('https://i.ytimg.com/vi/ID/mqdefault.jpg'), 'https://i.ytimg.com/vi/ID/mqdefault.jpg')
})

test('other hosts and other YouTube paths are left alone', () => {
    assert.equal(smallThumbnail('https://example.com/a.jpg'), 'https://example.com/a.jpg')
    assert.equal(smallThumbnail('https://i.ytimg.com/vi_webp/ID/x.webp'), 'https://i.ytimg.com/vi_webp/ID/x.webp')
})

test('no thumbnail stays no thumbnail', () => {
    assert.equal(smallThumbnail(''), '')
    assert.equal(smallThumbnail(undefined), undefined)
})
