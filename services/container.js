// Composition root: the only file that picks adapters and knows which
// edition is running. Everything else asks `can('x')` instead of reading
// env vars.
import { createScrapeSearch } from '../adapters/youtube/scrapeSearch.js'
import { createMemoryCache } from '../adapters/cache/memoryCache.js'
import { createRuntimeCache } from '../adapters/cache/runtimeCache.js'
import { withCache } from '../adapters/cache/withCache.js'
import { createSearchService } from './search.js'

const EDITIONS = {
    public: { discover: true, download: false, playback: ['iframe'] },
    local: { discover: true, download: true, playback: ['localFile', 'native', 'iframe'] },
}

const HOUR = 60 * 60

// One per process, so the dev server keeps its cache across requests.
let memoryCache
const sharedMemoryCache = () => (memoryCache ??= createMemoryCache())

/** @param {{ edition?: string, vercel?: boolean }} [options] */
export function createContainer({ edition, vercel = false } = {}) {
    const capabilities = EDITIONS[edition] ?? EDITIONS.public
    const cacheKind = vercel ? 'runtime' : 'memory'
    const cache = vercel ? createRuntimeCache() : sharedMemoryCache()

    const videoSearch = withCache(createScrapeSearch(), {
        cache,
        prefix: 'yt',
        methods: { search: { ttl: HOUR, key: (term) => term.toLowerCase() } },
    })

    return {
        capabilities,
        cacheKind,
        can: (name) => capabilities[name] === true,
        search: createSearchService({ videoSearch }),
    }
}

const container = createContainer({ edition: process.env.APP_EDITION, vercel: Boolean(process.env.VERCEL) })
export default container
