// Two VideoSearch ports as one: the primary answers unless it comes back empty
// or fails, then the fallback is asked. If both fail, the primary's error is
// the one thrown, so a rate limit is still reported as a rate limit. Other
// methods of the primary (e.g. blockedFor) stay available.

/** @typedef {import('../../core/types.js').Video} Video */
/** @typedef {{ search: (term: string) => Promise<Video[]> }} VideoSearch */

/**
 * @template {VideoSearch} P
 * @param {P} primary
 * @param {VideoSearch} fallback
 * @returns {P}
 */
export function createFallbackSearch(primary, fallback) {
    return {
        ...primary,
        async search(term) {
            let primaryError
            try {
                const videos = await primary.search(term)
                if (videos.length) return videos
            } catch (error) {
                primaryError = error
            }
            try {
                return await fallback.search(term)
            } catch (fallbackError) {
                throw primaryError ?? fallbackError
            }
        },
    }
}
