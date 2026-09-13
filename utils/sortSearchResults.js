// scrape-youtube's `uploaded` field is a free-text relative string
// ("3 years ago"), not a timestamp — this converts it to an approximate
// milliseconds-ago number so "most recent" can sort on it.
const UNIT_MS = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
}

export function parseUploadedAgo(uploaded) {
    if (!uploaded) return Infinity
    const match = uploaded.toLowerCase().match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/)
    if (!match) return Infinity
    const [, amount, unit] = match
    return Number(amount) * UNIT_MS[unit]
}

export const SORT_OPTIONS = {
    relevance: { label: 'Relevance', compare: null },
    views: { label: 'Most viewed', compare: (a, b) => (b.views ?? 0) - (a.views ?? 0) },
    recent: { label: 'Most recent', compare: (a, b) => parseUploadedAgo(a.uploaded) - parseUploadedAgo(b.uploaded) },
    shortest: { label: 'Shortest first', compare: (a, b) => (a.duration ?? 0) - (b.duration ?? 0) },
    longest: { label: 'Longest first', compare: (a, b) => (b.duration ?? 0) - (a.duration ?? 0) },
}

export const DURATION_FILTERS = {
    all: { label: 'Any length', test: () => true },
    short: { label: '< 1 min', test: (item) => item.duration < 60 },
    medium: { label: '1-5 min', test: (item) => item.duration >= 60 && item.duration <= 300 },
    long: { label: '5+ min', test: (item) => item.duration > 300 },
}

export function applySort(results, sortKey) {
    const option = SORT_OPTIONS[sortKey]
    if (!option || !option.compare) return results
    return [...results].sort(option.compare)
}

export function applyDurationFilter(results, filterKey) {
    const filter = DURATION_FILTERS[filterKey]
    if (!filter) return results
    return results.filter(filter.test)
}

export function groupByChannel(results) {
    const map = new Map()
    for (const item of results) {
        const key = item.channel?.name ?? 'Unknown'
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(item)
    }
    return Array.from(map.entries()).map(([channel, items]) => ({ channel, items }))
}
