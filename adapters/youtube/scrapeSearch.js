// VideoSearch port backed by scrape-youtube. The library intermittently
// throws on back-to-back searches ("Cannot read properties of undefined
// (reading 'split')") and succeeds on the next try, so every search gets a
// few attempts with growing pauses before the error surfaces.
import { youtube } from 'scrape-youtube'

/** @typedef {import('../../core/types.js').Video} Video */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {{ search?: (term: string) => Promise<{ videos: Video[] }>, sleep?: (ms: number) => Promise<void>,
 *   attempts?: number, backoffMs?: number }} [options]
 * @returns {{ search: (term: string) => Promise<Video[]> }}
 */
export function createScrapeSearch({
    search = (term) => youtube.search(term),
    sleep = wait,
    attempts = 3,
    backoffMs = 800,
} = {}) {
    return {
        async search(term) {
            let lastError
            for (let attempt = 1; attempt <= attempts; attempt++) {
                try {
                    const { videos } = await search(term)
                    return videos
                } catch (error) {
                    lastError = error
                    if (attempt < attempts) await sleep(backoffMs * attempt)
                }
            }
            throw lastError
        },
    }
}
