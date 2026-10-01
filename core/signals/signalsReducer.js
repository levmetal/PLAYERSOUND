// What the listener's reactions say about their taste, kept in the browser
// only: skips and likes move tag affinities, skipped tracks and recent plays
// are kept out of the next radio batch. Pure — the caller supplies `at`.

import resolveTrack from '../track/resolveTrack.js'
import { trackKey } from '../discovery/rankCandidates.js'

/** @typedef {import('../types.js').QueueItem} QueueItem */
/** @typedef {{ affinity: Record<string, number>, excluded: string[], history: { id: string, key: string | null, at: number }[] }} Signals */

const SKIP_SECONDS = 30
const SKIP_WEIGHT = -0.2
const FINISH_WEIGHT = 0.05
const LIKE_WEIGHT = 0.2
const MAX_HISTORY = 500
const MAX_EXCLUDED = 200
const MAX_AFFINITY_SENT = 100
// /api/discover rejects more than this many exclusions.
const MAX_EXCLUDE_SENT = 500

/** @type {Signals} */
export const initialSignals = { affinity: {}, excluded: [], history: [] }

const tagsOf = (item) => item.reason?.sharedTags ?? []

function keyOf(item) {
    const track = item.track ?? resolveTrack(item.video)
    return track ? trackKey(track.artist, track.title) : null
}

const clampRound = (value) => Math.round(Math.min(1, Math.max(-1, value)) * 100) / 100

function nudge(affinity, tags, weight) {
    if (!tags.length) return affinity
    const next = { ...affinity }
    for (const tag of tags) {
        const value = clampRound((next[tag] ?? 0) + weight)
        if (value === 0) delete next[tag]
        else next[tag] = value
    }
    return next
}

const appendCapped = (list, entries, max) => [...list.filter((e) => !entries.includes(e)), ...entries].slice(-max)

/**
 * @param {Signals} state
 * @param {{ type: 'LISTENED', payload: { item: QueueItem, seconds: number, finished: boolean, at: number } }
 *   | { type: 'LIKED', payload: { item: QueueItem } }
 *   | { type: 'HYDRATE', payload: Partial<Signals> }} action
 * @returns {Signals}
 */
export default function signalsReducer(state, action) {
    switch (action.type) {
        case 'LISTENED': {
            const { item, seconds, finished, at } = action.payload
            const key = keyOf(item)
            const history = [...state.history, { id: item.video.id, key, at }].slice(-MAX_HISTORY)
            if (finished) return { ...state, affinity: nudge(state.affinity, tagsOf(item), FINISH_WEIGHT), history }
            if (seconds >= SKIP_SECONDS) return { ...state, history }
            return {
                affinity: nudge(state.affinity, tagsOf(item), SKIP_WEIGHT),
                excluded: appendCapped(state.excluded, key ? [key, item.video.id] : [item.video.id], MAX_EXCLUDED),
                history,
            }
        }

        case 'LIKED': {
            const affinity = nudge(state.affinity, tagsOf(action.payload.item), LIKE_WEIGHT)
            return affinity === state.affinity ? state : { ...state, affinity }
        }

        case 'HYDRATE':
            return { ...initialSignals, ...action.payload }

        default:
            return state
    }
}

/**
 * What goes to /api/discover: tracks to leave out and tag preferences.
 * @param {Signals} state
 * @returns {{ exclude: string[], affinity: Record<string, number> }}
 */
export function discoverSignals(state) {
    const fromHistory = state.history.flatMap(({ id, key }) => (key ? [id, key] : [id]))
    const exclude = [...new Set([...state.excluded, ...fromHistory])].slice(-MAX_EXCLUDE_SENT)
    const affinity = Object.fromEntries(
        Object.entries(state.affinity)
            .filter(([, value]) => value !== 0)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, MAX_AFFINITY_SENT)
    )
    return { exclude, affinity }
}
