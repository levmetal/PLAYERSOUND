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

// YouTube returns both the long form ("3 years ago") and an abbreviated one
// ("3y ago", "5mo ago") depending on the response.
const UNIT_ALIASES = {
    s: 'second', sec: 'second', second: 'second',
    m: 'minute', min: 'minute', minute: 'minute',
    h: 'hour', hr: 'hour', hour: 'hour',
    d: 'day', day: 'day',
    w: 'week', wk: 'week', week: 'week',
    mo: 'month', month: 'month',
    y: 'year', yr: 'year', year: 'year',
}

const UPLOADED_RE = /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|w|months?|mo|years?|yrs?|y)\s+ago/

function parseUploaded(uploaded) {
    const match = typeof uploaded === 'string' && uploaded.toLowerCase().match(UPLOADED_RE)
    if (!match) return null
    const unit = UNIT_ALIASES[match[2].replace(/s$/, '')] ?? UNIT_ALIASES[match[2]]
    return unit ? { amount: Number(match[1]), unit } : null
}

export function parseUploadedAgo(uploaded) {
    const parsed = parseUploaded(uploaded)
    return parsed ? parsed.amount * UNIT_MS[parsed.unit] : Infinity
}

// Always the long form ("3 years ago"), whichever one the API sent.
export function formatUploaded(uploaded) {
    const parsed = parseUploaded(uploaded)
    if (!parsed) return uploaded || null
    return `${parsed.amount} ${parsed.unit}${parsed.amount === 1 ? '' : 's'} ago`
}

export const DEFAULT_SORT = 'relevance'
export const DEFAULT_DURATION = 'all'

export const SORT_OPTIONS = {
    relevance: { label: 'Relevance', compare: null },
    views: { label: 'Most viewed', compare: (a, b) => (b.views ?? 0) - (a.views ?? 0) },
    recent: { label: 'Newest', compare: (a, b) => parseUploadedAgo(a.uploaded) - parseUploadedAgo(b.uploaded) },
    shortest: { label: 'Shortest', compare: (a, b) => (a.duration ?? 0) - (b.duration ?? 0) },
    longest: { label: 'Longest', compare: (a, b) => (b.duration ?? 0) - (a.duration ?? 0) },
}

// A missing/0 duration is unknown (e.g. a live stream), not "under a minute".
const hasDuration = (item) => typeof item.duration === 'number' && item.duration > 0

export const DURATION_FILTERS = {
    all: { label: 'Any', test: () => true },
    short: { label: '< 1 min', test: (item) => hasDuration(item) && item.duration < 60 },
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
        const key = item.channel?.name || 'Unknown channel'
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(item)
    }
    return Array.from(map.entries()).map(([channel, items]) => ({
        channel,
        verified: items.some((item) => item.channel?.verified),
        items,
    }))
}
