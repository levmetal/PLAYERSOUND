// The play queue: an ordered list of videos plus which one is current.
// Pure — no React, no storage — so the player, the MediaSession handlers and
// the tests all share one definition of "next" and "previous".
//
// Tracks that turn out to be unplayable (embedding disabled, removed) are
// remembered for the life of the queue, and next/previous step over them.
// A failed track is skipped in the direction the queue was last moving, so
// pressing ⏮ onto a broken track keeps going back instead of bouncing the
// listener forward to where they started.

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').QueueState} QueueState */

/** @type {QueueState} */
export const initialQueueState = { items: [], index: -1, source: null, direction: 1, unplayable: [] }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const isPlayable = (state, index) => !state.unplayable.includes(state.items[index].video.id)

// Nearest playable index from `index` (exclusive) stepping by `step`, or -1.
function playableFrom(state, index, step) {
    for (let i = index + step; i >= 0 && i < state.items.length; i += step) {
        if (isPlayable(state, i)) return i
    }
    return -1
}

const nextIndex = (state) => (state.index < 0 ? -1 : playableFrom(state, state.index, 1))
const prevIndex = (state) => (state.index < 0 ? -1 : playableFrom(state, state.index, -1))

/**
 * @param {QueueState} state
 * @param {{ type: 'PLAY_LIST', payload: { videos: Video[], startIndex: number, source: import('../types.js').QueueSource } }
 *   | { type: 'NEXT' } | { type: 'PREV' } | { type: 'CLEAR' }
 *   | { type: 'SKIP_UNPLAYABLE', payload: { videoId: string } }} action
 * @returns {QueueState}
 */
export default function queueReducer(state, action) {
    switch (action.type) {
        case 'PLAY_LIST': {
            const { videos, startIndex, source } = action.payload
            if (!videos.length) return initialQueueState
            return {
                items: videos.map((video) => ({ video, origin: 'user' })),
                index: clamp(startIndex, 0, videos.length - 1),
                source,
                direction: 1,
                unplayable: [],
            }
        }

        // At either end the same object comes back, so React skips the re-render.
        case 'NEXT': {
            const index = nextIndex(state)
            return index < 0 ? state : { ...state, index, direction: 1 }
        }

        case 'PREV': {
            const index = prevIndex(state)
            return index < 0 ? state : { ...state, index, direction: -1 }
        }

        case 'SKIP_UNPLAYABLE': {
            if (currentVideo(state)?.id !== action.payload.videoId) return state
            const marked = { ...state, unplayable: [...state.unplayable, action.payload.videoId] }
            const ahead = playableFrom(marked, marked.index, marked.direction)
            if (ahead >= 0) return { ...marked, index: ahead }
            const behind = playableFrom(marked, marked.index, -marked.direction)
            if (behind >= 0) return { ...marked, index: behind, direction: -marked.direction }
            return marked
        }

        case 'CLEAR':
            return initialQueueState

        default:
            return state
    }
}

const videoAt = (state, index) => state.items[index]?.video ?? null

/** @param {QueueState} state */
export const currentVideo = (state) => videoAt(state, state.index)

/** @param {QueueState} state */
export const nextVideo = (state) => videoAt(state, nextIndex(state))

/** @param {QueueState} state */
export const prevVideo = (state) => videoAt(state, prevIndex(state))

/** @param {QueueState} state */
export const hasNext = (state) => nextIndex(state) >= 0

/** @param {QueueState} state */
export const hasPrev = (state) => prevIndex(state) >= 0

/**
 * 1-based, for "TRK 03/20" style readouts; null when nothing is queued.
 * @param {QueueState} state
 */
export const queuePosition = (state) =>
    state.index < 0 ? null : { current: state.index + 1, total: state.items.length }
