import { createContext, useCallback, useContext, useMemo, useState } from "react";

// App-wide "now playing" state, mounted once in pages/_app.js above every
// page. The player itself (components/modal.jsx) renders from here, not from
// the page that opened it — so it survives route changes and keeps playing
// while the user browses.
//
// `expanded` switches the same mounted player between the full console
// (modal) and the docked mini-player; it never remounts the player, so the
// <audio> element / YouTube iframe keep playing across the switch. Only
// `stop()` (or opening a different track) tears it down.
const NowPlayingContext = createContext(null)

export function NowPlayingProvider({ children }) {
    const [item, setItem] = useState(null)
    const [expanded, setExpanded] = useState(false)

    // Opening the track that's already loaded just re-expands it (Modal is
    // keyed by item.id in pages/_app.js, so same id = same player instance,
    // playback position intact); a different track replaces it.
    const open = useCallback((track) => {
        setItem(track)
        setExpanded(true)
    }, [])
    const minimize = useCallback(() => setExpanded(false), [])
    const expand = useCallback(() => setExpanded(true), [])
    const stop = useCallback(() => {
        setItem(null)
        setExpanded(false)
    }, [])

    const value = useMemo(
        () => ({ item, expanded, open, minimize, expand, stop }),
        [item, expanded, open, minimize, expand, stop]
    )

    return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>
}

export function useNowPlaying() {
    return useContext(NowPlayingContext)
}
