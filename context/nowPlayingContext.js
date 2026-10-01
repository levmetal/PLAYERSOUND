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
import { radioRequest, radioHandoff, pickSeeds, upNext, currentTags, autoplayTarget } from "../core/queue/radio";
import similarReducer, { initialSimilar, viewList, vibeTags, similarRequest } from "../core/discovery/similarReducer";
import { discover, resolveCandidates } from "../utils/discoverClient";
import resolveTrack from "../core/track/resolveTrack";
import { savableTracks, defaultPlaylistName } from "../core/queue/saveQueue";
import signalsReducer, { initialSignals, discoverSignals } from "../core/signals/signalsReducer";

// How long "Skipped …" stays in the console header.
const NOTICE_MS = 4000

// A track has to be playing this long before its Similar vibe list is asked
// for, so skipping through tracks doesn't fire a request for each one.
const SIMILAR_DELAY_MS = 500

const SETTINGS_KEY = 'playersound:settings'
const DEFAULT_SETTINGS = { version: 1, radio: true }
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
    // "Your queue ended — autoplay continues: …", until the track changes.
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
    // Similar vibe: the list for the playing track (or a browsed tag), whatever
    // Autoplay is set to. Last.fm only — a video is found when a row is clicked.
    const [similar, similarDispatch] = useReducer(similarReducer, initialSimilar)
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

    const playing = currentVideo(queue)
    const playingId = playing?.id ?? null
    useEffect(() => {
        similarDispatch({ type: 'TRACK_CHANGED', payload: { videoId: playingId } })
    }, [playingId])

    const loadList = useCallback((request) => {
        const { key } = request
        similarDispatch({ type: 'LIST_REQUESTED', payload: { key } })
        discover(request.body).then((result) => {
            if (!result.ok) {
                similarDispatch({ type: 'LIST_FAILED', payload: { key, unavailable: result.unavailable } })
            } else if (result.data.status === 'unidentified') {
                similarDispatch({ type: 'LIST_UNIDENTIFIED', payload: { key } })
            } else {
                similarDispatch({ type: 'LIST_LOADED', payload: {
                    key, candidates: result.data.candidates, tags: result.data.seedTracks?.[0]?.tags,
                } })
            }
        })
    }, [])

    // Ask for whatever list is on screen and not there yet. A list that failed
    // is only asked for again by the Retry button, never in a loop.
    useEffect(() => {
        const request = similarRequest(similar, playing, discoverSignals(signalsRef.current))
        if (!request) return undefined
        if (request.kind === 'unidentified') {
            similarDispatch({ type: 'LIST_UNIDENTIFIED', payload: { key: request.key } })
            return undefined
        }
        if (similar.lists[request.key]) return undefined
        if (request.key.startsWith('tag:')) {
            loadList(request)
            return undefined
        }
        const timer = setTimeout(() => loadList(request), SIMILAR_DELAY_MS)
        return () => clearTimeout(timer)
        // `playing` only matters through its id: the same video is the same list.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [similar, playingId, loadList])

    const browseVibe = useCallback((tag) => similarDispatch({ type: 'BROWSE', payload: { tag } }), [])
    const retryVibe = useCallback(() => {
        const request = similarRequest(similar, currentVideo(queueRef.current), discoverSignals(signalsRef.current))
        if (request?.kind === 'fetch') loadList(request)
    }, [similar, loadList])

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
        setHandoff(seed ? `Your queue ended — autoplay continues: ${seed}.` : null)
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
    // Keeps the listener's queue; only what autoplay follows changes.
    const autoplayVibe = useCallback((tag) => {
        dispatch({ type: 'AUTOPLAY_VIBE', payload: { tag } })
        setSettings((current) => (current.radio ? current : { ...current, radio: true }))
    }, [])
    const jumpTo = useCallback((index) => dispatch({ type: 'JUMP_TO', payload: { index } }), [])
    // From Similar vibe: right after the current track, then straight to it.
    const playNow = useCallback((video) => {
        dispatch({ type: 'PLAY_NEXT', payload: { video } })
        dispatch({ type: 'NEXT' })
    }, [])
    // A Similar vibe row has no video until it's needed (▶, ➕ or Add to
    // playlist): found now with one YouTube search (cached for 30 days
    // server-side). Resolves to the video, or null if there isn't one.
    const ensureVideo = useCallback(async (candidate) => {
        if (candidate.video) return candidate.video
        if (candidate.resolving === 'loading') return null
        const { id } = candidate
        similarDispatch({ type: 'CANDIDATE_RESOLVING', payload: { id } })
        const result = await resolveCandidates({ candidates: [{ artist: candidate.artist, title: candidate.title }], count: 1 })
        const video = result.ok ? result.data.candidates?.[0]?.video : null
        if (video) {
            similarDispatch({ type: 'CANDIDATE_RESOLVED', payload: { id, video } })
            return video
        }
        similarDispatch({ type: 'CANDIDATE_FAILED', payload: { id, limited: Boolean(result.ok && result.data.retryAfter) } })
        return null
    }, [])
    // ▶ / ➕ on a Similar vibe row: it plays or is queued once its video is found.
    const playCandidate = useCallback(async (candidate, mode) => {
        const video = await ensureVideo(candidate)
        if (!video) return
        if (mode === 'now') playNow(video)
        else enqueue(video)
    }, [ensureVideo, playNow, enqueue])
    const setRadio = useCallback((enabled) => {
        dispatch({ type: 'SET_RADIO', payload: { enabled } })
        setSettings((current) => ({ ...current, radio: enabled }))
        if (!enabled) setHandoff(null)
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
            upNext: upNext(queue, Date.now()),
            autoplayTarget: autoplayTarget(queue),
            vibe: viewList(similar),
            browseTag: similar.browseTag,
            // The playing track's own Last.fm tags once known; until then a radio track's shared ones.
            tags: vibeTags(similar).length ? vibeTags(similar) : currentTags(queue),
            // What "Save queue as playlist" would save, and what it would be called.
            queueTracks: savableTracks(queue),
            queueName: defaultPlaylistName(queue.source),
            signals: discoverSignals(signals),
            notice,
            handoff,
            expanded,
            playQueue,
            open,
            playNext,
            enqueue,
            startRadio,
            startPlaylistRadio,
            autoplayVibe,
            jumpTo,
            playNow,
            playCandidate,
            ensureVideo,
            browseVibe,
            retryVibe,
            setRadio,
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
        [queue, clock, similar, signals, notice, handoff, expanded, playQueue, open, playNext, enqueue, startRadio,
            startPlaylistRadio, autoplayVibe, jumpTo, playNow, playCandidate, ensureVideo, browseVibe, retryVibe, setRadio, dismissHandoff, next, finished, like, reportTime, prev, skipUnplayable, minimize, expand, stop]
    )

    return <NowPlayingContext.Provider value={value}>{children}</NowPlayingContext.Provider>
}

export function useNowPlaying() {
    return useContext(NowPlayingContext)
}
