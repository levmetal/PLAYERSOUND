import container from "../../../services/container";

const RATE_LIMITED = 'YouTube is limiting searches right now. Try again in a few minutes.'

export default async function searchHandler(req, res) {
  const { searchTerm } = req.query

  try {
    res.status(200).json(await container.search.search(searchTerm))
  } catch (error) {
    if (container.isRateLimited(error)) {
      res.setHeader('Retry-After', String(Math.ceil(container.youtubeBlockedFor() / 1000) || 600))
      return res.status(503).json({ error: RATE_LIMITED })
    }
    console.error(`search error for "${searchTerm}":`, error);
    res.status(500).json({ error: error.message })
  }
}
