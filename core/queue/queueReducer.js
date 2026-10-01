// The play queue: an ordered list of videos plus which one is current.
// Pure — no React, no storage — so the player, the MediaSession handlers and
// the tests all share one definition of "next" and "previous".
//
// Tracks that turn out to be unplayable (embedding disabled, removed) are
// remembered for the life of the queue, and next/previous step over them.
// A failed track is skipped in the direction the queue was last moving, so
// pressing ⏮ onto a broken track keeps going back instead of bouncing the
// listener forward to where they started.
//
// Radio appends suggested tracks after the user's own picks. The requests
// themselves happen outside (see radio.js for what to ask next); results come
// back tagged with the `generation` they were asked for, and anything
// answering an older queue is dropped.

import { trackKey } from '../discovery/rankCandidates.js'

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').QueueState} QueueState */
/** @typedef {import('../types.js').RadioCandidate} RadioCandidate */

// After a failed radio request (network, 5xx), wait this long before asking again.
const RETRY_MS = 30000

/** @type {QueueState['radio']} */
const initialRadio = {
    enabled: true, seeds: [], tags: [], pending: [], loading: false, status: 'idle', retryAt: null, seedTags: {},
}

/** @type {QueueState} */
export const initialQueueState = {
    items: [], index: -1, source: null, direction: 1, unplayable: [], generation: 0, radio: initialRadio,
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// A new queue: the radio setting is the listener's, the generation keeps counting.
const freshQueue = (state, fields) => ({
    ...initialQueueState,
    generation: state.generation + 1,
    radio: { ...initialRadio, enabled: state.radio.enabled },
    ...fields,
})

const isPlayable = (state, index) => !state.unplayable.includes(state.items[index].video.id)

// Nearest playable index from `index` (exclusive) stepping by `step`, or -1.
function playableFrom(state, index, step) {
    for (let i = index + step; i >= 0 && i < state.items.length; i += step) {
        if (isPlayable(state, i)) return i
    }
    return -1
}

// Adds `video` as the user's pick at the index `at(state)` returns, moving it
// there if it's already queued. The current track never moves.
function addPick(state, video, at) {
    if (state.index < 0) {
        return freshQueue(state, { items: [{ video, origin: 'user' }], index: 0, source: { type: 'track', label: video.title } })
    }
    if (currentVideo(state).id === video.id) return state
    const existing = state.items.findIndex((item) => item.video.id === video.id)
    const items = state.items.filter((_, i) => i !== existing)
    const index = existing >= 0 && existing < state.index ? state.index - 1 : state.index
    const rest = { ...state, items, index }
    const position = at(rest)
    // Without explicit seeds the last pick seeds radio, so a new pick is worth another try.
    const retry = !state.radio.seeds.length && (state.radio.status === 'exhausted' || state.radio.status === 'unidentified')
    return {
        ...rest,
        items: [...items.slice(0, position), { video, origin: 'user' }, ...items.slice(position)],
        unplayable: state.unplayable.filter((id) => id !== video.id),
        radio: retry ? { ...state.radio, status: 'idle' } : state.radio,
    }
}

const afterCurrent = (state) => state.index + 1

// After the last pick of the user's, so their picks always come before radio's.
function afterUserPicks(state) {
    let last = state.index
    state.items.forEach((item, i) => { if (item.origin === 'user' && i > last) last = i })
    return last + 1
}

// Radio items for the candidates that have a video not already queued or
// known unplayable; the ones without a video are returned as `waiting`.
function splitCandidates(state, candidates) {
    const taken = new Set([...state.items.map((item) => item.video.id), ...state.unplayable])
    const items = []
    const waiting = []
    for (const candidate of candidates) {
        if (!candidate.video) {
            waiting.push(candidate)
        } else if (!taken.has(candidate.video.id)) {
            taken.add(candidate.video.id)
            items.push({
                video: candidate.video,
                origin: 'radio',
                reason: candidate.reason,
                track: { artist: candidate.artist, title: candidate.title },
            })
        }
    }
    return { items, waiting }
}

const retryAtFor = (retryAfter, now) => (retryAfter ? now + retryAfter * 1000 : null)

// Radio results only apply to the queue they were asked for.
const isStale = (state, payload) => state.index < 0 || payload.generation !== state.generation

const nextIndex = (state) => (state.index < 0 ? -1 : playableFrom(state, state.index, 1))
const prevIndex = (state) => (state.index < 0 ? -1 : playableFrom(state, state.index, -1))

/**
 * @param {QueueState} state
 * @param {{ type: 'PLAY_LIST', payload: { videos: Video[], startIndex: number, source: import('../types.js').QueueSource } }
 *   | { type: 'NEXT' } | { type: 'PREV' } | { type: 'CLEAR' }
 *   | { type: 'SKIP_UNPLAYABLE', payload: { videoId: string } }
 *   | { type: 'PLAY_NEXT' | 'ENQUEUE', payload: { video: Video } }
 *   | { type: 'START_RADIO', payload: { seeds: Video[], label: string } }
 *   | { type: 'AUTOPLAY_VIBE', payload: { tag: string } }
 *   | { type: 'JUMP_TO', payload: { index: number } }
 *   | { type: 'SET_RADIO', payload: { enabled: boolean } }
 *   | { type: 'RADIO_REQUESTED', payload: { generation: number } }
 *   | { type: 'RADIO_BATCH', payload: { generation: number, status: 'ok' | 'unidentified', candidates: RadioCandidate[], retryAfter?: number, now: number, seedTags?: Record<string, string[]> } }
 *   | { type: 'RADIO_RESOLVED', payload: { generation: number, requested: RadioCandidate[], candidates: RadioCandidate[], retryAfter?: number, now: number } }
 *   | { type: 'RADIO_FAILED', payload: { generation: number, now: number, unavailable?: boolean } }} action
 * @returns {QueueState}
 */
export default function queueReducer(state, action) {
    switch (action.type) {
        case 'PLAY_LIST': {
            const { videos, startIndex, source } = action.payload
            if (!videos.length) return freshQueue(state)
            return freshQueue(state, {
                items: videos.map((video) => ({ video, origin: 'user' })),
                index: clamp(startIndex, 0, videos.length - 1),
                source,
            })
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

        case 'JUMP_TO': {
            const { index } = action.payload
            if (index === state.index || index < 0 || index >= state.items.length) return state
            return { ...state, index, direction: 1 }
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

        case 'PLAY_NEXT':
            return addPick(state, action.payload.video, afterCurrent)

        case 'ENQUEUE':
            return addPick(state, action.payload.video, afterUserPicks)

        case 'START_RADIO': {
            const { seeds, label } = action.payload
            if (!seeds.length) return state
            return freshQueue(state, {
                items: [{ video: seeds[0], origin: 'user' }],
                index: 0,
                source: { type: 'radio', label },
                radio: { ...initialRadio, enabled: true, seeds: [...seeds] },
            })
        }

        // Autoplay follows a vibe from now on. The listener's own queue stays;
        // only the suggestions ahead (made for the old target) go.
        case 'AUTOPLAY_VIBE': {
            if (state.index < 0) return state
            return {
                ...state,
                items: state.items.filter((item, i) => i <= state.index || item.origin !== 'radio'),
                generation: state.generation + 1,
                radio: {
                    ...state.radio,
                    enabled: true,
                    seeds: [],
                    tags: [action.payload.tag],
                    pending: [],
                    loading: false,
                    status: 'idle',
                    retryAt: null,
                },
            }
        }

        case 'SET_RADIO': {
            const { enabled } = action.payload
            if (enabled === state.radio.enabled) return state
            if (enabled) return { ...state, radio: { ...state.radio, enabled } }
            // Off: what's playing stays, the suggestions ahead of it go.
            return {
                ...state,
                items: state.items.filter((item, i) => i <= state.index || item.origin !== 'radio'),
                generation: state.generation + 1,
                radio: { ...state.radio, enabled, pending: [], loading: false, retryAt: null },
            }
        }

        case 'RADIO_REQUESTED':
            if (isStale(state, action.payload)) return state
            return { ...state, radio: { ...state.radio, loading: true } }

        case 'RADIO_BATCH': {
            if (isStale(state, action.payload)) return state
            const { status, candidates, retryAfter, now, seedTags } = action.payload
            if (status === 'unidentified') {
                return { ...state, radio: { ...state.radio, loading: false, status: 'unidentified' } }
            }
            const { items, waiting } = splitCandidates(state, candidates)
            const empty = !items.length && !waiting.length && !retryAfter
            return {
                ...state,
                items: [...state.items, ...items],
                radio: {
                    ...state.radio,
                    pending: [...state.radio.pending, ...waiting],
                    loading: false,
                    status: empty ? 'exhausted' : 'idle',
                    retryAt: retryAtFor(retryAfter, now),
                    seedTags: seedTags ? { ...state.radio.seedTags, ...seedTags } : state.radio.seedTags,
                },
            }
        }

        // Asked candidates that came back without a video either failed (dropped
        // by the server) or weren't tried yet (rate-limited): the latter return
        // to the front of the line.
        case 'RADIO_RESOLVED': {
            if (isStale(state, action.payload)) return state
            const { requested, candidates, retryAfter, now } = action.payload
            const asked = new Set(requested.map((c) => trackKey(c.artist, c.title)))
            const { items, waiting } = splitCandidates(state, candidates)
            return {
                ...state,
                items: [...state.items, ...items],
                radio: {
                    ...state.radio,
                    pending: [...waiting, ...state.radio.pending.filter((c) => !asked.has(trackKey(c.artist, c.title)))],
                    loading: false,
                    retryAt: retryAtFor(retryAfter, now),
                },
            }
        }

        case 'RADIO_FAILED': {
            if (isStale(state, action.payload)) return state
            const { now, unavailable } = action.payload
            return {
                ...state,
                radio: unavailable
                    ? { ...state.radio, loading: false, status: 'unavailable' }
                    : { ...state.radio, loading: false, retryAt: now + RETRY_MS },
            }
        }

        case 'CLEAR':
            return freshQueue(state)

        default:
            return state
    }
}

const videoAt = (state, index) => state.items[index]?.video ?? null

/** @param {QueueState} state */
export const currentVideo = (state) => videoAt(state, state.index)

/** @param {QueueState} state */
export const currentItem = (state) => state.items[state.index] ?? null

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
