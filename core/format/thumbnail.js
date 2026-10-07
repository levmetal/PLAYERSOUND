// Track rows show the cover in a 3.5rem square. YouTube's `mqdefault.jpg`
// (320×180, 16:9) covers it at 2× density for about half the bytes of
// `hqdefault.jpg` (480×360, 4:3 with black bands that showed in the crop).
// Built from the video id, so signed playlist URLs (`?sqp=…&rs=…`) work too.

const YOUTUBE_THUMBNAIL = /^https:\/\/i\.ytimg\.com\/vi\/([^/?#]+)\/[^/?#]+(?:[?#].*)?$/

/**
 * @param {string | undefined} url
 * @returns {string | undefined}  the small thumbnail, or `url` unchanged when it isn't a YouTube one
 */
export function smallThumbnail(url) {
    const match = typeof url === 'string' ? url.match(YOUTUBE_THUMBNAIL) : null
    return match ? `https://i.ytimg.com/vi/${match[1]}/mqdefault.jpg` : url
}
