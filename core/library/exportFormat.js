// Backup file for the playlists: what Export writes and Import reads back.
// Also the hand-off format to the future local edition, so it's versioned
// and validated rather than trusted.

/** @typedef {import('./libraryReducer.js').Playlist} Playlist */

const APP = 'playersound'
const VERSION = 1

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * @param {Playlist[]} playlists
 * @param {Date} now
 */
export function toExport(playlists, now) {
    return { app: APP, version: VERSION, exportedAt: now.toISOString(), playlists }
}

/**
 * @param {string} text
 * @returns {{ ok: true, playlists: Playlist[] } | { ok: false, error: 'not-json' | 'not-playersound' | 'unsupported-version' | 'invalid-playlists' }}
 */
export function parseImport(text) {
    let data
    try {
        data = JSON.parse(text)
    } catch {
        return { ok: false, error: 'not-json' }
    }
    if (!isObject(data) || data.app !== APP) return { ok: false, error: 'not-playersound' }
    if (data.version !== VERSION) return { ok: false, error: 'unsupported-version' }

    const valid = Array.isArray(data.playlists) && data.playlists.every((playlist) =>
        isObject(playlist) && typeof playlist.id === 'string' && typeof playlist.name === 'string' && Array.isArray(playlist.tracks))
    if (!valid) return { ok: false, error: 'invalid-playlists' }

    // A track without an id can't be deduplicated or played; drop just that one.
    const playlists = data.playlists.map((playlist) => ({
        ...playlist,
        tracks: playlist.tracks.filter((track) => isObject(track) && typeof track.id === 'string'),
    }))
    return { ok: true, playlists }
}

/**
 * Adds what's new in `incoming` without duplicating anything already in
 * `current`, so importing the same backup twice is harmless.
 * @param {Playlist[]} current
 * @param {Playlist[]} incoming
 * @returns {{ playlists: Playlist[], added: { playlists: number, tracks: number } }}
 */
export function mergePlaylists(current, incoming) {
    const added = { playlists: 0, tracks: 0 }
    const playlists = current.map((playlist) => ({ ...playlist }))

    for (const source of incoming) {
        const target = playlists.find((playlist) => playlist.id === source.id)
        if (!target) {
            playlists.push(source)
            added.playlists += 1
            added.tracks += source.tracks.length
            continue
        }
        const known = new Set(target.tracks.map((track) => track.id))
        const fresh = source.tracks.filter((track) => !known.has(track.id))
        if (fresh.length) {
            target.tracks = [...target.tracks, ...fresh]
            added.tracks += fresh.length
        }
    }

    return { playlists, added }
}
