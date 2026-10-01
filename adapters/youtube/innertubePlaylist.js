// PlaylistLookup port over youtubei.js (InnerTube `browse`): the first page
// of a public playlist — at most 100 items — as Video rows.
//
// YouTube's answer describes each item as a LockupView; this reads only
// what it needs from it (id, title, channel, thumbnail, the duration
// badge) and drops anything that isn't a plain video. Like the audio
// route, this may be refused from datacenter IPs: that is an
// 'unavailable' error, which the route words as "YouTube didn't answer".

/** @typedef {import('../../core/types.js').Video} Video */

export class PlaylistLookupError extends Error {
    /** @param {'not-found' | 'unavailable'} code */
    constructor(code, message) {
        super(message)
        this.name = 'PlaylistLookupError'
        this.code = code
    }
}

/** "3:55" → 235, "1:02:03" → 3723; "LIVE", "SHORTS", empty → 0 (unknown). */
export function parseBadgeDuration(text) {
    if (typeof text !== 'string' || !/^\d+(:\d{1,2}){1,2}$/.test(text.trim())) return 0
    return text.trim().split(':').reduce((total, part) => total * 60 + Number(part), 0)
}

const channelPart = (item) => item.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text

function durationOf(item) {
    for (const overlay of item.content_image?.overlays ?? []) {
        for (const badge of overlay.badges ?? []) {
            const seconds = parseBadgeDuration(badge.text)
            if (seconds) return seconds
        }
    }
    return 0
}

/** @returns {Video | null} */
function toVideo(item) {
    const title = item?.metadata?.title?.text
    if (item?.content_type !== 'VIDEO' || typeof item.content_id !== 'string' || !item.content_id || !title) return null
    const channel = channelPart(item)
    return {
        id: item.content_id,
        title,
        link: `https://www.youtube.com/watch?v=${item.content_id}`,
        thumbnail: item.content_image?.image?.[0]?.url ?? '',
        channel: {
            id: channel?.runs?.[0]?.endpoint?.payload?.browseId ?? '',
            name: channel?.text ?? '',
            link: '',
            verified: false,
            thumbnail: '',
        },
        description: '',
        views: 0,
        uploaded: '',
        duration: durationOf(item),
    }
}

// "183 videos" / "1,234 videos" → 183 / 1234, or null.
function totalOf(info) {
    const digits = String(info?.total_items ?? '').replace(/[^\d]/g, '')
    return digits ? Number(digits) : null
}

const GONE = /does not exist|private|unavailable/i

let client
async function innertubePlaylist(id) {
    const { Innertube } = await import('youtubei.js')
    client ??= Innertube.create({ retrieve_player: false })
    return (await client).getPlaylist(id)
}

/** @param {{ getPlaylist?: (id: string) => Promise<any> }} [options] */
export function createInnertubePlaylist({ getPlaylist = innertubePlaylist } = {}) {
    return {
        /** @param {string} id */
        async playlist(id) {
            let raw
            try {
                raw = await getPlaylist(id)
            } catch (error) {
                const message = error?.message ?? String(error)
                throw new PlaylistLookupError(GONE.test(message) ? 'not-found' : 'unavailable', message)
            }
            const videos = (raw?.items ?? []).map(toVideo).filter(Boolean)
            return {
                title: raw?.info?.title ?? '',
                author: raw?.info?.author?.name ?? '',
                total: totalOf(raw?.info) ?? videos.length,
                videos,
            }
        },
    }
}
