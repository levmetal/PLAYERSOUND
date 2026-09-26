// What radio should fetch next, and small helpers around it. Pure: the
// caller passes `now` and does the requests (hooks/useRadio.js).

import { trackKey } from '../discovery/rankCandidates.js'

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').QueueState} QueueState */

// Refill once this few playable tracks are left after the current one.
const REFILL_AT = 2
const RESOLVE_BATCH = 10
const RESOLVE_COUNT = 3
// /api/discover accepts up to 500 exclude entries.
const MAX_EXCLUDE = 500

function playableAhead(state) {
    let count = 0
    for (let i = state.index + 1; i < state.items.length; i++) {
        if (!state.unplayable.includes(state.items[i].video.id)) count++
    }
    return count
}

// The listener's signals first, then everything queued or found unplayable,
// plus the radio tracks by name (the same song may come back as a different
// upload). Capped from the front, so old history goes before the queue does.
function excludeFor(state, signalsExclude) {
    const entries = []
    for (const item of state.items) {
        entries.push(item.video.id)
        if (item.origin === 'radio') entries.push(trackKey(item.track.artist, item.track.title))
    }
    const queued = new Set([...entries, ...state.unplayable])
    return [...signalsExclude.filter((entry) => !queued.has(entry)), ...queued].slice(-MAX_EXCLUDE)
}

function lastUserVideo(state) {
    for (let i = state.items.length - 1; i >= 0; i--) {
        if (state.items[i].origin === 'user') return state.items[i].video
    }
    return null
}

/**
 * @param {QueueState} state
 * @param {number} now
 * @param {{ exclude: string[], affinity: Record<string, number> }} [signals]  from core/signals
 * @returns {null | { kind: 'resolve', candidates: any[], count: number, exclude: string[], generation: number }
 *   | { kind: 'discover', seeds: Video[], exclude: string[], affinity: Record<string, number>, generation: number }}
 */
export function radioRequest(state, now, signals = { exclude: [], affinity: {} }) {
    const { radio } = state
    if (state.index < 0 || !radio.enabled || radio.loading || radio.status !== 'idle') return null
    if (radio.retryAt !== null && now < radio.retryAt) return null
    if (playableAhead(state) > REFILL_AT) return null

    const exclude = excludeFor(state, signals.exclude)
    const { generation } = state
    if (radio.pending.length) {
        return { kind: 'resolve', candidates: radio.pending.slice(0, RESOLVE_BATCH), count: RESOLVE_COUNT, exclude, generation }
    }
    const seeds = radio.seeds.length ? radio.seeds : [lastUserVideo(state)].filter(Boolean)
    if (!seeds.length) return null
    return { kind: 'discover', seeds, exclude, affinity: signals.affinity, generation }
}

/**
 * The seed title when playback just moved from the user's own picks into
 * radio's (their queue ran out), else null.
 * @param {QueueState} before
 * @param {QueueState} after
 */
export function radioHandoff(before, after) {
    const was = before.items[before.index]
    const is = after.items[after.index]
    if (after.source?.type === 'radio') return null
    if (was?.origin !== 'user' || is?.origin !== 'radio') return null
    return is.reason?.seed ?? after.source?.label ?? null
}

/**
 * `n` tracks spread evenly over a playlist, first and last included.
 * @template T
 * @param {T[]} tracks
 * @param {number} [n]
 * @returns {T[]}
 */
export function pickSeeds(tracks, n = 5) {
    if (tracks.length <= n) return [...tracks]
    return Array.from({ length: n }, (_, i) => tracks[Math.round((i * (tracks.length - 1)) / (n - 1))])
}
