// VideoSearch port over youtubei.js (InnerTube `search`, videos only), used as
// the fallback when the results-page scraper comes back empty or fails. For
// an artist name YouTube answers with a channel card and shelves of videos,
// which the scraper can't read; youtubei.js lists the shelves' videos too.
// Rows come out in the same shape as the scraper's.

/** @typedef {import('../../core/types.js').Video} Video */

// "498,019,646 views" → 498019646; anything else → 0 (unknown).
const viewsOf = (text) => {
    const digits = String(text ?? '').replace(/[^\d]/g, '')
    return digits ? Number(digits) : 0
}

/** @returns {Video | null} */
function toVideo(node) {
    const id = node?.video_id
    const title = node?.title?.text
    if (node?.type !== 'Video' || typeof id !== 'string' || !id || !title) return null
    const seconds = Number(node.duration?.seconds)
    return {
        id,
        title,
        link: `https://youtu.be/${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        channel: {
            id: node.author?.id ?? '',
            name: node.author?.name ?? '',
            link: node.author?.url ?? '',
            verified: Boolean(node.author?.is_verified || node.author?.is_verified_artist),
            thumbnail: '',
        },
        description: node.description_snippet?.text ?? '',
        views: viewsOf(node.view_count?.text),
        uploaded: node.published?.text ?? '',
        duration: Number.isFinite(seconds) && seconds > 0 ? seconds : 0,
    }
}

let client
async function innertubeVideos(term) {
    const { Innertube } = await import('youtubei.js')
    client ??= Innertube.create({ retrieve_player: false })
    return (await (await client).search(term, { type: 'video' })).videos ?? []
}

/** @param {{ searchVideos?: (term: string) => Promise<any[]> }} [options] */
export function createInnertubeSearch({ searchVideos = innertubeVideos } = {}) {
    return {
        /** @param {string} term @returns {Promise<Video[]>} */
        async search(term) {
            return (await searchVideos(term)).map(toVideo).filter(Boolean)
        },
    }
}
