import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createInnertubePlaylist, PlaylistLookupError, parseBadgeDuration } from './innertubePlaylist.js'

const recorded = JSON.parse(readFileSync(new URL('./__fixtures__/innertube.playlist.json', import.meta.url), 'utf8'))
const lookupWith = (getPlaylist) => createInnertubePlaylist({ getPlaylist })

test('a recorded playlist becomes its title, author, total and Video rows', async () => {
    const asked = []
    const playlist = await lookupWith(async (id) => { asked.push(id); return recorded }).playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')
    assert.deepEqual(asked, ['PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'])
    assert.equal(playlist.title, 'Popular Music Videos')
    assert.equal(playlist.author, 'Music')
    assert.equal(playlist.total, 183)
    assert.equal(playlist.videos.length, 6)
    assert.deepEqual(playlist.videos[0], {
        id: 'fOT0BUpITw8',
        title: 'BELLAKEO (Video Oficial) - Peso Pluma, Anitta',
        link: 'https://www.youtube.com/watch?v=fOT0BUpITw8',
        thumbnail: recorded.items[0].content_image.image[0].url,
        channel: { id: recorded.items[0].metadata.metadata.metadata_rows[0].metadata_parts[0].text.runs[0].endpoint.payload.browseId, name: 'Peso Pluma', link: '', verified: false, thumbnail: '' },
        description: '',
        views: 0,
        uploaded: '',
        duration: 235,
    })
})

test('every recorded item keeps its own id, title and duration', async () => {
    const { videos } = await lookupWith(async () => recorded).playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')
    assert.deepEqual(videos.map((video) => [video.id, video.duration]), [
        ['fOT0BUpITw8', 235], ['NFvDHYMzj9U', 650], ['8c7KOGxeY3w', 235], ['jWdxXdp8sZI', 212], ['s6cdjJvGM2o', 173], ['w1-jss2mZlY', 293],
    ])
})

const badges = [['3:55', 235], ['10:50', 650], ['1:02:03', 3723], ['0:09', 9], ['LIVE', 0], ['SHORTS', 0], ['', 0], [undefined, 0]]
for (const [text, seconds] of badges) {
    test(`duration badge ${JSON.stringify(text)} is ${seconds} seconds`, () => {
        assert.equal(parseBadgeDuration(text), seconds)
    })
}

test('items that are not videos, or have no id, are dropped', async () => {
    const odd = {
        ...recorded,
        items: [
            { ...recorded.items[0], content_type: 'PLAYLIST' },
            { ...recorded.items[1], content_id: undefined },
            recorded.items[2],
        ],
    }
    const { videos } = await lookupWith(async () => odd).playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')
    assert.deepEqual(videos.map((video) => video.id), ['8c7KOGxeY3w'])
})

test('without a usable total, the number of videos stands in', async () => {
    const noTotal = { ...recorded, info: { ...recorded.info, total_items: undefined } }
    const playlist = await lookupWith(async () => noTotal).playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')
    assert.equal(playlist.total, 6)
})

test('a total with thousands separators is read as a number', async () => {
    const big = { ...recorded, info: { ...recorded.info, total_items: '1,234 videos' } }
    assert.equal((await lookupWith(async () => big).playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI')).total, 1234)
})

const failures = [
    ['The playlist does not exist.', 'not-found'],
    ['This playlist is private.', 'not-found'],
    ['Request failed with status code 429', 'unavailable'],
    ['fetch failed', 'unavailable'],
]

for (const [message, code] of failures) {
    test(`youtubei failing with "${message}" is a ${code} error`, async () => {
        const lookup = lookupWith(async () => { throw new Error(message) })
        await assert.rejects(lookup.playlist('PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'), (error) => error instanceof PlaylistLookupError && error.code === code)
    })
}
