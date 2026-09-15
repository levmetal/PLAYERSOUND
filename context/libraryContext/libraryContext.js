import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { get, set } from 'idb-keyval'
import playlistReducer, { defaultPlaylists, FAVORITES_ID } from "./libraryReducer";

export { FAVORITES_ID }

const STORAGE_KEY = 'playersound:playlists'

export const PlaylistsContext = createContext(defaultPlaylists)
export const PlaylistsDispatchContext = createContext(null)

export function usePlaylists() {
    return useContext(PlaylistsContext)
}

export function useDispatchContext() {
    return useContext(PlaylistsDispatchContext)
}

// Convenience: the Favorites playlist's tracks, for call sites (the mini
// player's heart toggle) that only ever care about the default playlist.
export function useSoundContext() {
    const playlists = usePlaylists()
    return playlists.find((playlist) => playlist.id === FAVORITES_ID)?.tracks ?? []
}

export function SoundProvider({ children }) {
    const [state, dispatch] = useReducer(playlistReducer, defaultPlaylists)
    const hydrated = useRef(false)
    // Tracks whether a real (non-HYDRATE) action landed before the async read
    // below resolved, so hydration doesn't clobber a user's in-flight change
    // by unconditionally overwriting state with the older stored snapshot.
    const interacted = useRef(false)

    function dispatchTracked(action) {
        if (action.type !== 'HYDRATE') interacted.current = true
        dispatch(action)
    }

    // IndexedDB reads/writes are async and non-blocking, unlike localStorage
    // (which would re-serialize every playlist on every single track add).
    useEffect(() => {
        let cancelled = false
        get(STORAGE_KEY)
            .then((stored) => {
                if (!cancelled && stored && !interacted.current) dispatch({ type: 'HYDRATE', payload: stored })
            })
            .catch(() => {
                // IndexedDB can reject (private browsing, blocked storage) —
                // still mark hydrated below so persistence isn't blocked forever.
            })
            .finally(() => {
                if (!cancelled) hydrated.current = true
            })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!hydrated.current) return
        set(STORAGE_KEY, state)
    }, [state])

    return (
        <PlaylistsContext.Provider value={state}>
            <PlaylistsDispatchContext.Provider value={dispatchTracked}>
                {children}
            </PlaylistsDispatchContext.Provider>
        </PlaylistsContext.Provider>
    )
}
