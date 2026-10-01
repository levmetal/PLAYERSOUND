// What radio should fetch next, and small helpers around it. Pure: the
// caller passes `now` and does the requests (hooks/useRadio.js).

import { trackKey } from '../discovery/rankCandidates.js'
import resolveTrack from '../track/resolveTrack.js'

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
 *   | { kind: 'discover', seeds: Video[], tags: string[], exclude: string[], affinity: Record<string, number>, generation: number }}
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
    if (radio.tags.length) {
        return { kind: 'discover', seeds: [], tags: radio.tags, exclude, affinity: signals.affinity, generation }
    }
    const seeds = radio.seeds.length ? radio.seeds : [lastUserVideo(state)].filter(Boolean)
    if (!seeds.length) return null
    return { kind: 'discover', seeds, tags: [], exclude, affinity: signals.affinity, generation }
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
    if (after.source?.type === 'radio' || after.source?.type === 'tag') return null
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

const MAX_WAITING_SHOWN = 5

/**
 * The playable items after the current one, split by who chose them, with
 * their queue index (for JUMP_TO); plus the suggestions still waiting for a
 * video, so a rate limit never looks like "nothing found".
 * @param {QueueState} state
 * @param {number} [now]
 */
export function upNext(state, now = 0) {
    const user = []
    const radio = []
    for (let index = state.index + 1; index < state.items.length; index++) {
        const item = state.items[index]
        if (state.unplayable.includes(item.video.id)) continue
        ;(item.origin === 'radio' ? radio : user).push({ item, index })
    }
    const { retryAt, pending } = state.radio
    const waitMinutes = retryAt !== null && retryAt > now ? Math.ceil((retryAt - now) / 60000) : null
    return { user, radio, waiting: pending.slice(0, MAX_WAITING_SHOWN), waitMinutes }
}

/**
 * Tags to show for the current track: a radio item's shared tags, or the
 * ones Last.fm gave the track radio was seeded from.
 * @param {QueueState} state
 * @returns {string[]}
 */
export function currentTags(state) {
    const item = state.items[state.index]
    if (!item) return []
    if (item.origin === 'radio') return item.reason?.sharedTags ?? []
    return state.radio.seedTags[item.video.id] ?? []
}

/**
 * What autoplay will follow, for the Up next divider; null with nothing queued.
 * @param {QueueState} state
 * @returns {string | null}
 */
export function autoplayTarget(state) {
    if (state.index < 0) return null
    const { radio } = state
    if (radio.tags.length) return `Vibe: ${radio.tags[0]}`
    if (radio.seeds.length > 1) return `Like the playlist "${state.source?.label ?? ''}"`
    const seed = radio.seeds[0] ?? lastUserVideo(state)
    if (!seed) return null
    return `Like "${resolveTrack(seed)?.title ?? seed.title}"`
}
