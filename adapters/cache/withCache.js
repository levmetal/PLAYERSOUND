// Wraps any port so the listed methods read through a Cache, without the
// services that use it knowing caching exists. Identical calls already in
// flight share one underlying call, so a burst of lookups for the same
// artist costs a single request. A method may set `cacheIf(value)` to keep
// some answers out of the cache (search keeps empty lists out); a stored
// value it rejects is treated as a miss.

/**
 * @template T
 * @param {T} target
 * @param {{ cache: { get(key: string): Promise<any>, set(key: string, value: any, ttlSec: number): Promise<void> },
 *   prefix: string, methods: Record<string, { ttl: number, key: (...args: any[]) => string, cacheIf?: (value: any) => boolean }> }} options
 * @returns {T}
 */
export function withCache(target, { cache, prefix, methods }) {
    const inFlight = new Map()
    const wrapped = { ...target }

    for (const [name, { ttl, key, cacheIf = () => true }] of Object.entries(methods)) {
        wrapped[name] = (...args) => {
            const cacheKey = `${prefix}:${name}:${key(...args)}`
            if (inFlight.has(cacheKey)) return inFlight.get(cacheKey)

            const pending = (async () => {
                const hit = await cache.get(cacheKey)
                // A stored value the rule rejects (cached before the rule existed) counts as a miss.
                if (hit !== undefined && cacheIf(hit)) return hit
                const value = await target[name](...args)
                if (cacheIf(value)) await cache.set(cacheKey, value, ttl)
                return value
            })().finally(() => inFlight.delete(cacheKey))

            inFlight.set(cacheKey, pending)
            return pending
        }
    }

    return wrapped
}
