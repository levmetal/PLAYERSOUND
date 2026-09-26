// Turns Last.fm's free-form, user-applied tags into a small comparable set:
// one spelling per genre, no opinions ("awesome"), no bookkeeping ("seen
// live"), no years, and never the artist's own name.

/** @typedef {{ name: string, count: number }} Tag */

const SYNONYMS = {
    'hip hop': 'hip-hop',
    hiphop: 'hip-hop',
    rnb: 'r&b',
    'r n b': 'r&b',
    'rhythm and blues': 'r&b',
    'synth pop': 'synthpop',
    'synth-pop': 'synthpop',
    lofi: 'lo-fi',
    'lo fi': 'lo-fi',
    kpop: 'k-pop',
    dnb: 'drum and bass',
    'drum n bass': 'drum and bass',
}

const STOPLIST = new Set([
    'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'my favorite',
    'awesome', 'amazing', 'beautiful', 'love', 'best', 'cool', 'good', 'great',
    'albums i own', 'spotify', 'youtube', 'music', 'all',
])

const YEAR_RE = /^\d{4}$/
const FULL_DECADE_RE = /^\d{2}(\d0)s$/

// Spaces, hyphens and accents don't make a different genre.
const squash = (name) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[\s-]+/g, '')

/**
 * @param {Tag[]} tags
 * @param {{ artists?: string[], limit?: number }} [options]
 * @returns {Tag[]}
 */
export function normalizeTags(tags, { artists = [], limit = 10 } = {}) {
    const artistNames = new Set(artists.map((artist) => artist.toLowerCase().trim()))
    // squashed spelling → canonical name, so "post punk" and "post-punk" meet.
    const canonical = new Map()
    const counts = new Map()

    for (const tag of tags) {
        if (!(tag.count > 0)) continue
        let name = tag.name.toLowerCase().trim().replace(/\s+/g, ' ')
        name = SYNONYMS[name] ?? name.replace(FULL_DECADE_RE, '$1s')
        if (!name || STOPLIST.has(name) || YEAR_RE.test(name) || artistNames.has(name)) continue

        const key = squash(name)
        if (!canonical.has(key)) canonical.set(key, name)
        const merged = canonical.get(key)
        counts.set(merged, Math.max(counts.get(merged) ?? 0, tag.count))
    }

    // Stable sort: equal counts keep first-seen order.
    return [...counts]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
}
