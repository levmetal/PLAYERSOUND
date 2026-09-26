// Browser-side calls to /api/discover and /api/discover/resolve. Answers are
// normalized to { ok, unavailable, data } so the caller never parses status codes.

async function post(path, body) {
    try {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        // 404 = discovery is switched off on this server (no Last.fm key).
        if (response.status === 404) return { ok: false, unavailable: true }
        if (!response.ok) return { ok: false, unavailable: false }
        return { ok: true, data: await response.json() }
    } catch {
        return { ok: false, unavailable: false }
    }
}

/** @param {{ seeds?: any[], tags?: string[], exclude?: string[], affinity?: Record<string, number> }} body */
export const discover = (body) => post('/api/discover', body)

/** @param {{ candidates: any[], count?: number, exclude?: string[] }} body */
export const resolveCandidates = (body) => post('/api/discover/resolve', body)
