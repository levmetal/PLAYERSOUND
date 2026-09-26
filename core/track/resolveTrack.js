// Video → { artist, title } using only what a search result already carries
// (title, channel, description snippet, duration). Deterministic: the first
// rule that matches wins and is recorded, so a wrong guess can be traced.
import cleanTitle from './cleanTitle.js'

/** @typedef {import('../types.js').Video} Video */
/** @typedef {import('../types.js').Track} Track */

// Mixes, DJ sets, podcasts and streams run longer than any single song.
const MAX_TRACK_SECONDS = 900

const DASH_SPLIT_RE = /\s[-–—]\s/
const TOPIC_SUFFIX = ' - Topic'

const track = (artist, title, rule, confidence) =>
    artist && title ? { artist, title, rule, confidence } : null

/**
 * @param {Video} video
 * @returns {Track | null}
 */
export default function resolveTrack(video) {
    if (!video.duration || video.duration > MAX_TRACK_SECONDS) return null

    const channel = video.channel?.name ?? ''
    const description = video.description ?? ''
    const cleaned = cleanTitle(video.title)

    // R1: YouTube's auto-generated "Topic" upload. The snippet reads
    // "Provided to YouTube by <label> <Track> · <Artist> <Album>…" — the
    // artist runs into the album, so the channel name supplies it instead.
    if (description.startsWith('Provided to YouTube by') && description.includes(`${video.title} · ${channel}`)) {
        return track(channel, cleaned, 'R1', 'high')
    }

    if (channel.endsWith(TOPIC_SUFFIX)) {
        return track(channel.slice(0, -TOPIC_SUFFIX.length), cleaned, 'R2', 'high')
    }

    const parts = cleaned.split(DASH_SPLIT_RE).map((part) => part.trim()).filter(Boolean)
    if (parts.length >= 2) {
        const [left, right] = parts
        const rightIsChannel = right.toLowerCase() === channel.toLowerCase()
        return rightIsChannel
            ? track(right, left, 'R3', 'medium')
            : track(left, right, 'R3', 'medium')
    }

    if (video.channel?.verified) {
        return track(channel.replace(/^Official\s+/i, ''), cleaned, 'R4', 'medium')
    }

    return null
}
