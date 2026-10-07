import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp, FaSpinner, FaStepBackward, FaStepForward } from 'react-icons/fa';
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import styles from '../styles/player.module.css';
import { useSoundContext, useDispatchContext } from "../context/libraryContext/libraryContext";
import usePlaybackEngine from "../hooks/usePlaybackEngine";
import { useNowPlaying } from "../context/nowPlayingContext";
import MarqueeText from './marqueeText';
import resolveTrack from "../core/track/resolveTrack";

// Purely decorative — a neon VU-meter bar-graph. Not driven by real audio
// analysis, same spirit as the loader's fake telemetry readouts. The expanded
// console shows the first 20 bars, staggered by --vu-i; the mini-player's
// wider, thinner meter shows all 64 and uses --vu-t/--vu-d/--vu-a instead —
// at that count a phase growing linearly with the index reads as a
// travelling sine wave, not a meter.
// Integer bit-mixing hash rather than Math.random: identical on server and
// client, so hydration never sees a different style attribute.
const vuHash = (i, seed) => {
    let h = Math.imul((i + 1) ^ seed, 0x9e3779b1);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
};
const VU_BARS = Array.from({ length: 64 }, (_, i) => {
    const duration = 0.8 + vuHash(i, 0x1b873593) * 0.7;
    return {
        '--vu-i': i,
        '--vu-t': `${duration.toFixed(2)}s`,
        '--vu-d': `${(-vuHash(i, 0x2c1b3c6d) * duration).toFixed(2)}s`,
        '--vu-a': (0.55 + vuHash(i, 0x297a2d39) * 0.45).toFixed(2),
    };
});

// How long the meter keeps bouncing after pause before it's allowed to stop —
// matches .vuMeterFading's transition-duration in styles/player.module.css,
// which is what actually makes the shutdown look gradual (see the effect
// below for why a CSS-only version of this doesn't work).
const VU_FADE_MS = 420;

// Last.fm gives a seed up to ~10 tags; the strongest few are enough to tap.
const MAX_TAG_CHIPS = 5;

// requestAnimationFrame stops in a background tab; this keeps the position
// reported (for resuming long tracks) while the tab is hidden.
const HIDDEN_REPORT_MS = 5000;

const Player = ({ item }) => {
    const [currentTime, setCurrentTime] = useState(0);
    const [volVisible, setVisible] = useState(false);
    const bar = useRef();
    const animationRef = useRef();
    const volumeControl = useRef();
    const duration = ConvertSecToMin(item.duration);
    const sounds = useSoundContext();
    const dispatch = useDispatchContext();
    const onEndedRef = useRef(() => {});
    const {
        next, finished, like, reportTime, savePosition, startOver, startAt, resumedAt, prev, nextItem, prevItem,
        skipUnplayable, current, radio, tags, browseVibe, browseTag,
    } = useNowPlaying();
    // Every suggested track says why it's playing (Last.fm data, hence the link).
    const reason = current?.video.id === item.id && current.origin === 'radio' ? current.reason : null;
    // With radio on, say up front when this track can't seed it.
    const unidentified = !reason && radio.enabled && resolveTrack(item) === null;

    // Two interchangeable playback engines behind one interface, because our own resolver only reaches
    // YouTube reliably from a residential IP.
    const engine = usePlaybackEngine({
        videoId: item.id,
        startAt,
        onEnded: () => onEndedRef.current(),
        onNext: nextItem ? next : null,
        onPrev: prevItem ? prev : null,
        onUnplayable: () => skipUnplayable(item),
        metadata: { title: item.title, artist: item.channel?.name, artworkUrl: item.thumbnail },
    });
    const { playing } = engine;

    // Keeps the VU meter's bounce/peak animation alive for VU_FADE_MS after
    // pause, instead of stopping it the instant `playing` goes false. Tried
    // the obvious CSS-only version first — a transition on the bar's idle
    // rule, meant to take over the moment vuMeterActive's `animation` is
    // removed — and verified with transitionrun/transitionstart/transitionend
    // listeners that it never actually fires: a browser doesn't treat a
    // property reverting because its animation was removed as a transition-
    // triggering change, so the bars were snapping to idle every time
    // regardless of what transition was declared. Keeping the animation
    // running while a sibling class fades the whole meter's opacity down
    // (see .vuMeterFading) sidesteps that entirely — opacity is never
    // touched by vu-bounce/vu-mini-bounce, so its transition is a plain,
    // uncontested one — and doubles as cover for the moment the animation
    // does finally stop: by then the meter is dim enough that the height
    // snapping back to its idle 8% is no longer visible.
    const [fading, setFading] = useState(false);
    useEffect(() => {
        if (playing) {
            setFading(false);
            return;
        }
        setFading(true);
        const timer = setTimeout(() => setFading(false), VU_FADE_MS);
        return () => clearTimeout(timer);
    }, [playing]);
    const vuBouncing = playing || fading;

    // Last whole second pushed into `currentTime` state — see the frame loop below.
    const lastSecondRef = useRef(0);

    // Seek thumb + green fill are written straight to the <input> every frame
    // instead of through React state: re-rendering the whole Player (VU bars,
    // marquee, controls) 60x/s just to move one bar was the main cost here.
    // The fill reads --bar-progress (styles/player.module.css); it's set only
    // here, never from the JSX style prop, so a re-render can't reset it.
    const syncBar = (time) => {
        if (!bar.current) return;
        bar.current.value = time;
        const progress = item.duration ? (time / item.duration) * 100 : 0;
        bar.current.style.setProperty('--bar-progress', progress);
    };

    const updateElapsed = (time, report = {}) => {
        const second = Math.floor(time);
        if (second === lastSecondRef.current) return;
        lastSecondRef.current = second;
        setCurrentTime(second);
        reportTime(second, report);
    };

    useEffect(() => {
        setCurrentTime(0);
        lastSecondRef.current = 0;
        syncBar(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id]);

    // Driven by the engine's real playing state, so a pause/play from the
    // browser's media controls or the YouTube frame starts/stops it too.
    useEffect(() => {
        const tick = () => {
            try {
                const time = engine.getCurrentTime();
                syncBar(time);
                // The only on-screen text that depends on time is the mm:ss
                // readout, so state only changes (→ re-render) once per second.
                updateElapsed(time, { playing });
                if (playing) animationRef.current = requestAnimationFrame(tick);
            } catch (error) {
                cancelAnimationFrame(animationRef.current);
            }
        };
        tick();
        return () => cancelAnimationFrame(animationRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, engine.getCurrentTime]);

    const { getCurrentTime } = engine;
    useEffect(() => {
        if (!playing) return undefined;
        const timer = setInterval(() => {
            if (document.visibilityState === 'hidden') reportTime(Math.floor(getCurrentTime()), { playing: true });
        }, HIDDEN_REPORT_MS);
        return () => clearInterval(timer);
    }, [playing, getCurrentTime, reportTime]);

    // A pause keeps the place in a long track.
    const wasPlayingRef = useRef(false);
    useEffect(() => {
        if (wasPlayingRef.current && !playing) savePosition();
        wasPlayingRef.current = playing;
    }, [playing, savePosition]);

    const onChangeBar = () => {
        // Read back from bar.current.value (the position we just asked for),
        // not engine.getCurrentTime() — that can lag a requested seek by a
        // frame or more, which desynced the filled portion of the bar (driven
        // by this state) from the seek thumb (driven directly by the input's
        // own value).
        const seekTime = Number(bar.current.value);
        engine.seek(seekTime);
        syncBar(seekTime);
        updateElapsed(seekTime, { seeked: true });
    };

    const handleStartOver = () => {
        startOver();
        engine.seek(0);
        syncBar(0);
        updateElapsed(0);
    };

    const HandlePlaying = async () => {
        if (!engine.ready) {
            console.error('Audio not ready yet');
            return;
        }

        if (playing) {
            engine.pause();
            return;
        }
        try {
            await engine.play();
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    const BackTime = () => {
        bar.current.value = Number(bar.current.value - 10);
        onChangeBar();
    };

    const ForwardTime = () => {
        bar.current.value = Number(bar.current.value) + 10;
        onChangeBar();
    };

    // Auto-advance through the queue; after its last item, stop and rewind.
    onEndedRef.current = () => {
        finished();
        if (nextItem) return;
        engine.seek(0);
        updateElapsed(0);
        syncBar(0);
    };

    const volumeChange = () => {
        engine.setVolume(Number(volumeControl.current.value));
    };

    const saveHandle = () => {
        if (verificationSaved) return;
        dispatch({
            type: "ADD_TO_FAVORITES",
            payload: item,
        });
        like(item.id);
    };

    const delHandle = () => {
        if (!verificationSaved) return;
        dispatch({
            type: "REMOVE_FROM_FAVORITES",
            payload: item.id,
        });
    };

    const verificationSaved = sounds.some((element) => element.id === item.id);

    // The console's first window (grid area "window" in .faceplate, see
    // components/modal.jsx): the mandatory-visible YouTube window in iframe
    // mode, the track thumbnail otherwise. Rendered as a sibling of the
    // transport panel (this component returns both cells as a fragment) so it
    // lands directly in Modal's grid — no portal needed.
    const windowContent = engine.engine === 'iframe' ? (
        // The YT IFrame API replaces whatever DOM node containerRef points at
        // with its own <iframe> (documented behavior, not a bug) — so the ref
        // sits on this plain inner placeholder, and .iframeEngineMount stays on
        // the outer div, which YouTube never touches and which is what
        // actually needs the border/glow/scanline/retint framing to survive.
        // data-pip-window: lets page CSS know a floating PiP window may be
        // covering the bottom-right corner (see .listEnd in soundlist.module.css).
        <div className={styles.iframeEngineMount} data-pip-window="">
            <div ref={engine.containerRef} />
        </div>
    ) : (
        <div className={styles.player__img}>
            <img src={item.thumbnail} alt="" />
        </div>
    );

    return (
        <>
        {windowContent}
        <div className={`${styles.player__panel} hud-frame`}>
            <div
                className={[
                    styles.vuMeter,
                    vuBouncing && styles.vuMeterActive,
                    fading && styles.vuMeterFading,
                ].filter(Boolean).join(' ')}
                aria-hidden="true"
            >
                {VU_BARS.map((vars, i) => (
                    <span key={i} className={styles.vuMeter__bar} style={vars} />
                ))}
            </div>
            <div className={styles.player__bar__container}>
                <input
                    ref={bar}
                    type="range"
                    className={styles.bar}
                    defaultValue={0}
                    // Same source (item.duration) as --bar-progress (syncBar) —
                    // this used to be set imperatively from the <audio>
                    // element's own .duration in an effect, but that reads as
                    // NaN until the stream's metadata finishes loading
                    // asynchronously, so it silently kept the native max=100
                    // default. That desynced the thumb (native max-based
                    // position) from the green fill (item.duration-based),
                    // most visible after a seek moved the thumb far past
                    // where the fill thought the track was.
                    max={item.duration || 0}
                    onChange={onChangeBar}
                />
            </div>

            {/* The console's "master clock" + track text — sits between the
                bars above and the button row below, cassette-deck style (VU
                meters up top, LCD readout in the middle, transport buttons at
                the bottom). Used to be portaled up into Modal's windowsRow
                instead; rendered directly here now since Player already owns
                `item` — no cross-component slot needed for content that never
                actually needed to leave this render. */}
            <div className={styles.trackReadout}>
                <div className={styles.masterTimer}>
                    <span className={styles.masterTimer__elapsed}>{ConvertSecToMin(currentTime)}</span>
                    <span className={styles.masterTimer__sep}>-</span>
                    <span className={styles.masterTimer__total}>{duration}</span>
                </div>
                <div className={reason ? `${styles.metaText} ${styles.metaTextReason}` : styles.metaText}>
                    <h2>{item.channel?.name || 'Unknown channel'}</h2>
                    <MarqueeText text={item.title} className={styles.player__title} />
                    {reason && (
                        <p className={styles.reasonLine}>
                            <span className={styles.reasonLine__text}>
                                {reason.seed ? `Similar vibe to ${reason.seed}` : radio.tags.length ? `Vibe: ${radio.tags[0]}` : 'Similar vibe'}
                                {reason.sharedTags.length > 0 && ` · ${reason.sharedTags.join(', ')}`}
                            </span>
                            <a href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a>
                        </p>
                    )}
                    {tags.length > 0 && (
                        <ul className={styles.tagChips} aria-label="More like these tags, from Last.fm">
                            <li className={styles.tagChips__label} aria-hidden="true">More like</li>
                            {tags.slice(0, MAX_TAG_CHIPS).map((tag) => (
                                <li key={tag}>
                                    <button
                                        type="button"
                                        onClick={() => browseVibe(tag)}
                                        aria-pressed={browseTag === tag || radio.tags[0] === tag}
                                        title={`Show more like ${tag}`}
                                    >
                                        {tag}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {resumedAt > 0 && (
                        <p className={`${styles.reasonLine} ${styles.reasonLineDim}`}>
                            <span className={styles.reasonLine__text}>Resumed at {ConvertSecToMin(resumedAt)} ·</span>
                            <button type="button" className={styles.reasonLine__action} onClick={handleStartOver}>
                                Start over
                            </button>
                        </p>
                    )}
                    {unidentified && (
                        <p className={`${styles.reasonLine} ${styles.reasonLineDim}`}>
                            <span className={styles.reasonLine__text}>This song couldn&apos;t be identified</span>
                        </p>
                    )}
                </div>
            </div>

            <div className={styles.player__controls__container}>
                <div className={`${styles.controlUnit} ${styles.favUnit}`}>
                    <button
                        onClick={verificationSaved ? delHandle : saveHandle}
                        className={verificationSaved ? `${styles.button} ${styles.buttonAccent}` : styles.button}
                        aria-label={verificationSaved ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        {verificationSaved ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
                    </button>
                    <span className={styles.controlLabel}>Fav</span>
                </div>
                <div className={styles.button__group}>
                    {engine.engine === 'native' && (
                        <audio ref={engine.audioRef} src={engine.audioUrl} preload="auto" autoPlay />
                    )}

                    <div className={`${styles.controlUnit} ${styles.trackUnit} ${styles.prevUnit}`}>
                        <button
                            className={styles.button}
                            onClick={prev}
                            disabled={!prevItem}
                            aria-label={prevItem ? `Previous track: ${prevItem.title}` : 'Previous track'}
                            title={prevItem ? `Previous: ${prevItem.title}` : 'No previous track'}
                        >
                            <FaStepBackward aria-hidden="true" />
                        </button>
                        <span className={styles.controlLabel}>Prev</span>
                    </div>

                    <div className={`${styles.controlUnit} ${styles.seekUnit}`}>
                        <button className={styles.button} onClick={BackTime} aria-label="Back 10 seconds">
                            <FaBackward className={styles.backward} />
                        </button>
                        <span className={styles.controlLabel}>Rew</span>
                    </div>

                    <div className={playing ? `${styles.controlUnit} ${styles.controlUnitActive}` : styles.controlUnit}>
                        <button
                            className={styles.button}
                            onClick={HandlePlaying}
                            disabled={!engine.ready || !!engine.error}
                            aria-label={engine.error ? engine.error : !engine.ready ? 'Loading' : playing ? 'Pause' : 'Play'}
                        >
                            {engine.error ? (
                                <span aria-hidden="true">!</span>
                            ) : !engine.ready ? (
                                <FaSpinner className={styles.spinner} aria-hidden="true" />
                            ) : playing ? (
                                <FaPause className={styles.pause} aria-hidden="true" />
                            ) : (
                                <FaPlay className={styles.play} aria-hidden="true" />
                            )}
                        </button>
                        <span className={styles.controlLabel}>{playing ? 'Pause' : 'Play'}</span>
                    </div>

                    <div className={`${styles.controlUnit} ${styles.seekUnit}`}>
                        <button className={styles.button} onClick={ForwardTime} aria-label="Forward 10 seconds">
                            <FaForward className={styles.forward} />
                        </button>
                        <span className={styles.controlLabel}>Fwd</span>
                    </div>

                    <div className={`${styles.controlUnit} ${styles.trackUnit}`}>
                        <button
                            className={styles.button}
                            onClick={next}
                            disabled={!nextItem}
                            aria-label={nextItem ? `Next track: ${nextItem.title}` : 'Next track'}
                            title={nextItem ? `Next: ${nextItem.title}` : 'No next track'}
                        >
                            <FaStepForward aria-hidden="true" />
                        </button>
                        <span className={styles.controlLabel}>Next</span>
                    </div>
                </div>

                <div className={styles.volumeGroup}>
                    <div className={styles.controlUnit}>
                        <button
                            onClick={() => setVisible(!volVisible)}
                            className={styles.btn__vol}
                            aria-label={volVisible ? 'Hide volume slider' : 'Show volume slider'}
                        >
                            <FaVolumeUp aria-hidden="true" />
                        </button>
                        <span className={styles.controlLabel}>Vol</span>
                    </div>
                    <input
                        onChange={volumeChange}
                        ref={volumeControl}
                        type="range"
                        defaultValue={100}
                        className={!volVisible ? `${styles.volHide}` : `${styles.volShow}`}
                    />
                </div>
            </div>
        </div>
        </>
    );
};

export default Player;