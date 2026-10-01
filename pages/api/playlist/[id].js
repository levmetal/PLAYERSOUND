import container from "../../../services/container";

// What each failure says to the person who pasted the link.
const FAILURES = {
  'invalid-id': { status: 400, error: "That isn't a readable YouTube playlist link." },
  'not-found': { status: 404, error: "That playlist doesn't exist or is private." },
  unavailable: { status: 502, error: "YouTube didn't answer for this playlist from here." },
}

export default async function playlistHandler(req, res) {
  const { id } = req.query

  try {
    res.status(200).json(await container.playlist.playlist(id))
  } catch (error) {
    const failure = FAILURES[container.lookupFailure(error)]
    if (failure) return res.status(failure.status).json({ error: failure.error })
    console.error(`playlist lookup error for "${id}":`, error)
    res.status(500).json({ error: error.message })
  }
}
