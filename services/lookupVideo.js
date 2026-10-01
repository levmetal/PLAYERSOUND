// Use case behind /api/video/[id]: check the id is shaped like a YouTube
// video id before anything is asked of YouTube, then ask the VideoLookup port.

/** @typedef {import('../core/types.js').Video} Video */

const VIDEO_ID = /^[\w-]{11}$/

export class InvalidVideoIdError extends Error {
    constructor() {
        super('That is not a YouTube video id.')
        this.name = 'InvalidVideoIdError'
        this.code = 'invalid-id'
    }
}

/**
 * @param {{ videoLookup: { video: (id: string) => Promise<Video> } }} deps
 */
export function createLookupVideoService({ videoLookup }) {
    return {
        /** @param {string} id */
        async video(id) {
            if (typeof id !== 'string' || !VIDEO_ID.test(id)) throw new InvalidVideoIdError()
            return videoLookup.video(id)
        },
    }
}
