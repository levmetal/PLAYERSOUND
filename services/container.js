// Composition root: the only file that picks adapters and knows which
// edition is running. Everything else asks `can('x')` instead of reading
// env vars.
import { createScrapeSearch } from '../adapters/youtube/scrapeSearch.js'
import { createSearchService } from './search.js'

const EDITIONS = {
    public: { discover: true, download: false, playback: ['iframe'] },
    local: { discover: true, download: true, playback: ['localFile', 'native', 'iframe'] },
}

/** @param {{ edition?: string }} [options] */
export function createContainer({ edition } = {}) {
    const capabilities = EDITIONS[edition] ?? EDITIONS.public
    return {
        capabilities,
        can: (name) => capabilities[name] === true,
        search: createSearchService({ videoSearch: createScrapeSearch() }),
    }
}

const container = createContainer({ edition: process.env.APP_EDITION })
export default container
