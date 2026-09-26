import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import queueReducer, {
    initialQueueState,
    currentVideo,
    nextVideo,
    prevVideo,
    queuePosition,
    hasNext,
    hasPrev,
} from "../core/queue/queueReducer";

// How long "Skipped …" stays in the console header.
const NOTICE_MS = 4000

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
    const [notice, setNotice] = useState(null)
    const queueRef = useRef(queue)
    queueRef.current = queue

    useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(null), NOTICE_MS)
        return () => clearTimeout(timer)
    }, [notice])

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
    // Picks from a row's ⋯ menu. On an empty queue the track starts in the
    // mini-player; the player only expands for a direct play.
    const playNext = useCallback((video) => {
        dispatch({ type: 'PLAY_NEXT', payload: { video } })
        setNotice(`Playing next: "${video.title}"`)
    }, [])
    const enqueue = useCallback((video) => {
        dispatch({ type: 'ENQUEUE', payload: { video } })
        setNotice(`Added to queue: "${video.title}"`)
    }, [])
    const next = useCallback(() => dispatch({ type: 'NEXT' }), [])
    const prev = useCallback(() => dispatch({ type: 'PREV' }), [])
    // A track YouTube won't play: move past it, and say so only when there
    // was somewhere to move to (a lone track just shows the player's error).
    const skipUnplayable = useCallback((video) => {
        const current = queueRef.current
        if (currentVideo(current)?.id === video.id && (hasNext(current) || hasPrev(current))) {
            setNotice(`Skipped "${video.title}" — can't be played here`)
        }
        dispatch({ type: 'SKIP_UNPLAYABLE', payload: { videoId: video.id } })
    }, [])
    const minimize = useCallback(() => setExpanded(false), [])
    const expand = useCallback(() => setExpanded(true), [])
    const stop = useCallback(() => {
        dispatch({ type: 'CLEAR' })
        setExpanded(false)
        setNotice(null)
    }, [])

    const value = useMemo(
        () => ({
            item: currentVideo(queue),
            nextItem: nextVideo(queue),
            prevItem: prevVideo(queue),
            position: queuePosition(queue),
            source: queue.source,
            notice,
            expanded,
            playQueue,
            open,
            playNext,
            enqueue,
            next,
            prev,
            skipUnplayable,
            minimize,
            expand,
            stop,
        }),
        [queue, notice, expanded, playQueue, open, playNext, enqueue, next, prev, skipUnplayable, minimize, expand, stop]
    )

    return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>
}

export function useNowPlaying() {
    return useContext(NowPlayingContext)
}
