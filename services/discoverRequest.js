// Request bodies for /api/discover and /api/discover/resolve, checked and
// trimmed to what the services use. Everything here is bounded, since every
// seed and candidate turns into paid-for Last.fm and YouTube lookups.

const LIMITS = { seeds: 10, tags: 3, tagLength: 40, exclude: 500, affinity: 100, limit: 50, candidates: 10, count: 10 }

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value) => typeof value === 'string'
const isIntIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const fail = (error) => ({ ok: false, error })

// Only the fields resolveTrack reads survive; the rest of the object is dropped.
const toSeed = (video) => ({
    id: video.id,
    title: video.title,
    description: isString(video.description) ? video.description : '',
    duration: typeof video.duration === 'number' ? video.duration : 0,
    channel: {
        name: isString(video.channel?.name) ? video.channel.name : '',
        verified: video.channel?.verified === true,
    },
})

function checkExclude(exclude) {
    if (exclude === undefined) return { ok: true, value: [] }
    if (!Array.isArray(exclude) || exclude.length > LIMITS.exclude || !exclude.every(isString)) {
        return fail(`exclude must be a list of up to ${LIMITS.exclude} strings.`)
    }
    return { ok: true, value: exclude }
}

export function parseDiscoverRequest(body) {
    const { seeds = [], tags = [], exclude, affinity = {}, limit = 20 } = isObject(body) ? body : {}

    if (!Array.isArray(seeds) || seeds.length > LIMITS.seeds
        || !seeds.every((seed) => isObject(seed) && isString(seed.id) && isString(seed.title))) {
        return fail(`seeds must be a list of up to ${LIMITS.seeds} videos, each with a string id and title.`)
    }
    if (!Array.isArray(tags) || tags.length > LIMITS.tags
        || !tags.every((tag) => isString(tag) && tag.trim() && tag.length <= LIMITS.tagLength)) {
        return fail(`tags must be a list of up to ${LIMITS.tags} non-empty strings of ${LIMITS.tagLength} characters or fewer.`)
    }
    if (!seeds.length && !tags.length) return fail('Send at least one seed or a tag.')

    const excluded = checkExclude(exclude)
    if (!excluded.ok) return excluded

    const entries = isObject(affinity) ? Object.entries(affinity) : null
    if (!entries || entries.length > LIMITS.affinity
        || !entries.every(([, weight]) => typeof weight === 'number' && weight >= -1 && weight <= 1)) {
        return fail(`affinity must map up to ${LIMITS.affinity} tags to numbers between -1 and 1.`)
    }
    if (!isIntIn(limit, 1, LIMITS.limit)) return fail(`limit must be a whole number from 1 to ${LIMITS.limit}.`)

    return {
        ok: true,
        value: { seeds: seeds.map(toSeed), tags, exclude: excluded.value, affinity, limit },
    }
}

export function parseResolveRequest(body) {
    const { candidates, count = 5, exclude } = isObject(body) ? body : {}

    if (!Array.isArray(candidates) || !candidates.length || candidates.length > LIMITS.candidates
        || !candidates.every((c) => isObject(c) && isString(c.artist) && isString(c.title))) {
        return fail(`candidates must be a list of 1 to ${LIMITS.candidates} items with a string artist and title.`)
    }
    if (!isIntIn(count, 1, LIMITS.count)) return fail(`count must be a whole number from 1 to ${LIMITS.count}.`)

    const excluded = checkExclude(exclude)
    if (!excluded.ok) return excluded

    return { ok: true, value: { candidates, count, exclude: excluded.value } }
}
