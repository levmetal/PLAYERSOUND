import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLookupPlaylistService, InvalidPlaylistIdError } from './lookupPlaylist.js'

const LIST = 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'
const playlist = { title: 'Popular Music Videos', author: 'Music', total: 183, videos: [] }

const fakeLookup = () => {
    const ids = []
    return { ids, playlist: async (id) => { ids.push(id); return playlist } }
}

test('looks the id up and returns the playlist with its id', async () => {
    const playlistLookup = fakeLookup()
    const service = createLookupPlaylistService({ playlistLookup })
    assert.deepEqual(await service.playlist(LIST), { id: LIST, ...playlist })
    assert.deepEqual(playlistLookup.ids, [LIST])
})

test('ids that are not a readable playlist are rejected without asking YouTube', async () => {
    const playlistLookup = fakeLookup()
    const service = createLookupPlaylistService({ playlistLookup })
    for (const bad of ['', 'short', 'WL', 'LL', `${LIST}/../x`, 'PL bad id with spaces', 'x'.repeat(65), undefined, 7]) {
        await assert.rejects(service.playlist(bad), (error) => error instanceof InvalidPlaylistIdError && error.code === 'invalid-id')
    }
    assert.deepEqual(playlistLookup.ids, [])
})

test('an adapter failure propagates with its own code', async () => {
    const failure = Object.assign(new Error('gone'), { code: 'not-found' })
    const service = createLookupPlaylistService({ playlistLookup: { playlist: async () => { throw failure } } })
    await assert.rejects(service.playlist(LIST), failure)
})
