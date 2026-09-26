// Playlists: an array of { id, name, tracks }, always starting with
// Favorites. Pure — new playlist ids come in with the action, so the reducer
// never generates randomness itself.

/** @typedef {import('../types.js').Video} Video */
/** @typedef {{ id: string, name: string, tracks: Video[] }} Playlist */

export const FAVORITES_ID = 'favorites'

/** @type {Playlist[]} */
export const defaultPlaylists = [{ id: FAVORITES_ID, name: 'Favorites', tracks: [] }]

function addTrack(state, playlistId, track) {
    return state.map((playlist) =>
        playlist.id === playlistId && !playlist.tracks.some((t) => t.id === track.id)
            ? { ...playlist, tracks: [...playlist.tracks, track] }
            : playlist
    )
}

function removeTrack(state, playlistId, trackId) {
    return state.map((playlist) =>
        playlist.id === playlistId
            ? { ...playlist, tracks: playlist.tracks.filter((t) => t.id !== trackId) }
            : playlist
    )
}

/**
 * @param {Playlist[]} state
 * @param {{ type: string, payload?: any }} action
 * @returns {Playlist[]}
 */
export default function libraryReducer(state, action) {
    switch (action.type) {
        case 'HYDRATE':
            return action.payload

        case 'ADD_TO_FAVORITES':
            return addTrack(state, FAVORITES_ID, action.payload)

        case 'REMOVE_FROM_FAVORITES':
            return removeTrack(state, FAVORITES_ID, action.payload)

        case 'ADD_TO_PLAYLIST':
            return addTrack(state, action.payload.playlistId, action.payload.track)

        case 'REMOVE_FROM_PLAYLIST':
            return removeTrack(state, action.payload.playlistId, action.payload.trackId)

        case 'CREATE_PLAYLIST': {
            const { id, name, track } = action.payload
            return [...state, { id, name, tracks: track ? [track] : [] }]
        }

        case 'DELETE_PLAYLIST':
            if (action.payload === FAVORITES_ID) return state
            return state.filter((playlist) => playlist.id !== action.payload)

        default:
            return state
    }
}
