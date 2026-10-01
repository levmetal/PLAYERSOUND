// Composition root: the only file that picks adapters and knows which
// edition is running. Everything else asks `can('x')` instead of reading
// env vars.
import { createScrapeSearch } from '../adapters/youtube/scrapeSearch.js'
import { createMemoryCache } from '../adapters/cache/memoryCache.js'
import { createRuntimeCache } from '../adapters/cache/runtimeCache.js'
import { withCache } from '../adapters/cache/withCache.js'
import { createLastfmMusic, LastfmError } from '../adapters/lastfm/lastfmMusic.js'
import { trackKey } from '../core/discovery/rankCandidates.js'
import { createOembedLookup } from '../adapters/youtube/oembedLookup.js'
import { createSearchService } from './search.js'
import { createLookupVideoService } from './lookupVideo.js'
import { createResolveCandidates } from './resolveCandidates.js'
import { createDiscoverService } from './discover.js'

const EDITIONS = {
    public: { discover: true, download: false, playback: ['iframe'] },
    local: { discover: true, download: true, playback: ['localFile', 'native', 'iframe'] },
}

const LOOKUP_FAILURES = new Set(['invalid-id', 'unplayable', 'not-found', 'unavailable'])

const HOUR = 60 * 60
const DAY = 24 * HOUR

const byTrack = (track, limit = '') => `${trackKey(track.artist, track.title)}|${limit}`
const byName = (name, limit = '') => `${name.toLowerCase().trim()}|${limit}`

// TTLs from the plan's caching table: similarity drifts slowly, tags even slower.
const LASTFM_CACHE = {
    similarTracks: { ttl: 7 * DAY, key: byTrack },
    similarArtists: { ttl: 7 * DAY, key: byName },
    artistTopTracks: { ttl: 7 * DAY, key: byName },
    tagTopTracks: { ttl: 7 * DAY, key: byName },
    searchTrack: { ttl: 7 * DAY, key: byName },
    trackTags: { ttl: 30 * DAY, key: byTrack },
    artistTags: { ttl: 30 * DAY, key: byName },
}

// One per process, so the dev server keeps its cache across requests.
let memoryCache
const sharedMemoryCache = () => (memoryCache ??= createMemoryCache())

/** @param {{ edition?: string, vercel?: boolean, lastfmApiKey?: string }} [options] */
export function createContainer({ edition, vercel = false, lastfmApiKey } = {}) {
    const edited = EDITIONS[edition] ?? EDITIONS.public
    // Discovery needs Last.fm; without a key it's simply off, not broken.
    const capabilities = { ...edited, discover: edited.discover && Boolean(lastfmApiKey) }
    const cacheKind = vercel ? 'runtime' : 'memory'
    const cache = vercel ? createRuntimeCache() : sharedMemoryCache()

    const youtubeSearch = createScrapeSearch()
    const videoSearch = withCache(youtubeSearch, {
        cache,
        prefix: 'yt',
        methods: { search: { ttl: HOUR, key: (term) => term.toLowerCase() } },
    })

    // Only successful lookups are cached (withCache skips throws), for as long as search matches.
    const videoLookup = withCache(createOembedLookup(), {
        cache,
        prefix: 'yt',
        methods: { video: { ttl: 30 * DAY, key: (id) => id } },
    })

    const matcher = createResolveCandidates({ videoSearch })
    const { resolve } = withCache({ resolve: matcher.resolve }, {
        cache,
        prefix: 'yt',
        methods: { resolve: { ttl: 30 * DAY, key: (track) => trackKey(track.artist, track.title) } },
    })
    const resolver = createResolveCandidates({ videoSearch, resolve })

    const catalog = capabilities.discover
        ? withCache(createLastfmMusic({ apiKey: lastfmApiKey }), { cache, prefix: 'lastfm', methods: LASTFM_CACHE })
        : null

    return {
        capabilities,
        cacheKind,
        can: (name) => capabilities[name] === true,
        search: createSearchService({ videoSearch }),
        video: createLookupVideoService({ videoLookup }),
        resolver,
        discover: catalog ? createDiscoverService({ catalog, resolver }) : undefined,
        // Routes answer 502 for these instead of 500, without importing adapters.
        isSourceError: (error) => error instanceof LastfmError,
        // Why a video lookup failed ('invalid-id' | 'unplayable' | 'not-found' | 'unavailable'), else null.
        lookupFailure: (error) => (LOOKUP_FAILURES.has(error?.code) ? error.code : null),
        // YouTube's bot protection: routes answer 503 / add retryAfter instead.
        isRateLimited: (error) => error?.code === 'rate-limited',
        youtubeBlockedFor: () => youtubeSearch.blockedFor(),
    }
}

const container = createContainer({
    edition: process.env.APP_EDITION,
    vercel: Boolean(process.env.VERCEL),
    lastfmApiKey: process.env.LASTFM_API_KEY,
})
export default container
