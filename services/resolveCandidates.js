// Last.fm names a track; YouTube has to play it. For each candidate this
// searches YouTube and keeps only a result that resolveTrack identifies as
// the same song — a wrong video would be worse than none. Each resolution
// costs a YouTube search, so only the few tracks about to play are resolved.
import resolveTrack from '../core/track/resolveTrack.js'

/** @typedef {import('../core/types.js').Video} Video */

const MAX_TRACK_SECONDS = 900

// Accent-, case- and punctuation-insensitive form for comparing names.
const loose = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const sameName = (a, b) => {
    const x = loose(a)
    const y = loose(b)
    return Boolean(x && y) && (x.includes(y) || y.includes(x))
}

/**
 * `resolve` can be swapped for a cached version (the container does), and
 * resolveTop then goes through it too.
 * @param {{ videoSearch: { search(term: string): Promise<Video[]> }, concurrency?: number,
 *   resolve?: (track: { artist: string, title: string }) => Promise<Video | null> }} deps
 */
export function createResolveCandidates({ videoSearch, concurrency = 3, resolve: resolveOverride }) {
    /** @param {{ artist: string, title: string }} track @returns {Promise<Video | null>} */
    async function searchAndMatch({ artist, title }) {
        const results = await videoSearch.search(`${artist} ${title}`)
        return results.find((video) => {
            if (!(video.duration > 0 && video.duration <= MAX_TRACK_SECONDS)) return false
            const found = resolveTrack(video)
            return Boolean(found) && sameName(found.artist, artist) && sameName(found.title, title)
        }) ?? null
    }

    const resolve = resolveOverride ?? searchAndMatch

    /**
     * Resolves candidates in order, a few at a time, until `count` have a
     * video. Tried-and-failed candidates are dropped; untried ones keep
     * `video: null` so a later /api/discover/resolve can pick them up.
     */
    async function resolveTop(candidates, { count = 5, excludeVideoIds = [], maxAttempts = 10 } = {}) {
        const used = new Set(excludeVideoIds)
        const outcome = new Map() // index → video, or null for a failure
        let next = 0
        let resolved = 0

        while (resolved < count && next < candidates.length && next < maxAttempts) {
            const size = Math.min(concurrency, count - resolved, candidates.length - next, maxAttempts - next)
            const batch = candidates.slice(next, next + size).map((candidate, i) => ({ index: next + i, candidate }))
            next += size
            const videos = await Promise.all(batch.map(({ candidate }) => resolve(candidate)))
            batch.forEach(({ index }, i) => {
                const video = videos[i]
                if (video && !used.has(video.id)) {
                    used.add(video.id)
                    outcome.set(index, video)
                    resolved += 1
                } else {
                    outcome.set(index, null)
                }
            })
        }

        return candidates.flatMap((candidate, index) => {
            if (!outcome.has(index)) return [{ ...candidate, video: null }]
            const video = outcome.get(index)
            return video ? [{ ...candidate, video }] : []
        })
    }

    return { resolve, resolveTop }
}
