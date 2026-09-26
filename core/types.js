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
 * @typedef {Object} QueueItem
 * @property {Video} video
 * @property {'user' | 'radio'} origin   only 'user' until radio exists
 */

/**
 * Where the queue came from, for the player's header readout.
 * @typedef {Object} QueueSource
 * @property {'track' | 'search' | 'playlist'} type
 * @property {string} label
 */

/**
 * @typedef {Object} QueueState
 * @property {QueueItem[]} items
 * @property {number} index         -1 when empty
 * @property {QueueSource | null} source
 * @property {1 | -1} direction      last move: 1 forward (next, auto-advance, new list), -1 back
 * @property {string[]} unplayable   ids that failed to play in this queue
 */

export {}
