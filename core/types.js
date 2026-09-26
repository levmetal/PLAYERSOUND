// Shared JSDoc shapes for core/. No runtime code lives here.

/**
 * A YouTube search result, exactly as /api/search returns it.
 * @typedef {Object} Video
 * @property {string} id
 * @property {string} title
 * @property {string} link
 * @property {string} thumbnail
 * @property {{ id: string, name: string, link: string, handle?: string, verified: boolean, thumbnail: string }} channel
 * @property {string} description
 * @property {number} views
 * @property {string} uploaded   free-text relative date ("3 years ago")
 * @property {number} duration   seconds; 0 when unknown (e.g. live streams)
 */

/**
 * A video identified as a song. `rule` names the resolveTrack rule that matched.
 * @typedef {Object} Track
 * @property {string} artist
 * @property {string} title
 * @property {'R1' | 'R2' | 'R3' | 'R4'} rule
 * @property {'high' | 'medium'} confidence
 */

/**
 * Why radio picked a track: the seed it resembles (null for tag radio) and
 * up to 3 tags both share.
 * @typedef {Object} Reason
 * @property {string | null} seed
 * @property {string[]} sharedTags
 */

/**
 * A ranked suggestion as /api/discover returns it; `video` is null until
 * it's been matched to a playable upload.
 * @typedef {Object} RadioCandidate
 * @property {string} artist
 * @property {string} title
 * @property {number} score
 * @property {Reason} reason
 * @property {Video | null} video
 */

/**
 * @typedef {Object} QueueItem
 * @property {Video} video
 * @property {'user' | 'radio'} origin
 * @property {Reason} [reason]                          radio items only
 * @property {{ artist: string, title: string }} [track] radio items only
 */

/**
 * Where the queue came from, for the player's header readout.
 * @typedef {Object} QueueSource
 * @property {'track' | 'search' | 'playlist' | 'radio'} type
 * @property {string} label
 */

/**
 * @typedef {Object} QueueState
 * @property {QueueItem[]} items
 * @property {number} index         -1 when empty
 * @property {QueueSource | null} source
 * @property {1 | -1} direction      last move: 1 forward (next, auto-advance, new list), -1 back
 * @property {string[]} unplayable   ids that failed to play in this queue
 * @property {number} generation     bumped per new queue; radio results carry the one they were asked for
 * @property {{ enabled: boolean, seeds: Video[], pending: RadioCandidate[], loading: boolean,
 *   status: 'idle' | 'unidentified' | 'exhausted' | 'unavailable', retryAt: number | null }} radio
 */

export {}
