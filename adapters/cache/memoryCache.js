// In-process Cache port for local development: TTL per entry, bounded size,
// least-recently-used entry evicted first. A Map keeps insertion order, so
// re-inserting on every read keeps the oldest-used entry at the front.

/** @param {{ now?: () => number, maxEntries?: number }} [options] */
export function createMemoryCache({ now = Date.now, maxEntries = 500 } = {}) {
    const entries = new Map()

    return {
        async get(key) {
            const entry = entries.get(key)
            if (!entry) return undefined
            entries.delete(key)
            if (now() > entry.expiresAt) return undefined
            entries.set(key, entry)
            return entry.value
        },

        async set(key, value, ttlSec) {
            entries.delete(key)
            entries.set(key, { value, expiresAt: now() + ttlSec * 1000 })
            while (entries.size > maxEntries) entries.delete(entries.keys().next().value)
        },
    }
}
