// Use case behind /api/playlist/[id]: check the id looks like a playlist
// that can be read without an account (not Watch later / Liked videos)
// before anything is asked of YouTube, then ask the PlaylistLookup port.

const PLAYLIST_ID = /^[\w-]{10,64}$/

export class InvalidPlaylistIdError extends Error {
    constructor() {
        super('That is not a readable YouTube playlist id.')
        this.name = 'InvalidPlaylistIdError'
        this.code = 'invalid-id'
    }
}

/**
 * @param {{ playlistLookup: { playlist: (id: string) => Promise<{ title: string, author: string, total: number, videos: any[] }> } }} deps
 */
export function createLookupPlaylistService({ playlistLookup }) {
    return {
        /** @param {string} id */
        async playlist(id) {
            if (typeof id !== 'string' || !PLAYLIST_ID.test(id)) throw new InvalidPlaylistIdError()
            return { id, ...(await playlistLookup.playlist(id)) }
        },
    }
}
