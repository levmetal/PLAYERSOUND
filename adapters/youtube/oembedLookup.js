// VideoLookup port: one video by id. The base is YouTube's public oEmbed
// endpoint (official, keyless): a title, a channel name and link, a
// thumbnail. Its status codes are the verdict — 401 means embedding is
// disabled or the video is private (it couldn't play here anyway), 400/404
// means there is no such video.
//
// oEmbed has no duration, view count or description, and resolveTrack needs
// a duration to call something a song. So, best effort, the watch page is
// read once for the details YouTube embeds in it (ytInitialPlayerResponse).
// Any failure there — a redirect to Google's "sorry" page, a non-200, a page
// without the data, the network — is ignored: the video simply keeps the
// unknown values (0 / ''). Redirects are never followed.

/** @typedef {import('../../core/types.js').Video} Video */

export class VideoLookupError extends Error {
    /** @param {'unplayable' | 'not-found' | 'unavailable'} code */
    constructor(code, message) {
        super(message)
        this.name = 'VideoLookupError'
        this.code = code
    }
}

const ENDPOINT = 'https://www.youtube.com/oembed'

function failureFor(status) {
    if (status === 401 || status === 403) return new VideoLookupError('unplayable', "This video can't be played here.")
    if (status === 400 || status === 404) return new VideoLookupError('not-found', "That video doesn't exist.")
    return new VideoLookupError('unavailable', `YouTube answered ${status}.`)
}

const PLAYER_RESPONSE = /ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|<\/script>)/s

// videoDetails from the watch page, or null if it can't be had or read.
async function readDetails(fetchImpl, link) {
    try {
        const response = await fetchImpl(link, { redirect: 'manual', headers: { 'accept-language': 'en' } })
        if (!response.ok) return null
        const match = (await response.text()).match(PLAYER_RESPONSE)
        const details = match ? JSON.parse(match[1])?.videoDetails : null
        return details && typeof details === 'object' ? details : null
    } catch {
        return null
    }
}

const wholeNumber = (value) => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/** @param {{ fetch?: typeof fetch }} [options] */
export function createOembedLookup({ fetch: fetchImpl = fetch } = {}) {
    return {
        /** @param {string} id @returns {Promise<Video>} */
        async video(id) {
            const link = `https://www.youtube.com/watch?v=${id}`
            const url = `${ENDPOINT}?${new URLSearchParams({ format: 'json', url: link })}`

            let response
            try {
                response = await fetchImpl(url)
            } catch (error) {
                throw new VideoLookupError('unavailable', error.message)
            }
            if (!response.ok) throw failureFor(response.status)

            const body = await response.json()
            if (typeof body?.title !== 'string' || !body.title) {
                throw new VideoLookupError('unavailable', 'YouTube sent an answer without a title.')
            }
            const details = await readDetails(fetchImpl, link)
            return {
                id,
                title: body.title,
                link,
                thumbnail: body.thumbnail_url ?? '',
                channel: {
                    id: typeof details?.channelId === 'string' ? details.channelId : '',
                    name: body.author_name ?? '',
                    link: body.author_url ?? '',
                    verified: false,
                    thumbnail: '',
                },
                description: typeof details?.shortDescription === 'string' ? details.shortDescription : '',
                views: wholeNumber(details?.viewCount),
                uploaded: '',
                duration: wholeNumber(details?.lengthSeconds),
            }
        },
    }
}
