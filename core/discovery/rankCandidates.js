// Orders Last.fm's similar tracks for this listener: similarity, shared
// tags with the seed, the listener's tag affinity, minus a popularity
// penalty — then variety (at most two per artist). Every candidate carries
// the reason it's there, so the UI can always say why something plays.
import { WEIGHTS, MAX_PER_ARTIST, POPULARITY_LOG_CEILING, SHARED_TAGS_SHOWN } from './weights.js'

/** @typedef {import('./tagUtils.js').Tag} Tag */
/** @typedef {{ artist: string, title: string, match: number, playcount: number, seed: string | null }} Candidate */

export const trackKey = (artist, title) => `${artist}|${title}`.toLowerCase().trim().replace(/\s*\|\s*/, '|')

/**
 * @param {{ seed: { artist: string, title: string }, candidates: Omit<Candidate, 'seed'>[] }[]} perSeed
 * @returns {Candidate[]}
 */
export function mergeCandidates(perSeed) {
    const merged = new Map()
    for (const { seed, candidates } of perSeed) {
        for (const candidate of candidates) {
            const key = trackKey(candidate.artist, candidate.title)
            const entry = merged.get(key)
            if (!entry) {
                merged.set(key, { ...candidate, total: candidate.match, best: candidate.match, seed: seed.title })
                continue
            }
            entry.total += candidate.match
            if (candidate.match > entry.best) {
                entry.best = candidate.match
                entry.seed = seed.title
            }
        }
    }
    // A seed that didn't suggest a candidate counts as 0 in the average.
    return [...merged.values()].map(({ total, best, ...candidate }) => ({ ...candidate, match: total / perSeed.length }))
}

const vector = (tags) => new Map(tags.map((tag) => [tag.name, tag.count]))

function cosine(a, b) {
    let dot = 0
    for (const [name, count] of a) dot += count * (b.get(name) ?? 0)
    if (!dot) return 0
    const norm = (v) => Math.sqrt([...v.values()].reduce((sum, count) => sum + count * count, 0))
    return dot / (norm(a) * norm(b))
}

function affinityScore(tags, affinity) {
    let weighted = 0
    let weight = 0
    for (const tag of tags) {
        if (!(tag.name in affinity)) continue
        weighted += affinity[tag.name] * tag.count
        weight += tag.count
    }
    return weight ? weighted / weight : 0
}

const popularity = (playcount) => Math.min(1, Math.log10(1 + (playcount || 0)) / POPULARITY_LOG_CEILING)

// Tags on both sides, strongest overlap (the weaker of the two counts) first.
function sharedTags(seed, tags) {
    return tags
        .filter((tag) => seed.has(tag.name))
        .map((tag) => ({ name: tag.name, overlap: Math.min(tag.count, seed.get(tag.name)) }))
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, SHARED_TAGS_SHOWN)
        .map((tag) => tag.name)
}

/**
 * @param {{ candidates: Candidate[], seedTags: Tag[], candidateTags: Record<string, Tag[]>,
 *   affinity?: Record<string, number>, exclude?: string[], limit?: number }} input
 */
export function rankCandidates({ candidates, seedTags, candidateTags, affinity = {}, exclude = [], limit = 20 }) {
    const excluded = new Set(exclude)
    const seed = vector(seedTags)

    const scored = candidates
        .filter((c) => !excluded.has(trackKey(c.artist, c.title)))
        .map((c) => {
            const tags = candidateTags[c.artist.toLowerCase()] ?? []
            const score = WEIGHTS.match * c.match
                + WEIGHTS.tags * cosine(seed, vector(tags))
                + WEIGHTS.affinity * affinityScore(tags, affinity)
                - WEIGHTS.popularity * popularity(c.playcount)
            return {
                artist: c.artist,
                title: c.title,
                playcount: c.playcount,
                score: Number(score.toFixed(4)),
                reason: { seed: c.seed, sharedTags: sharedTags(seed, tags) },
            }
        })
        .sort((a, b) => b.score - a.score)

    const perArtist = new Map()
    const ranked = []
    for (const c of scored) {
        const artist = c.artist.toLowerCase()
        const count = perArtist.get(artist) ?? 0
        if (count >= MAX_PER_ARTIST) continue
        perArtist.set(artist, count + 1)
        ranked.push(c)
        if (ranked.length === limit) break
    }
    return ranked
}
