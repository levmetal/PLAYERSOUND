// Cache port over Vercel's Runtime Cache (per region, survives deploys).
// Values are wrapped so a cached `null` isn't mistaken for a miss, and any
// cache failure degrades to a miss: caching must never fail a request.
import { getCache as vercelGetCache } from '@vercel/functions'

/** @param {{ getCache?: typeof vercelGetCache }} [options] */
export function createRuntimeCache({ getCache = vercelGetCache } = {}) {
    const runtime = getCache({ namespace: 'playersound' })

    return {
        async get(key) {
            try {
                const entry = await runtime.get(key)
                return entry && typeof entry === 'object' && 'v' in entry ? entry.v : undefined
            } catch {
                return undefined
            }
        },

        async set(key, value, ttlSec) {
            try {
                await runtime.set(key, { v: value }, { ttl: ttlSec })
            } catch {
                // A lost cache write only costs a refetch later.
            }
        },
    }
}
