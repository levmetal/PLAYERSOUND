// MusicCatalog port backed by the Last.fm web API. Maps each response to a
// small, consistently typed shape (Last.fm sends some numbers as strings),
// treats "not found" as an empty result, and caps concurrent requests since
// Last.fm rate-limits at its own discretion.

const API_URL = 'https://ws.audioscrobbler.com/2.0/'
const NOT_FOUND = 6

export class LastfmError extends Error {
    /** @param {number | 'http'} code @param {string} message */
    constructor(code, message) {
        super(message)
        this.name = 'LastfmError'
        this.code = code
    }
}

// Runs at most `limit` tasks at once; the rest wait their turn in order.
function createLimiter(limit) {
    let active = 0
    const waiting = []
    const release = () => {
        active -= 1
        waiting.shift()?.()
    }
    return async (task) => {
        if (active >= limit) await new Promise((resolve) => waiting.push(resolve))
        active += 1
        try {
            return await task()
        } finally {
            release()
        }
    }
}

const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])

/**
 * @param {{ apiKey: string, fetch?: typeof fetch, maxConcurrent?: number }} options
 */
export function createLastfmMusic({ apiKey, fetch = globalThis.fetch, maxConcurrent = 4 }) {
    const limit = createLimiter(maxConcurrent)

    // Resolves the parsed body, or null for Last.fm's "not found".
    const call = (method, params) => limit(async () => {
        const url = new URL(API_URL)
        for (const [key, value] of Object.entries({ method, ...params, api_key: apiKey, format: 'json' })) {
            url.searchParams.set(key, String(value))
        }
        const response = await fetch(url.toString())
        let body
        try {
            body = await response.json()
        } catch {
            throw new LastfmError('http', `Last.fm responded ${response.status}`)
        }
        if (body?.error === NOT_FOUND) return null
        if (body?.error) throw new LastfmError(body.error, body.message)
        if (!response.ok) throw new LastfmError('http', `Last.fm responded ${response.status}`)
        return body
    })

    const trackParams = ({ artist, title }) => ({ artist, track: title, autocorrect: 1 })
    const toTags = (body) => list(body?.toptags?.tag).map((tag) => ({ name: tag.name, count: Number(tag.count) }))

    return {
        async similarTracks(track, limitCount = 50) {
            const body = await call('track.getSimilar', { ...trackParams(track), limit: limitCount })
            return list(body?.similartracks?.track).map((t) => ({
                artist: t.artist.name, title: t.name, match: Number(t.match), playcount: Number(t.playcount),
            }))
        },

        async similarArtists(artist, limitCount = 10) {
            const body = await call('artist.getSimilar', { artist, autocorrect: 1, limit: limitCount })
            return list(body?.similarartists?.artist).map((a) => ({ name: a.name, match: Number(a.match) }))
        },

        async artistTopTracks(artist, limitCount = 5) {
            const body = await call('artist.getTopTracks', { artist, autocorrect: 1, limit: limitCount })
            return list(body?.toptracks?.track).map((t) => ({
                artist: t.artist.name, title: t.name, playcount: Number(t.playcount),
            }))
        },

        async trackTags(track) {
            return toTags(await call('track.getTopTags', trackParams(track)))
        },

        async artistTags(artist) {
            return toTags(await call('artist.getTopTags', { artist, autocorrect: 1 }))
        },

        async tagTopTracks(tag, limitCount = 50) {
            const body = await call('tag.getTopTracks', { tag, limit: limitCount })
            return list(body?.tracks?.track).map((t) => ({
                artist: t.artist.name, title: t.name, rank: Number(t['@attr']?.rank),
            }))
        },

        async searchTrack(text, limitCount = 5) {
            const body = await call('track.search', { track: text, limit: limitCount })
            return list(body?.results?.trackmatches?.track).map((t) => ({
                artist: t.artist, title: t.name, listeners: Number(t.listeners),
            }))
        },
    }
}
