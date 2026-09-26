// The play queue: an ordered list of videos plus which one is current.
// Pure — no React, no storage — so the player, the MediaSession handlers and
// the tests all share one definition of "next" and "previous".

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').QueueState} QueueState */

/** @type {QueueState} */
export const initialQueueState = { items: [], index: -1, source: null }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * @param {QueueState} state
 * @param {{ type: 'PLAY_LIST', payload: { videos: Video[], startIndex: number, source: import('../types.js').QueueSource } }
 *   | { type: 'NEXT' } | { type: 'PREV' } | { type: 'CLEAR' }} action
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
            }
        }

        // At either end the same object comes back, so React skips the re-render.
        case 'NEXT':
            return hasNext(state) ? { ...state, index: state.index + 1 } : state

        case 'PREV':
            return hasPrev(state) ? { ...state, index: state.index - 1 } : state

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
export const nextVideo = (state) => (hasNext(state) ? videoAt(state, state.index + 1) : null)

/** @param {QueueState} state */
export const prevVideo = (state) => (hasPrev(state) ? videoAt(state, state.index - 1) : null)

/** @param {QueueState} state */
export const hasNext = (state) => state.index >= 0 && state.index < state.items.length - 1

/** @param {QueueState} state */
export const hasPrev = (state) => state.index > 0

/**
 * 1-based, for "TRK 03/20" style readouts; null when nothing is queued.
 * @param {QueueState} state
 */
export const queuePosition = (state) =>
    state.index < 0 ? null : { current: state.index + 1, total: state.items.length }
