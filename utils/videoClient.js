// Browser-side call to /api/video/[id]. Answers are normalized to
// { ok: true, video } or { ok: false, error } with a sentence ready to show.

const UNREACHABLE = "Couldn't reach the server. Check your connection and try again."

/** @param {string} id */
export async function lookupVideo(id) {
    try {
        const response = await fetch(`/api/video/${encodeURIComponent(id)}`)
        const body = await response.json().catch(() => null)
        if (!response.ok) return { ok: false, error: body?.error ?? UNREACHABLE }
        return { ok: true, video: body }
    } catch {
        return { ok: false, error: UNREACHABLE }
    }
}
