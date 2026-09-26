import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { get, set } from 'idb-keyval'
import libraryReducer, { defaultPlaylists, FAVORITES_ID } from "../../core/library/libraryReducer";

export { FAVORITES_ID }

const STORAGE_KEY = 'playersound:playlists'

// crypto.randomUUID only exists in secure contexts (https, localhost); a dev
// server opened over the LAN from a phone is plain http.
const newPlaylistId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

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
    const [state, dispatch] = useReducer(libraryReducer, defaultPlaylists)
    const hydrated = useRef(false)
    const persistRequested = useRef(false)
    // Tracks whether a real (non-HYDRATE) action landed before the async read
    // below resolved, so hydration doesn't clobber a user's in-flight change
    // by unconditionally overwriting state with the older stored snapshot.
    const interacted = useRef(false)

    // The reducer is pure, so a new playlist's id is minted here.
    function dispatchTracked(action) {
        if (action.type !== 'HYDRATE') interacted.current = true
        if (action.type === 'CREATE_PLAYLIST' && !action.payload.id) {
            dispatch({ ...action, payload: { ...action.payload, id: newPlaylistId() } })
            return
        }
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
        // Ask once per session for storage the browser won't evict under
        // pressure — without it, playlists can vanish with cleared site data.
        if (!persistRequested.current) {
            persistRequested.current = true
            navigator.storage?.persist?.().catch(() => {})
        }
    }, [state])

    return (
        <PlaylistsContext.Provider value={state}>
            <PlaylistsDispatchContext.Provider value={dispatchTracked}>
                {children}
            </PlaylistsDispatchContext.Provider>
        </PlaylistsContext.Provider>
    )
}
