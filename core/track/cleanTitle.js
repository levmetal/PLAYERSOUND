// Strips a YouTube title down to "Artist - Track" (or just "Track"): the
// uploader decorations that would stop a music catalog from matching it.

// Longest phrases first, so "official music video" isn't left as "music".
const TRAILING_NOISE = [
    'official music video',
    'official video',
    'official audio',
    'video oficial',
    'lyric video',
    'lyrics',
    'letra',
    'hd',
    '4k',
]

const TRAILING_NOISE_RE = new RegExp(`(?:^|\\s)(?:${TRAILING_NOISE.join('|')})$`, 'i')
const TRAILING_DASH_RE = /\s*[-–—]\s*$/

/**
 * @param {string} title
 * @returns {string}
 */
export default function cleanTitle(title) {
    let text = title.split(' | ')[0]
    text = text.replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, ' ')
    text = text.replace(/\s(?:ft\.|feat\.|featuring)\s.*$/i, '')
    // Quotes at a word edge only, so "Don't" keeps its apostrophe.
    text = text.replace(/(^|\s)['"‘’“”]+|['"‘’“”]+(?=\s|$)/g, '$1')
    text = text.replace(/\s+/g, ' ').trim()

    let previous
    do {
        previous = text
        text = text.replace(TRAILING_NOISE_RE, '').replace(TRAILING_DASH_RE, '').trim()
    } while (text !== previous)

    return text
}
