import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { get, set } from 'idb-keyval'
import queueReducer, {
    initialQueueState,
    currentVideo,
    currentItem,
    nextVideo,
    prevVideo,
    queuePosition,
    hasNext,
    hasPrev,
} from "../core/queue/queueReducer";
import { radioRequest, radioHandoff, pickSeeds, upNext, currentTags } from "../core/queue/radio";
import { discover, resolveCandidates } from "../utils/discoverClient";
import resolveTrack from "../core/track/resolveTrack";
import signalsReducer, { initialSignals, discoverSignals } from "../core/signals/signalsReducer";

// How long "Skipped …" stays in the console header.
const NOTICE_MS = 4000

const SETTINGS_KEY = 'playersound:settings'
const DEFAULT_SETTINGS = { version: 1, radio: true, radioHintSeen: false }
const SIGNALS_KEY = 'playersound:signals'
const HISTORY_KEY = 'playersound:history'

// App-wide "now playing" state, mounted once in pages/_app.js above every
// page. The player itself (components/modal.jsx) renders from here, not from
// the page that opened it — so it survives route changes and keeps playing
// while the user browses.
//
// What plays is a queue (core/queue/queueReducer.js): the list a track was
// started from — the visible search results, or a playlist — so ⏮/⏭ and
// auto-advance walk that list. With radio on, suggestions are fetched here
// whenever core/queue/radio.js says the queue is running low.
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
    // "Your queue ended — radio from … continues", until the track changes.
    const [handoff, setHandoff] = useState(null)
    const [settings, setSettings] = useState(DEFAULT_SETTINGS)
    const settingsLoaded = useRef(false)
    const [clock, setClock] = useState(0)
    // Taste signals (core/signals): read by radio requests through a ref, so
    // a new skip or like never triggers a fetch by itself.
    const [signals, signalsDispatch] = useReducer(signalsReducer, initialSignals)
    const signalsLoaded = useRef(false)
    const signalsRef = useRef(signals)
    signalsRef.current = signals
    // Seconds into the current track, reported by the Player once a second.
    const elapsedRef = useRef(0)
    const queueRef = useRef(queue)
    const previousQueue = useRef(queue)
    queueRef.current = queue

    useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(null), NOTICE_MS)
        return () => clearTimeout(timer)
    }, [notice])

    // Settings: read once, then written on every change.
    useEffect(() => {
        get(SETTINGS_KEY)
            .then((stored) => {
                if (stored?.version !== 1) return
                setSettings((current) => ({ ...current, ...stored }))
                dispatch({ type: 'SET_RADIO', payload: { enabled: stored.radio !== false } })
            })
            .catch(() => {})
            .finally(() => { settingsLoaded.current = true })
    }, [])
    useEffect(() => {
        if (settingsLoaded.current) set(SETTINGS_KEY, settings).catch(() => {})
    }, [settings])

    useEffect(() => {
        Promise.all([get(SIGNALS_KEY), get(HISTORY_KEY)])
            .then(([stored, history]) => {
                signalsDispatch({ type: 'HYDRATE', payload: {
                    ...(stored?.version === 1 ? { affinity: stored.affinity, excluded: stored.excluded } : {}),
                    ...(history?.version === 1 ? { history: history.items } : {}),
                } })
            })
            .catch(() => {})
            .finally(() => { signalsLoaded.current = true })
    }, [])
    useEffect(() => {
        if (!signalsLoaded.current) return
        set(SIGNALS_KEY, { version: 1, affinity: signals.affinity, excluded: signals.excluded }).catch(() => {})
        set(HISTORY_KEY, { version: 1, items: signals.history }).catch(() => {})
    }, [signals])

    // Radio: whenever the queue changes (or a wait runs out), ask what to fetch.
    useEffect(() => {
        const request = radioRequest(queue, Date.now(), discoverSignals(signalsRef.current))
        if (!request) return
        const { generation } = request
        dispatch({ type: 'RADIO_REQUESTED', payload: { generation } })
        const call = request.kind === 'resolve'
            ? resolveCandidates({ candidates: request.candidates, count: request.count, exclude: request.exclude })
            : discover({ seeds: request.seeds, tags: request.tags, exclude: request.exclude, affinity: request.affinity })
        call.then((result) => {
            const now = Date.now()
            if (!result.ok) {
                dispatch({ type: 'RADIO_FAILED', payload: { generation, now, unavailable: result.unavailable } })
            } else if (request.kind === 'resolve') {
                dispatch({ type: 'RADIO_RESOLVED', payload: {
                    generation, now, requested: request.candidates, candidates: result.data.candidates, retryAfter: result.data.retryAfter,
                } })
            } else {
                // One seed → its Last.fm tags become the player's tag chips.
                const seedTrack = request.seeds.length === 1 ? result.data.seedTracks?.[0] : null
                dispatch({ type: 'RADIO_BATCH', payload: {
                    generation, now, status: result.data.status, candidates: result.data.candidates, retryAfter: result.data.retryAfter,
                    seedTags: seedTrack ? { [request.seeds[0].id]: seedTrack.tags } : undefined,
                } })
            }
        })
    }, [queue, clock])

    // A wait (rate limit, failed request) re-checks once it's over.
    const { retryAt } = queue.radio
    useEffect(() => {
        if (retryAt === null) return undefined
        const timer = setTimeout(() => setClock((n) => n + 1), Math.max(0, retryAt - Date.now()))
        return () => clearTimeout(timer)
    }, [retryAt])

    useEffect(() => {
        const before = previousQueue.current
        previousQueue.current = queue
        if (currentItem(before) === currentItem(queue)) return
        elapsedRef.current = 0
        const seed = radioHandoff(before, queue)
        setHandoff(seed ? `Your queue ended — radio from "${seed}" continues.` : null)
    }, [queue])

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
    const startRadio = useCallback((video) => {
        dispatch({ type: 'START_RADIO', payload: { seeds: [video], label: video.title } })
        setSettings((current) => (current.radio ? current : { ...current, radio: true }))
        setExpanded(true)
    }, [])
    // Only songs Last.fm can be asked about make useful seeds.
    const startPlaylistRadio = useCallback((tracks, name) => {
        const seeds = pickSeeds(tracks.filter((track) => resolveTrack(track) !== null))
        if (!seeds.length) return
        dispatch({ type: 'START_RADIO', payload: { seeds, label: name } })
        setSettings((current) => (current.radio ? current : { ...current, radio: true }))
        setExpanded(true)
    }, [])
    const startTagRadio = useCallback((tag) => {
        dispatch({ type: 'START_TAG_RADIO', payload: { tag } })
        setSettings((current) => (current.radio ? current : { ...current, radio: true }))
    }, [])
    const jumpTo = useCallback((index) => dispatch({ type: 'JUMP_TO', payload: { index } }), [])
    // From "Similar to this": right after the current track, then straight to it.
    const playNow = useCallback((video) => {
        dispatch({ type: 'PLAY_NEXT', payload: { video } })
        dispatch({ type: 'NEXT' })
    }, [])
    const setRadio = useCallback((enabled) => {
        dispatch({ type: 'SET_RADIO', payload: { enabled } })
        setSettings((current) => ({ ...current, radio: enabled, radioHintSeen: true }))
        if (!enabled) setHandoff(null)
    }, [])
    const dismissRadioHint = useCallback(() => {
        setSettings((current) => ({ ...current, radioHintSeen: true }))
    }, [])
    const dismissHandoff = useCallback(() => setHandoff(null), [])
    // ⏭ is a judgement on the track (a skip if early); ⏮, stop and picking
    // another row aren't.
    const next = useCallback(() => {
        const item = currentItem(queueRef.current)
        if (item && hasNext(queueRef.current)) {
            signalsDispatch({ type: 'LISTENED', payload: { item, seconds: elapsedRef.current, finished: false, at: Date.now() } })
        }
        dispatch({ type: 'NEXT' })
    }, [])
    // The track ended on its own: a mild like, then on to the next one.
    const finished = useCallback(() => {
        const item = currentItem(queueRef.current)
        if (item) signalsDispatch({ type: 'LISTENED', payload: { item, seconds: elapsedRef.current, finished: true, at: Date.now() } })
        dispatch({ type: 'NEXT' })
    }, [])
    // ♥ / add to playlist: counts only for the track that's playing (that's
    // the one whose radio tags are known).
    const like = useCallback((videoId) => {
        const item = currentItem(queueRef.current)
        if (item?.video.id === videoId) signalsDispatch({ type: 'LIKED', payload: { item } })
    }, [])
    const reportTime = useCallback((seconds) => { elapsedRef.current = seconds }, [])
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
        setHandoff(null)
    }, [])

    const value = useMemo(
        () => ({
            item: currentVideo(queue),
            current: currentItem(queue),
            nextItem: nextVideo(queue),
            prevItem: prevVideo(queue),
            position: queuePosition(queue),
            source: queue.source,
            radio: queue.radio,
            upNext: upNext(queue),
            tags: currentTags(queue),
            signals: discoverSignals(signals),
            radioHint: queue.radio.enabled && queue.radio.status !== 'unavailable' && !settings.radioHintSeen,
            notice,
            handoff,
            expanded,
            playQueue,
            open,
            playNext,
            enqueue,
            startRadio,
            startPlaylistRadio,
            startTagRadio,
            jumpTo,
            playNow,
            setRadio,
            dismissRadioHint,
            dismissHandoff,
            next,
            finished,
            like,
            reportTime,
            prev,
            skipUnplayable,
            minimize,
            expand,
            stop,
        }),
        [queue, signals, settings.radioHintSeen, notice, handoff, expanded, playQueue, open, playNext, enqueue, startRadio,
            startPlaylistRadio, startTagRadio, jumpTo, playNow, setRadio, dismissRadioHint, dismissHandoff, next, finished, like, reportTime, prev, skipUnplayable, minimize, expand, stop]
    )

    return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>
}

export function useNowPlaying() {
    return useContext(NowPlayingContext)
}
