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
const RESOLVE_COUNT = 5
const RESOLVE_ATTEMPTS = 10

/**
 * @param {{ catalog: any, resolver: { resolveTop(candidates: any[], options: any): Promise<any[]> } }} deps
 */
export function createDiscoverService({ catalog, resolver }) {
    async function similarFor({ artist, title }) {
        const track = { artist, title }
        const similar = await catalog.similarTracks(track, SIMILAR_LIMIT)
        if (similar.length) return similar
        // Obscure tracks often have no similar tracks but their artist does.
        const artists = await catalog.similarArtists(track.artist, FALLBACK_ARTISTS)
        const tops = await Promise.all(artists.map((artist) => catalog.artistTopTracks(artist.name, FALLBACK_TRACKS)))
        return tops.flatMap((tracks, i) => tracks.map((t) => ({ ...t, match: artists[i].match })))
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

    async function rankAndResolve({ candidates, seedTags, affinity, excludeKeys, excludeVideoIds, limit }) {
        const candidateTags = await candidateTagsFor(candidates)
        const ranked = rankCandidates({
            candidates, seedTags, candidateTags, affinity, exclude: excludeKeys, limit: limit + RESOLVE_ATTEMPTS,
        })
        const resolved = await resolver.resolveTop(ranked, { count: RESOLVE_COUNT, excludeVideoIds, maxAttempts: RESOLVE_ATTEMPTS })
        return resolved.slice(0, limit).map(({ artist, title, score, reason, video }) => ({ artist, title, score, reason, video }))
    }

    /**
     * @param {{ seeds?: any[], tags?: string[], exclude?: string[], affinity?: Record<string, number>, limit?: number }} request
     */
    async function discover({ seeds = [], tags = [], exclude = [], affinity = {}, limit = 20 }) {
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
                candidates: mergeCandidates(perTag), seedTags, affinity, excludeKeys, excludeVideoIds, limit,
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

        const [similarLists, tagLists] = await Promise.all([
            Promise.all(seedTracks.map(similarFor)),
            Promise.all(seedTracks.map(tagsFor)),
        ])

        // Several seeds: sum each tag's counts so genres they share add up.
        const summed = new Map()
        for (const tag of tagLists.flat()) summed.set(tag.name, (summed.get(tag.name) ?? 0) + tag.count)
        const seedTags = normalizeTags([...summed].map(([name, count]) => ({ name, count })))

        const candidates = await rankAndResolve({
            candidates: mergeCandidates(seedTracks.map((seed, i) => ({ seed, candidates: similarLists[i] }))),
            seedTags,
            affinity,
            excludeKeys: [...excludeKeys, ...seedTracks.map((s) => trackKey(s.artist, s.title))],
            excludeVideoIds: [...excludeVideoIds, ...seedVideoIds],
            limit,
        })

        return {
            status: 'ok',
            seedTracks: seedTracks.map((track, i) => ({ ...track, tags: tagLists[i].map((tag) => tag.name) })),
            candidates,
        }
    }

    return { discover }
}
