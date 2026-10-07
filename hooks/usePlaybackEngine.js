import { useCallback, useEffect, useRef, useState } from "react";

// Which engine actually fetches the audio bytes:
// - 'native': our own /api/soundplayer resolver, via a real <audio> element.
//   No ads, but only reaches YouTube reliably from a residential IP — this is what `npm run dev` uses by
//   default, since a contributor's machine *is* a residential IP.
// - 'iframe': YouTube's own IFrame Player API, running in the visitor's
//   browser. The request never touches our server, so the IP-reputation bot
//   wall documented there structurally cannot apply. This is what the hosted
//   Vercel demo is set to.
const PLAYBACK_MODE = process.env.NEXT_PUBLIC_PLAYBACK_MODE === 'iframe' ? 'iframe' : 'native';
const audioApiBase = process.env.NEXT_PUBLIC_AUDIO_API_BASE || '';

let iframeApiPromise = null;
function loadIframeApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (iframeApiPromise) return iframeApiPromise;

    iframeApiPromise = new Promise((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT);
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
    return iframeApiPromise;
}

// One interface, two engines, so the rest of the player never has to know
// which one is actually live (see the mode notes above for why both
// exist). `containerRef` is only used by the iframe engine; the native
// engine's <audio> element is self-contained and needs no visible mount
// point.
//
// One engine for the whole listening session: Player isn't remounted per
// track, so a track change keeps the same YouTube player (loadVideoById) or
// the same <audio> element (new src). That matters in the background: a
// YouTube player created while the tab is hidden won't start until the tab is
// visible again, while the one that's already playing switches videos and
// keeps going.
//
// Every track starts playing on its own once loaded: a track only ever
// loads because of an explicit play (a row click, Play all, ⏮/⏭) or the
// queue auto-advancing. If the browser blocks autoplay, the track just stays
// loaded with ▶ ready. `onNext`/`onPrev` are null when the queue has nothing
// in that direction. `onUnplayable` fires when YouTube refuses the video
// (embedding disabled, removed, private) so the queue can move past it.
// `startAt` is the second a newly loaded track starts at (a long track left
// part-way); the track that's already loaded is never moved by it.
export default function usePlaybackEngine({ videoId, startAt = 0, onEnded, onNext = null, onPrev = null, onUnplayable = null, metadata }) {
    const [fellBackToIframe, setFellBackToIframe] = useState(false);
    const engine = PLAYBACK_MODE === 'iframe' || fellBackToIframe ? 'iframe' : 'native';

    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    // Mirrors the media element's real state, not the last button press: the
    // browser's own media controls, the lock screen, or a click on the YouTube
    // frame can all pause/resume playback without going through our transport.
    const [playing, setPlaying] = useState(false);

    const audioRef = useRef(null);
    const containerRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onNextRef = useRef(onNext);
    onNextRef.current = onNext;
    const onPrevRef = useRef(onPrev);
    onPrevRef.current = onPrev;
    const onUnplayableRef = useRef(onUnplayable);
    onUnplayableRef.current = onUnplayable;
    const hasNext = Boolean(onNext);
    const hasPrev = Boolean(onPrev);
    // The track asked for most recently, and the one the YouTube player has
    // actually been given — they differ while the player is still being built.
    const videoIdRef = useRef(videoId);
    videoIdRef.current = videoId;
    const startAtRef = useRef(startAt);
    startAtRef.current = startAt;
    const loadedIdRef = useRef(null);
    // The YouTube player only reports onReady once, when it's built; after
    // that it stays usable for every track it's handed.
    const ytReadyRef = useRef(false);

    // A new track: nothing's playing yet and the last track's error is gone.
    // A reused YouTube player is still ready (no new onReady will come); the
    // <audio> element reports readiness again through canplay.
    useEffect(() => {
        setReady(engine === 'iframe' && ytReadyRef.current);
        setError(null);
        setPlaying(false);
    }, [videoId, engine]);

    // --- native engine: wire the <audio> element's own events ---
    useEffect(() => {
        if (engine !== 'native') return;
        const el = audioRef.current;
        if (!el) return;

        const handleCanPlay = () => setReady(true);
        const handleLoadedMetadata = () => {
            if (startAtRef.current > 0) el.currentTime = startAtRef.current;
        };
        const handlePlay = () => setPlaying(true);
        const handlePause = () => setPlaying(false);
        const handleEnded = () => {
            setPlaying(false);
            onEndedRef.current?.();
        };
        const handleError = () => {
            if (PLAYBACK_MODE === 'native') {
                // Only auto-fallback when native is the intended default (local
                // dev) — if iframe was already forced, an error there is real.
                setFellBackToIframe(true);
                return;
            }
            setError("Couldn't load this video's audio");
        };

        el.addEventListener('loadedmetadata', handleLoadedMetadata);
        el.addEventListener('canplay', handleCanPlay);
        el.addEventListener('play', handlePlay);
        el.addEventListener('pause', handlePause);
        el.addEventListener('ended', handleEnded);
        el.addEventListener('error', handleError);
        return () => {
            el.removeEventListener('loadedmetadata', handleLoadedMetadata);
            el.removeEventListener('canplay', handleCanPlay);
            el.removeEventListener('play', handlePlay);
            el.removeEventListener('pause', handlePause);
            el.removeEventListener('ended', handleEnded);
            el.removeEventListener('error', handleError);
        };
    }, [engine, videoId]);

    // --- iframe engine: build YouTube's own player into containerRef, once ---
    useEffect(() => {
        if (engine !== 'iframe') return;
        let cancelled = false;

        loadIframeApi()
            .then((YT) => {
                if (cancelled || !containerRef.current) return;
                const firstId = videoIdRef.current;
                loadedIdRef.current = firstId;
                ytPlayerRef.current = new YT.Player(containerRef.current, {
                    videoId: firstId,
                    // controls: 0 hides YouTube's own play/pause/seek/volume bar —
                    // our own transport (components/player.jsx) already drives this
                    // player via play/pause/seek/setVolume below, so leaving
                    // YouTube's controls on just doubled up on controls for the
                    // same video with no benefit. disablekb stops the iframe from
                    // also reacting to space/arrow keys behind our own transport.
                    playerVars: {
                        autoplay: 1, playsinline: 1, rel: 0, controls: 0, disablekb: 1, iv_load_policy: 3,
                        ...(startAtRef.current > 0 ? { start: Math.floor(startAtRef.current) } : {}),
                    },
                    host: 'https://www.youtube-nocookie.com',
                    events: {
                        onReady: (event) => {
                            ytReadyRef.current = true;
                            setReady(true);
                            // The track changed while the player was being built.
                            if (videoIdRef.current !== loadedIdRef.current) {
                                loadedIdRef.current = videoIdRef.current;
                                event.target.loadVideoById({ videoId: videoIdRef.current, startSeconds: startAtRef.current });
                            }
                        },
                        onError: () => {
                            setError("This video can't be played here");
                            onUnplayableRef.current?.();
                        },
                        onStateChange: (event) => {
                            const { PLAYING, PAUSED, ENDED, CUED, UNSTARTED } = YT.PlayerState;
                            // BUFFERING is left alone so a mid-play stall doesn't flicker the button.
                            if (event.data === PLAYING) setPlaying(true);
                            else if ([PAUSED, ENDED, CUED, UNSTARTED].includes(event.data)) setPlaying(false);
                            if (event.data === ENDED) onEndedRef.current?.();
                        },
                    },
                });
            })
            .catch(() => setError("Couldn't load the YouTube player"));

        return () => {
            cancelled = true;
            ytPlayerRef.current?.destroy?.();
            ytPlayerRef.current = null;
            ytReadyRef.current = false;
            loadedIdRef.current = null;
        };
    }, [engine]);

    // --- iframe engine: a new track goes into the same player ---
    useEffect(() => {
        if (engine !== 'iframe' || !ytReadyRef.current || loadedIdRef.current === videoId) return;
        loadedIdRef.current = videoId;
        ytPlayerRef.current?.loadVideoById({ videoId, startSeconds: startAtRef.current });
    }, [engine, videoId]);

    // --- MediaSession: lock-screen/notification controls. Only wired for the
    // native engine — it's the one with a real <audio> element actually
    // producing sound in this tab, which is what keeps the session alive on
    // mobile; the iframe engine's audio lives inside a cross-origin frame and
    // doesn't reliably survive backgrounding anyway (see the blockers doc). ---
    useEffect(() => {
        if (engine !== 'native' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: metadata?.title || '',
            artist: metadata?.artist || '',
            artwork: metadata?.artworkUrl ? [{ src: metadata.artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
        navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
        navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            if (audioRef.current) audioRef.current.currentTime += 10;
        });

        return () => {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('seekbackward', null);
            navigator.mediaSession.setActionHandler('seekforward', null);
        };
    }, [engine, metadata?.title, metadata?.artist, metadata?.artworkUrl]);

    // Lock-screen ⏮/⏭ only show up when there's somewhere to go.
    useEffect(() => {
        if (engine !== 'native' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
        navigator.mediaSession.setActionHandler('nexttrack', hasNext ? () => onNextRef.current?.() : null);
        navigator.mediaSession.setActionHandler('previoustrack', hasPrev ? () => onPrevRef.current?.() : null);
        return () => {
            navigator.mediaSession.setActionHandler('nexttrack', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
        };
    }, [engine, hasNext, hasPrev]);

    useEffect(() => {
        if (engine !== 'native' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }, [engine, playing]);

    const play = useCallback(async () => {
        if (engine === 'native') await audioRef.current?.play();
        else ytPlayerRef.current?.playVideo();
    }, [engine]);

    const pause = useCallback(() => {
        if (engine === 'native') audioRef.current?.pause();
        else ytPlayerRef.current?.pauseVideo();
    }, [engine]);

    const seek = useCallback((seconds) => {
        if (engine === 'native') {
            if (audioRef.current) audioRef.current.currentTime = seconds;
        } else {
            ytPlayerRef.current?.seekTo(seconds, true);
        }
    }, [engine]);

    const getCurrentTime = useCallback(() => {
        if (engine === 'native') return audioRef.current?.currentTime ?? 0;
        return ytPlayerRef.current?.getCurrentTime?.() ?? 0;
    }, [engine]);

    // 0-100, matching the existing volume slider — the native <audio> element
    // uses 0-1 internally, so that conversion happens here, not in the caller.
    const setVolume = useCallback((volume0to100) => {
        if (engine === 'native') {
            if (audioRef.current) audioRef.current.volume = volume0to100 / 100;
        } else {
            ytPlayerRef.current?.setVolume(volume0to100);
        }
    }, [engine]);

    const audioUrl = `${audioApiBase}/api/soundplayer/${videoId}`;

    return {
        engine,
        ready,
        error,
        playing,
        play,
        pause,
        seek,
        getCurrentTime,
        setVolume,
        audioRef,
        containerRef,
        audioUrl,
    };
}
