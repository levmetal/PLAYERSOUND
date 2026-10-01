// Is this text a YouTube link, and to what? Pure: the search field asks this
// before searching, so a pasted link plays instead of being searched for.
// Only a real YouTube host counts (a lookalike like youtube.com.evil.com is
// just text), and a bare video id stays a search.

/** @typedef {{ kind: 'video' | 'playlist', id: string }} YoutubeLink */

const VIDEO_ID = /^[\w-]{11}$/
// Auto-generated or private lists that can't be read without an account.
const PRIVATE_LISTS = new Set(['WL', 'LL'])
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'])
const NOCOOKIE_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com'])
// /shorts/ID, /live/ID, /embed/ID, /v/ID
const PATH_PREFIXES = ['shorts', 'live', 'embed', 'v']

function toUrl(text) {
    const trimmed = text.trim()
    if (!trimmed || /\s/.test(trimmed)) return null
    try {
        return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    } catch {
        return null
    }
}

const videoId = (candidate) => (VIDEO_ID.test(candidate ?? '') ? candidate : null)

/**
 * @param {unknown} text
 * @returns {YoutubeLink | null}
 */
export default function parseYoutubeLink(text) {
    if (typeof text !== 'string') return null
    const url = toUrl(text)
    if (!url) return null

    const host = url.hostname.toLowerCase()
    const [first, second] = url.pathname.split('/').filter(Boolean)

    if (host === 'youtu.be') {
        const id = videoId(first)
        return id ? { kind: 'video', id } : null
    }

    if (NOCOOKIE_HOSTS.has(host)) {
        const id = first === 'embed' ? videoId(second) : null
        return id ? { kind: 'video', id } : null
    }

    if (!HOSTS.has(host)) return null

    if (first === 'watch') {
        const id = videoId(url.searchParams.get('v'))
        return id ? { kind: 'video', id } : null
    }
    if (PATH_PREFIXES.includes(first)) {
        const id = videoId(second)
        return id ? { kind: 'video', id } : null
    }
    if (first === 'playlist') {
        const list = url.searchParams.get('list')
        return list && !PRIVATE_LISTS.has(list) ? { kind: 'playlist', id: list } : null
    }
    return null
}
