import container from "../../../services/container";
import { parseDiscoverRequest } from "../../../services/discoverRequest";

export default async function discoverHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  if (!container.can('discover')) return res.status(404).json({ error: 'Discovery is not available.' })

  const request = parseDiscoverRequest(req.body)
  if (!request.ok) return res.status(400).json({ error: request.error })

  const started = Date.now()
  try {
    const result = await container.discover.discover(request.value)
    res.setHeader('Server-Timing', `discover;dur=${Date.now() - started}`)
    // While YouTube rate-limits us, candidates come back without videos; say when to ask again.
    // A request that asked for no videos (resolve: 0) searched nothing, so there's nothing to wait for.
    const blocked = request.value.resolve > 0 ? container.youtubeBlockedFor() : 0
    return res.status(200).json(blocked ? { ...result, retryAfter: Math.ceil(blocked / 1000) } : result)
  } catch (error) {
    console.error('discover error:', error)
    if (container.isSourceError(error)) return res.status(502).json({ error: 'Music data is unavailable right now.' })
    return res.status(500).json({ error: 'Discovery failed.' })
  }
}
