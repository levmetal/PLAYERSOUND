import { test } from 'node:test'
import assert from 'node:assert/strict'
import parseYoutubeLink from './parseYoutubeLink.js'

const ID = 'FTQbiNvZqaY'
const LIST = 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'

const videos = [
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&t=42s`,
    `https://youtu.be/${ID}?si=abc`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/watch?v=${ID}&list=${LIST}`,
    `  https://youtu.be/${ID}  `,
]

for (const text of videos) {
    test(`"${text.trim()}" is the video ${ID}`, () => {
        assert.deepEqual(parseYoutubeLink(text), { kind: 'video', id: ID })
    })
}

test('a playlist link is the playlist', () => {
    assert.deepEqual(parseYoutubeLink(`https://www.youtube.com/playlist?list=${LIST}`), { kind: 'playlist', id: LIST })
})

const searches = [
    ID,
    'daft punk',
    '',
    '   ',
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://evil.com/?u=https://www.youtube.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/',
    'https://www.youtube.com/channel/UCu4bj03KW4CwAsYtHSwMEsQ',
    'https://www.youtube.com/playlist?list=WL',
    'https://www.youtube.com/playlist?list=LL',
]

for (const text of searches) {
    test(`"${text}" is not a link, so it stays a search`, () => {
        assert.equal(parseYoutubeLink(text), null)
    })
}

test('anything that is not a string is not a link', () => {
    for (const bad of [undefined, null, 42, {}]) assert.equal(parseYoutubeLink(bad), null)
})
