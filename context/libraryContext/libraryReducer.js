import { v4 as uuidv4 } from 'uuid'

export const FAVORITES_ID = 'favorites'

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

export default function playlistReducer(state, action) {
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
            const { name, track } = action.payload
            return [...state, { id: uuidv4(), name, tracks: track ? [track] : [] }]
        }

        case 'DELETE_PLAYLIST':
            return state.filter((playlist) => playlist.id !== action.payload)

        default:
            return state
    }
}
