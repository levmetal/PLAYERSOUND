import container from "../../../services/container";
import { parseResolveRequest } from "../../../services/discoverRequest";

// Matches more discover candidates to playable videos as the queue needs them.
export default async function resolveHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  if (!container.can('discover')) return res.status(404).json({ error: 'Discovery is not available.' })

  const request = parseResolveRequest(req.body)
  if (!request.ok) return res.status(400).json({ error: request.error })

  const { candidates, count, exclude } = request.value
  try {
    const resolved = await container.resolver.resolveTop(candidates, {
      count, excludeVideoIds: exclude, maxAttempts: candidates.length,
    })
    return res.status(200).json({ candidates: resolved })
  } catch (error) {
    console.error('discover/resolve error:', error)
    return res.status(500).json({ error: 'Discovery failed.' })
  }
}
