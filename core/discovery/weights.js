// Every tunable number in the ranking lives here, so a tuning change is one
// reviewed diff instead of a hunt through the scoring code.
export const WEIGHTS = {
    match: 0.5, // Last.fm's own similarity (listener co-occurrence)
    tags: 0.35, // cosine similarity of tags with the seed(s)
    affinity: 0.15, // the listener's learned tag preferences
    popularity: 0.1, // penalty for heavily played tracks — escape the bubble
}

export const MAX_PER_ARTIST = 2

// log10 of the play count at which the popularity penalty saturates (1e8 plays).
export const POPULARITY_LOG_CEILING = 8

export const SHARED_TAGS_SHOWN = 3
