// "More like this": seed videos (or tags) in, ranked and explained
// candidates out, the first few already matched to a playable video.
// Identification, tag cleanup and ranking are pure core/ functions; this
// only decides what to ask Last.fm and YouTube, and in what order.
import resolveTrack from '../core/track/resolveTrack.js'
import { normalizeTags } from '../core/discovery/tagUtils.js'
import { rankCandidates, mergeCandidates, trackKey } from '../core/discovery/rankCandidates.js'

const MAX_SEEDS = 5
const MAX_TAGS = 3
const SIMILAR_LIMIT = 50
const FALLBACK_ARTISTS = 5
const FALLBACK_TRACKS = 3
const TAGGED_ARTISTS = 15
const RESOLVE_COUNT = 3
// Each attempt is a YouTube search; YouTube rate-limits us past a few dozen.
const RESOLVE_ATTEMPTS = 5
// R5: a Last.fm search hit is trusted as a correction only this popular —
// real junk hits for a garbled title sit in the hundreds or low thousands.
const SEARCH_MIN_LISTENERS = 10000
const SEARCH_LIMIT = 5

/**
 * @param {{ catalog: any, resolver: { resolveTop(candidates: any[], options: any): Promise<any[]> } }} deps
 */
export function createDiscoverService({ catalog, resolver }) {
    // Similar tracks for a seed, plus the seed as Last.fm knows it: when the
    // title as written isn't known (reversed "Track - Artist" uploads, extra
    // words), a popular enough search hit corrects it (R5).
    async function similarFor(seed) {
        const track = { artist: seed.artist, title: seed.title }
        const similar = await catalog.similarTracks(track, SIMILAR_LIMIT)
        if (similar.length) return { seed, similar }

        const hits = await catalog.searchTrack(`${track.artist} ${track.title}`, SEARCH_LIMIT)
        const hit = hits.find((h) => h.listeners >= SEARCH_MIN_LISTENERS)
        if (hit) {
            const corrected = { artist: hit.artist, title: hit.title }
            const correctedSimilar = await catalog.similarTracks(corrected, SIMILAR_LIMIT)
            if (correctedSimilar.length) {
                return { seed: { ...corrected, rule: 'R5', confidence: 'low' }, similar: correctedSimilar }
            }
        }

        // Obscure tracks often have no similar tracks but their artist does.
        const artists = await catalog.similarArtists(track.artist, FALLBACK_ARTISTS)
        const tops = await Promise.all(artists.map((artist) => catalog.artistTopTracks(artist.name, FALLBACK_TRACKS)))
        return { seed, similar: tops.flatMap((tracks, i) => tracks.map((t) => ({ ...t, match: artists[i].match }))) }
    }

    async function tagsFor({ artist, title }) {
        const track = { artist, title }
        const tags = await catalog.trackTags(track)
        const raw = tags.length ? tags : await catalog.artistTags(track.artist)
        return normalizeTags(raw, { artists: [track.artist] })
    }

    // Tags for the strongest candidates' artists only — one call per artist.
    async function candidateTagsFor(candidates) {
        const artists = []
        for (const c of [...candidates].sort((a, b) => b.match - a.match)) {
            if (!artists.some((artist) => artist.toLowerCase() === c.artist.toLowerCase())) artists.push(c.artist)
            if (artists.length === TAGGED_ARTISTS) break
        }
        const tags = await Promise.all(artists.map((artist) => catalog.artistTags(artist)))
        return Object.fromEntries(artists.map((artist, i) => [artist.toLowerCase(), normalizeTags(tags[i], { artists: [artist] })]))
    }

    async function rankAndResolve({ candidates, seedTags, affinity, excludeKeys, excludeVideoIds, limit, resolve }) {
        const candidateTags = await candidateTagsFor(candidates)
        const ranked = rankCandidates({
            candidates, seedTags, candidateTags, affinity, exclude: excludeKeys, limit: limit + RESOLVE_ATTEMPTS,
        })
        // resolve: 0 is Last.fm only — no YouTube search at all.
        const resolved = resolve > 0
            ? await resolver.resolveTop(ranked, { count: resolve, excludeVideoIds, maxAttempts: RESOLVE_ATTEMPTS })
            : ranked.map((candidate) => ({ ...candidate, video: null }))
        return resolved.slice(0, limit).map(({ artist, title, score, reason, video }) => ({ artist, title, score, reason, video }))
    }

    /**
     * @param {{ seeds?: any[], tags?: string[], exclude?: string[], affinity?: Record<string, number>, limit?: number, resolve?: number }} request
     */
    async function discover({ seeds = [], tags = [], exclude = [], affinity = {}, limit = 20, resolve = RESOLVE_COUNT }) {
        const excludeKeys = exclude.filter((entry) => entry.includes('|'))
        const excludeVideoIds = exclude.filter((entry) => !entry.includes('|'))

        if (!seeds.length && tags.length) {
            const tagNames = tags.slice(0, MAX_TAGS)
            const lists = await Promise.all(tagNames.map((tag) => catalog.tagTopTracks(tag, SIMILAR_LIMIT)))
            const perTag = lists.map((tracks) => ({
                seed: { title: null },
                candidates: tracks.map((t) => ({ ...t, match: 1 - (t.rank - 1) / tracks.length, playcount: 0 })),
            }))
            const seedTags = normalizeTags(tagNames.map((name) => ({ name, count: 100 })))
            const candidates = await rankAndResolve({
                candidates: mergeCandidates(perTag), seedTags, affinity, excludeKeys, excludeVideoIds, limit, resolve,
            })
            return { status: 'ok', seedTracks: [], candidates }
        }

        const seedTracks = []
        const seedVideoIds = []
        for (const video of seeds) {
            const track = resolveTrack(video)
            if (!track || seedTracks.some((s) => trackKey(s.artist, s.title) === trackKey(track.artist, track.title))) continue
            seedTracks.push(track)
            seedVideoIds.push(video.id)
            if (seedTracks.length === MAX_SEEDS) break
        }
        if (!seedTracks.length) return { status: 'unidentified', seedTracks: [], candidates: [] }

        // Similar lists first: R5 may correct a seed, and its tags must be the
        // corrected track's.
        const found = await Promise.all(seedTracks.map(similarFor))
        const effectiveSeeds = found.map((f) => f.seed)
        const similarLists = found.map((f) => f.similar)
        const tagLists = await Promise.all(effectiveSeeds.map(tagsFor))

        // Several seeds: sum each tag's counts so genres they share add up.
        const summed = new Map()
        for (const tag of tagLists.flat()) summed.set(tag.name, (summed.get(tag.name) ?? 0) + tag.count)
        const seedTags = normalizeTags([...summed].map(([name, count]) => ({ name, count })))

        const candidates = await rankAndResolve({
            candidates: mergeCandidates(effectiveSeeds.map((seed, i) => ({ seed, candidates: similarLists[i] }))),
            seedTags,
            affinity,
            excludeKeys: [...excludeKeys, ...[...seedTracks, ...effectiveSeeds].map((s) => trackKey(s.artist, s.title))],
            excludeVideoIds: [...excludeVideoIds, ...seedVideoIds],
            limit,
            resolve,
        })

        return {
            status: 'ok',
            seedTracks: effectiveSeeds.map((track, i) => ({ ...track, tags: tagLists[i].map((tag) => tag.name) })),
            candidates,
        }
    }

    return { discover }
}
