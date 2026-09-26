// Use case behind /api/search: normalize the term, ask the VideoSearch port.

/** @typedef {import('../core/types.js').Video} Video */

/**
 * @param {{ videoSearch: { search: (term: string) => Promise<Video[]> } }} deps
 */
export function createSearchService({ videoSearch }) {
    return {
        /** @param {string} term */
        async search(term) {
            const query = term.trim()
            if (!query) return []
            return videoSearch.search(query)
        },
    }
}
