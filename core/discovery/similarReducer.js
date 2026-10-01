// "Similar vibe": the list of tracks like the one playing (or like a tag the
// listener tapped), shown whatever Autoplay is set to. Pure — the context
// does the fetching; this only says what's on screen and what to ask next.
//
// The lists come from Last.fm alone (no YouTube search per track): a row's
// video is found only when the listener clicks it (CANDIDATE_*).

import resolveTrack from '../track/resolveTrack.js'

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').RadioCandidate} RadioCandidate */

const LIST_LIMIT = 12
const MAX_EXCLUDE = 500
// Lists are kept for the session so going back to a track is instant.
const MAX_LISTS = 50

export const initialSimilar = {
    trackId: null, browseTag: null, lists: {}, tags: {}, resolving: {}, videos: {}, unavailable: false,
}

const trackKey = (videoId) => `track:${videoId}`
const tagKey = (tag) => `tag:${tag}`
const onScreenKey = (state) => (state.browseTag ? tagKey(state.browseTag) : state.trackId ? trackKey(state.trackId) : null)

function withList(state, key, list) {
    const lists = { ...state.lists }
    delete lists[key] // re-inserted last, so it's the newest
    lists[key] = list
    const keys = Object.keys(lists)
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_LISTS))) delete lists[old]
    return { ...state, lists }
}

/**
 * @param {typeof initialSimilar} state
 * @param {{ type: 'TRACK_CHANGED', payload: { videoId: string } }
 *   | { type: 'BROWSE', payload: { tag: string } }
 *   | { type: 'LIST_REQUESTED' | 'LIST_UNIDENTIFIED', payload: { key: string } }
 *   | { type: 'LIST_LOADED', payload: { key: string, candidates: RadioCandidate[], tags?: string[] } }
 *   | { type: 'LIST_FAILED', payload: { key: string, unavailable?: boolean } }
 *   | { type: 'CANDIDATE_RESOLVING', payload: { id: string } }
 *   | { type: 'CANDIDATE_RESOLVED', payload: { id: string, video: Video } }
 *   | { type: 'CANDIDATE_FAILED', payload: { id: string, limited?: boolean } }} action
 */
export default function similarReducer(state, action) {
    switch (action.type) {
        case 'TRACK_CHANGED':
            if (state.trackId === action.payload.videoId) return state
            return { ...state, trackId: action.payload.videoId, browseTag: null }

        case 'BROWSE':
            return { ...state, browseTag: state.browseTag === action.payload.tag ? null : action.payload.tag }

        case 'LIST_REQUESTED': {
            const { key } = action.payload
            const status = state.lists[key]?.status
            if (status && status !== 'error') return state
            return withList(state, key, { status: 'loading', candidates: [] })
        }

        case 'LIST_LOADED': {
            const { key, candidates, tags } = action.payload
            const next = withList(state, key, { status: 'done', candidates })
            if (!tags || !key.startsWith('track:')) return next
            return { ...next, tags: { ...next.tags, [key.slice('track:'.length)]: tags } }
        }

        case 'LIST_UNIDENTIFIED':
            return withList(state, action.payload.key, { status: 'unidentified', candidates: [] })

        case 'LIST_FAILED':
            if (action.payload.unavailable) return { ...state, unavailable: true }
            return withList(state, action.payload.key, { status: 'error', candidates: [] })

        case 'CANDIDATE_RESOLVING':
            return { ...state, resolving: { ...state.resolving, [action.payload.id]: 'loading' } }

        case 'CANDIDATE_RESOLVED': {
            const { [action.payload.id]: _done, ...resolving } = state.resolving
            return { ...state, resolving, videos: { ...state.videos, [action.payload.id]: action.payload.video } }
        }

        case 'CANDIDATE_FAILED':
            return { ...state, resolving: { ...state.resolving, [action.payload.id]: action.payload.limited ? 'limited' : 'none' } }

        default:
            return state
    }
}

// One identity for a candidate, same as exclusions elsewhere.
const candidateId = (candidate) => `${candidate.artist}|${candidate.title}`.toLowerCase().trim()

/**
 * What the Similar vibe block shows right now.
 * @param {typeof initialSimilar} state
 * @returns {{ key: string | null, kind: 'track' | 'tag', tag: string | null,
 *   status: 'loading' | 'done' | 'error' | 'unidentified' | 'unavailable',
 *   candidates: (RadioCandidate & { id: string, resolving: null | 'loading' | 'none' | 'limited' })[] }}
 */
export function viewList(state) {
    const key = onScreenKey(state)
    const list = key ? state.lists[key] : undefined
    const status = state.unavailable ? 'unavailable' : (list?.status ?? 'loading')
    const candidates = (list?.candidates ?? []).map((candidate) => {
        const id = candidateId(candidate)
        return { ...candidate, id, video: candidate.video ?? state.videos[id] ?? null, resolving: state.resolving[id] ?? null }
    })
    return { key, kind: state.browseTag ? 'tag' : 'track', tag: state.browseTag, status, candidates }
}

/** @param {typeof initialSimilar} state */
export const vibeTags = (state) => (state.trackId ? state.tags[state.trackId] ?? [] : [])

/**
 * What to fetch for the list on screen, or null. `video` is the playing track.
 * @param {typeof initialSimilar} state
 * @param {Video | null} video
 * @param {{ exclude: string[], affinity: Record<string, number> }} signals
 * @returns {null | { kind: 'unidentified', key: string }
 *   | { kind: 'fetch', key: string, body: Record<string, unknown> }}
 */
export function similarRequest(state, video, signals) {
    const key = onScreenKey(state)
    if (!key || state.unavailable) return null
    const status = state.lists[key]?.status
    if (status && status !== 'error') return null

    const common = { exclude: signals.exclude.slice(-MAX_EXCLUDE), affinity: signals.affinity, limit: LIST_LIMIT, resolve: 0 }
    if (state.browseTag) return { kind: 'fetch', key, body: { tags: [state.browseTag], ...common } }
    if (!video || resolveTrack(video) === null) return { kind: 'unidentified', key }
    return { kind: 'fetch', key, body: { seeds: [video], ...common } }
}
