import { createContext, useCallback, useContext, useMemo, useReducer, useState } from "react";
import queueReducer, {
    initialQueueState,
    currentVideo,
    nextVideo,
    prevVideo,
    queuePosition,
} from "../core/queue/queueReducer";

// App-wide "now playing" state, mounted once in pages/_app.js above every
// page. The player itself (components/modal.jsx) renders from here, not from
// the page that opened it — so it survives route changes and keeps playing
// while the user browses.
//
// What plays is a queue (core/queue/queueReducer.js): the list a track was
// started from — the visible search results, or a playlist — so ⏮/⏭ and
// auto-advance walk that list.
//
// `expanded` switches the same mounted player between the full console
// (modal) and the docked mini-player; it never remounts the player, so the
// <audio> element / YouTube iframe keep playing across the switch. Only
// `stop()` tears it down.
const NowPlayingContext = createContext(null)

export function NowPlayingProvider({ children }) {
    const [queue, dispatch] = useReducer(queueReducer, initialQueueState)
    const [expanded, setExpanded] = useState(false)

    // Starting the track that's already loaded keeps its playback position
    // (Player is keyed by the track id, see components/modal.jsx) and just
    // adopts the new list as the queue.
    const playQueue = useCallback((videos, startIndex, source) => {
        dispatch({ type: 'PLAY_LIST', payload: { videos, startIndex, source } })
        setExpanded(true)
    }, [])
    const open = useCallback(
        (track) => playQueue([track], 0, { type: 'track', label: track.title }),
        [playQueue]
    )
    const next = useCallback(() => dispatch({ type: 'NEXT' }), [])
    const prev = useCallback(() => dispatch({ type: 'PREV' }), [])
    const minimize = useCallback(() => setExpanded(false), [])
    const expand = useCallback(() => setExpanded(true), [])
    const stop = useCallback(() => {
        dispatch({ type: 'CLEAR' })
        setExpanded(false)
    }, [])

    const value = useMemo(
        () => ({
            item: currentVideo(queue),
            nextItem: nextVideo(queue),
            prevItem: prevVideo(queue),
            position: queuePosition(queue),
            source: queue.source,
            expanded,
            playQueue,
            open,
            next,
            prev,
            minimize,
            expand,
            stop,
        }),
        [queue, expanded, playQueue, open, next, prev, minimize, expand, stop]
    )

    return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>
}

export function useNowPlaying() {
    return useContext(NowPlayingContext)
}
