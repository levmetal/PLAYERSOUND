import { useCallback, useEffect, useRef, useState } from "react";

// Which engine actually fetches the audio bytes:
// - 'native': our own /api/soundplayer resolver, via a real <audio> element.
//   No ads, but only reaches YouTube reliably from a residential IP (see
//   docs/AUDIO_BACKEND_BLOCKERS.md) — this is what `npm run dev` uses by
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
// which one is actually live — see docs/AUDIO_BACKEND_BLOCKERS.md for why
// both exist. `containerRef` is only used by the iframe engine; the native
// engine's <audio> element is self-contained and needs no visible mount
// point.
export default function usePlaybackEngine({ videoId, playing, onEnded, metadata }) {
    const [fellBackToIframe, setFellBackToIframe] = useState(false);
    const engine = PLAYBACK_MODE === 'iframe' || fellBackToIframe ? 'iframe' : 'native';

    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);

    const audioRef = useRef(null);
    const containerRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    useEffect(() => {
        setReady(false);
        setError(null);
    }, [videoId, engine]);

    // --- native engine: wire the <audio> element's own events ---
    useEffect(() => {
        if (engine !== 'native') return;
        const el = audioRef.current;
        if (!el) return;

        const handleCanPlay = () => setReady(true);
        const handleEnded = () => onEndedRef.current?.();
        const handleError = () => {
            if (PLAYBACK_MODE === 'native') {
                // Only auto-fallback when native is the intended default (local
                // dev) — if iframe was already forced, an error there is real.
                setFellBackToIframe(true);
                return;
            }
            setError('No se pudo cargar el audio de este video.');
        };

        el.addEventListener('canplay', handleCanPlay);
        el.addEventListener('ended', handleEnded);
        el.addEventListener('error', handleError);
        return () => {
            el.removeEventListener('canplay', handleCanPlay);
            el.removeEventListener('ended', handleEnded);
            el.removeEventListener('error', handleError);
        };
    }, [engine, videoId]);

    // --- iframe engine: mount YouTube's own player into containerRef ---
    useEffect(() => {
        if (engine !== 'iframe') return;
        let cancelled = false;

        loadIframeApi()
            .then((YT) => {
                if (cancelled || !containerRef.current) return;
                ytPlayerRef.current = new YT.Player(containerRef.current, {
                    videoId,
                    playerVars: { playsinline: 1, rel: 0 },
                    host: 'https://www.youtube-nocookie.com',
                    events: {
                        onReady: () => setReady(true),
                        onError: () => setError('Este video no está disponible para reproducir embebido.'),
                        onStateChange: (event) => {
                            if (event.data === YT.PlayerState.ENDED) onEndedRef.current?.();
                        },
                    },
                });
            })
            .catch(() => setError('No se pudo cargar el reproductor de YouTube.'));

        return () => {
            cancelled = true;
            ytPlayerRef.current?.destroy?.();
            ytPlayerRef.current = null;
        };
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
