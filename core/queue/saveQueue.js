// Turning the play queue into a saved playlist. Pure: the context dispatches
// the actual CREATE_PLAYLIST.

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').QueueState} QueueState */
/** @typedef {import('../types.js').QueueSource} QueueSource */

const DEFAULT_NAME = 'My queue'
const MAX_NAME = 60
const SHUFFLED_SUFFIX = ' · shuffled'

/**
 * The tracks the listener chose, in queue order — played ones and the
 * playing one included, autoplay's suggestions left out, repeats once.
 * @param {Pick<QueueState, 'items'>} state
 * @returns {Video[]}
 */
export function savableTracks(state) {
    const seen = new Set()
    const tracks = []
    for (const { video, origin } of state.items) {
        if (origin !== 'user' || seen.has(video.id)) continue
        seen.add(video.id)
        tracks.push(video)
    }
    return tracks
}

/**
 * A starting name for the playlist: what the queue was started from, when
 * that reads like a name (a search, a playlist) and not like a song title.
 * @param {QueueSource | null | undefined} source
 */
export function defaultPlaylistName(source) {
    if (source?.type !== 'search' && source?.type !== 'playlist') return DEFAULT_NAME
    let label = String(source.label ?? '').trim()
    if (label.endsWith(SHUFFLED_SUFFIX)) label = label.slice(0, -SHUFFLED_SUFFIX.length).trim()
    return label ? label.slice(0, MAX_NAME) : DEFAULT_NAME
}
