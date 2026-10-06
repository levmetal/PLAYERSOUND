// Where the listener left a long track (a live set, a podcast), so it picks up
// there next time. Songs always start at the top and are never saved. Pure —
// the caller supplies `at` / `now`.

/** @typedef {import('../types.js').Video} Video */
/** @typedef {{ video: Video, seconds: number, at: number }} PositionEntry */
/** @typedef {{ entries: PositionEntry[] }} Positions */

const LONG_SECONDS = 600
// Nothing worth resuming this close to either end.
const MIN_SECONDS = 60
const END_MARGIN_SECONDS = 30
// Resume a little earlier, so the last sentence heard isn't cut.
const REWIND_SECONDS = 5
const SAVE_EVERY_SECONDS = 15
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_ENTRIES = 200

/** @type {Positions} */
export const initialPositions = { entries: [] }

/** @param {Video} video */
export const isLong = (video) => (video?.duration ?? 0) >= LONG_SECONDS

const isValid = (entry) =>
    Boolean(entry?.video?.id) && Number.isFinite(entry.seconds) && Number.isFinite(entry.at)

const without = (entries, videoId) => entries.filter((entry) => entry.video.id !== videoId)

/**
 * @param {Positions} state
 * @param {{ type: 'SAVE', payload: { video: Video, seconds: number, at: number } }
 *   | { type: 'FORGET', payload: { videoId: string } }
 *   | { type: 'HYDRATE', payload: { stored: unknown, now: number } }} action
 * @returns {Positions}
 */
export default function positionsReducer(state, action) {
    switch (action.type) {
        case 'SAVE': {
            const { video, seconds, at } = action.payload
            if (!isLong(video)) return state
            const rest = without(state.entries, video.id)
            if (seconds < MIN_SECONDS || seconds >= video.duration - END_MARGIN_SECONDS) {
                return rest.length === state.entries.length ? state : { entries: rest }
            }
            return { entries: [...rest, { video, seconds, at }].slice(-MAX_ENTRIES) }
        }

        case 'FORGET': {
            const rest = without(state.entries, action.payload.videoId)
            return rest.length === state.entries.length ? state : { entries: rest }
        }

        case 'HYDRATE': {
            const { stored, now } = action.payload
            if (stored?.version !== 1 || !Array.isArray(stored.entries)) return initialPositions
            return {
                entries: stored.entries
                    .filter((entry) => isValid(entry) && now - entry.at <= MAX_AGE_MS)
                    .slice(-MAX_ENTRIES),
            }
        }

        default:
            return state
    }
}

/**
 * The second a track should start at: 0 unless it's long and was left part-way
 * within the last 30 days.
 * @param {Positions} state
 * @param {Video} video
 * @param {number} now
 */
export function resumeAt(state, video, now) {
    if (!isLong(video)) return 0
    const entry = state.entries.find((e) => e.video.id === video.id)
    if (!entry || now - entry.at > MAX_AGE_MS) return 0
    return Math.max(0, entry.seconds - REWIND_SECONDS)
}

/** Whether the position has moved far enough (either way) since the last save. */
export const dueForSave = (lastSaved, seconds) => Math.abs(seconds - lastSaved) >= SAVE_EVERY_SECONDS

/** What goes into IndexedDB. */
export const toStored = (state) => ({ version: 1, entries: state.entries })
