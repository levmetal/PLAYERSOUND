// VideoSearch port over YouTube's results page. The page is fetched here
// (not by scrape-youtube) so a redirect to Google's "sorry" page — its
// answer once it decides we're sending too many automated searches — is
// recognized as a rate limit: no retries, and no requests at all for a
// cooldown, since hammering it only makes it last longer. scrape-youtube is
// still used to read the results out of the page, and a page that fails to
// parse is retried a few times, as that part really is intermittent.
import { youtube } from 'scrape-youtube'

/** @typedef {import('../../core/types.js').Video} Video */
/** @typedef {{ status: number, location: string | null, html: string }} Page */

export class YoutubeRateLimitError extends Error {
    constructor() {
        super('YouTube is limiting automated searches right now.')
        this.name = 'YoutubeRateLimitError'
        this.code = 'rate-limited'
    }
}

/** @returns {Promise<Page>} */
async function fetchResultsPage(term) {
    const response = await fetch(youtube.getURL(term, {}), { redirect: 'manual' })
    return { status: response.status, location: response.headers.get('location'), html: await response.text() }
}

/** @returns {Promise<Video[]>} */
async function parseResultsPage(html) {
    const data = await youtube.extractRenderData(html)
    return (await youtube.parseData(data)).videos
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const isSorry = (page) => page.status >= 300 && page.status < 400 && /\/sorry\b/.test(page.location ?? '')

/**
 * @param {{ fetchPage?: (term: string) => Promise<Page>, parsePage?: (html: string) => Promise<Video[]>,
 *   sleep?: (ms: number) => Promise<void>, now?: () => number,
 *   attempts?: number, backoffMs?: number, cooldownMs?: number }} [options]
 */
export function createScrapeSearch({
    fetchPage = fetchResultsPage,
    parsePage = parseResultsPage,
    sleep = wait,
    now = Date.now,
    attempts = 3,
    backoffMs = 800,
    cooldownMs = 10 * 60 * 1000,
} = {}) {
    let blockedUntil = 0
    const blockedFor = () => Math.max(0, blockedUntil - now())

    return {
        blockedFor,

        /** @param {string} term @returns {Promise<Video[]>} */
        async search(term) {
            if (blockedFor() > 0) throw new YoutubeRateLimitError()

            let lastError
            for (let attempt = 1; attempt <= attempts; attempt++) {
                const page = await fetchPage(term)
                if (isSorry(page)) {
                    blockedUntil = now() + cooldownMs
                    throw new YoutubeRateLimitError()
                }
                try {
                    if (page.status !== 200) throw new Error(`YouTube responded ${page.status}`)
                    return await parsePage(page.html)
                } catch (error) {
                    lastError = error
                    if (attempt < attempts) await sleep(backoffMs * attempt)
                }
            }
            throw lastError
        },
    }
}
