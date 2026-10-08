// Two VideoSearch ports as one: the primary answers when it has enough videos;
// when it comes back thin (under MIN_RESULTS), empty or failing, the fallback
// is asked and its new videos are added after the primary's, without
// duplicates. If the fallback fails, whatever the primary had stands; if both
// fail, the primary's error is the one thrown, so a rate limit is still
// reported as a rate limit. Other methods of the primary (e.g. blockedFor)
// stay available.

/** @typedef {import('../../core/types.js').Video} Video */
/** @typedef {{ search: (term: string) => Promise<Video[]> }} VideoSearch */

const MIN_RESULTS = 10

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
            let first = []
            let primaryError
            try {
                first = await primary.search(term)
                if (first.length >= MIN_RESULTS) return first
            } catch (error) {
                primaryError = error
            }
            let more
            try {
                more = await fallback.search(term)
            } catch (fallbackError) {
                if (first.length) return first
                throw primaryError ?? fallbackError
            }
            const seen = new Set(first.map((video) => video.id))
            return [...first, ...more.filter((video) => !seen.has(video.id))]
        },
    }
}
