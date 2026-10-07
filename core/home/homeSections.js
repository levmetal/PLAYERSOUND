// What Home and the History page show, from what the browser already keeps:
// resume positions, listening history and tag likes. Pure — the caller
// supplies `now` and how a moment maps to a local day.

import resolveTrack from '../track/resolveTrack.js'

/** @typedef {import('../types.js').Video} Video */
/** @typedef {{ id: string, key: string | null, at: number, video?: Video, listened?: boolean }} HistoryEntry */

const CONTINUE_LIMIT = 6
const CHIP_LIMIT = 8

// Shown until the listener's own likes give tags: broad Last.fm tags, each of
// which plays real music for that tag (they're not a filter on anything).
export const STARTER_VIBES = ['house', 'lo-fi', 'synthwave', 'jazz', 'hip-hop', 'ambient', 'rock', 'techno']

/**
 * Half-heard long tracks (core/positions entries, newest last), newest first.
 * @param {{ video: Video, seconds: number, at: number }[]} entries
 */
export const continueListening = (entries) =>
    [...entries].reverse().slice(0, CONTINUE_LIMIT).map(({ video, seconds }) => ({
        video, seconds, progress: video.duration ? seconds / video.duration : 0,
    }))

// Only plays heard for real, saved since history keeps the video.
const showable = (entry) => Boolean(entry.video) && entry.listened === true

/**
 * The track "Because you listened to …" is about: the newest one really
 * listened to that Last.fm can be asked about, or null.
 * @param {HistoryEntry[]} history  newest last
 * @returns {Video | null}
 */
export function becauseSeed(history) {
    for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i]
        if (showable(entry) && resolveTrack(entry.video) !== null) return entry.video
    }
    return null
}

/**
 * The listener's liked tags, strongest first; the starter list until there are some.
 * @param {Record<string, number>} affinity
 */
export function vibeChips(affinity) {
    const liked = Object.entries(affinity)
        .filter(([, weight]) => weight > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, CHIP_LIMIT)
        .map(([tag]) => tag)
    return liked.length ? liked : STARTER_VIBES
}

/**
 * History by day, newest first, each track once per day (its latest play).
 * @param {HistoryEntry[]} history  newest last
 * @param {number} now
 * @param {(ms: number) => number} localDay  whole local-day number of a moment
 * @returns {{ daysAgo: number, items: HistoryEntry[] }[]}
 */
export function historyDays(history, now, localDay) {
    const today = localDay(now)
    const days = []
    const seen = new Set()
    for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i]
        if (!showable(entry)) continue
        const daysAgo = today - localDay(entry.at)
        if (seen.has(`${daysAgo}:${entry.id}`)) continue
        seen.add(`${daysAgo}:${entry.id}`)
        let day = days[days.length - 1]
        if (day?.daysAgo !== daysAgo) {
            day = { daysAgo, items: [] }
            days.push(day)
        }
        day.items.push(entry)
    }
    return days
}
