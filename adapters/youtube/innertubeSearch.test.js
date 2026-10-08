import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createInnertubeSearch } from './innertubeSearch.js'

const recorded = JSON.parse(readFileSync(new URL('./__fixtures__/innertube.search.json', import.meta.url), 'utf8'))
const searchWith = (searchVideos) => createInnertubeSearch({ searchVideos })

test('a recorded artist search becomes Video rows in the search results shape', async () => {
    const asked = []
    const videos = await searchWith(async (term) => { asked.push(term); return recorded.videos }).search('joji')
    assert.deepEqual(asked, ['joji'])
    assert.deepEqual(videos[0], {
        id: 'K3Qzzggn--s',
        title: 'Joji - SLOW DANCING IN THE DARK',
        link: 'https://youtu.be/K3Qzzggn--s',
        thumbnail: 'https://i.ytimg.com/vi/K3Qzzggn--s/hqdefault.jpg',
        channel: { id: 'UCZW5lIUz93q_aZIkJPAC0IQ', name: '88rising', link: 'https://www.youtube.com/@88rising', verified: true, thumbnail: '' },
        description: recorded.videos[0].description_snippet?.text ?? '',
        views: 498019646,
        uploaded: '8y ago',
        duration: 218,
    })
})

test('every recorded video keeps its own id, duration and view count; the channel card is dropped', async () => {
    const videos = await searchWith(async () => recorded.videos).search('joji')
    assert.equal(videos.length, 8)
    assert.deepEqual(videos.map((video) => [video.id, video.duration, video.views]), [
        ['K3Qzzggn--s', 218, 498019646], ['FvOpPeKSf_4', 234, 222062300], ['acA8Rr3gEco', 167, 17816398], ['kIEWJ1ljEro', 212, 108791710],
        ['YWN81V7ojOE', 192, 122396365], ['AeO81mfRook', 111, 8824743], ['LUXu4aTnK7E', 210, 47897459], ['Bv-1BnoB75k', 241, 82059206],
    ])
})

test('a video without a publish date has an empty uploaded text', async () => {
    const videos = await searchWith(async () => recorded.videos).search('joji')
    assert.equal(videos.find((video) => video.id === 'LUXu4aTnK7E').uploaded, '')
})

test('a video with no duration or view count (live, upcoming) gets 0 for them', async () => {
    const live = { type: 'Video', video_id: 'live1234567', title: { text: 'A live stream' }, author: { id: 'UC1', name: 'Someone', url: '', is_verified: false } }
    const [video] = await searchWith(async () => [live]).search('live')
    assert.equal(video.duration, 0)
    assert.equal(video.views, 0)
})

test('nodes without an id or a title are dropped', async () => {
    const nodes = [{ type: 'Video', title: { text: 'No id' } }, { type: 'Video', video_id: 'abcdefghijk' }, recorded.videos[0]]
    const videos = await searchWith(async () => nodes).search('joji')
    assert.deepEqual(videos.map((video) => video.id), ['K3Qzzggn--s'])
})

test('a client failure propagates', async () => {
    await assert.rejects(() => searchWith(async () => { throw new Error('refused') }).search('joji'), /refused/)
})
