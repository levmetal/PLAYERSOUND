import container from "../../../services/container";

// What each failure says to the person who pasted the link.
const FAILURES = {
  'invalid-id': { status: 400, error: "That isn't a YouTube video link" },
  unplayable: { status: 422, error: "This video can't be played here" },
  'not-found': { status: 404, error: "That video doesn't exist" },
  unavailable: { status: 502, error: "YouTube didn't answer. Try again in a moment." },
}
// Anything else: internal details stay in the server log, never in the response.
const FAILED = "Couldn't open that video. Try again in a moment."

export default async function videoHandler(req, res) {
  const { id } = req.query

  try {
    res.status(200).json(await container.video.video(id))
  } catch (error) {
    const failure = FAILURES[container.lookupFailure(error)]
    if (failure) return res.status(failure.status).json({ error: failure.error })
    console.error(`video lookup error for ${JSON.stringify(id)}:`, error)
    res.status(500).json({ error: FAILED })
  }
}
