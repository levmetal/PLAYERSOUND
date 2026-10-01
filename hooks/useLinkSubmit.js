import { useCallback, useState } from 'react'
import parseYoutubeLink from '../core/track/parseYoutubeLink'
import { lookupVideo } from '../utils/videoClient'
import { useNowPlaying } from '../context/nowPlayingContext'

// What a search field does with a submitted term before searching: a pasted
// YouTube video link plays at once (a one-track queue), anything that isn't a
// link is left to the caller's normal search.
//
// `submit(text)` resolves to
//   'search' — not a link; the caller searches as usual
//   'played' — the video is playing; the caller clears/restores its field
//   'failed' — a link that couldn't be played; `error` says why, field untouched
export default function useLinkSubmit() {
    const { open } = useNowPlaying()
    const [state, setState] = useState({ pending: false, error: null })

    const submit = useCallback(async (text) => {
        const link = parseYoutubeLink(text)
        if (!link) {
            setState({ pending: false, error: null })
            return 'search'
        }
        // Playlist links are the next piece of this feature (PLAN §6.8, 4b).
        if (link.kind === 'playlist') {
            setState({ pending: false, error: "Playlist links aren't supported yet. Paste a video link." })
            return 'failed'
        }
        setState({ pending: true, error: null })
        const result = await lookupVideo(link.id)
        if (!result.ok) {
            setState({ pending: false, error: result.error })
            return 'failed'
        }
        setState({ pending: false, error: null })
        open(result.video)
        return 'played'
    }, [open])

    const clearError = useCallback(() => setState((current) => (current.error ? { ...current, error: null } : current)), [])

    return { submit, pending: state.pending, error: state.error, clearError }
}
