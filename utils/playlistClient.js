// Browser-side call to /api/playlist/[id]. Answers are normalized to
// { ok: true, playlist } or { ok: false, error } with a sentence ready to show.

const UNREACHABLE = "Couldn't reach the server. Check your connection and try again."

/** @param {string} id */
export async function lookupPlaylist(id) {
    try {
        const response = await fetch(`/api/playlist/${encodeURIComponent(id)}`)
        const body = await response.json().catch(() => null)
        if (!response.ok) return { ok: false, error: body?.error ?? UNREACHABLE }
        return { ok: true, playlist: body }
    } catch {
        return { ok: false, error: UNREACHABLE }
    }
}
