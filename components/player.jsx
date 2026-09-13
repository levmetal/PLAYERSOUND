import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp, FaSpinner } from 'react-icons/fa';
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import styles from '../styles/player.module.css';
import { useSoundContext, useDispatchContext } from "../context/libraryContext/libraryContext";

const audioApiBase = process.env.NEXT_PUBLIC_AUDIO_API_BASE || '';

// Purely decorative — a neon VU-meter bar-graph above the seek bar, staggered
// via --vu-i so the bars don't bounce in lockstep. Not driven by real audio
// analysis, same spirit as the loader's fake telemetry readouts.
const VU_BARS = Array.from({ length: 20 });

const Player = ({ item }) => {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volVisible, setVisible] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const player = useRef();
    const bar = useRef();
    const animationRef = useRef();
    const volumeControl = useRef();
    const duration = ConvertSecToMin(item.duration);
    const sounds = useSoundContext();
    const dispatch = useDispatchContext();

    // The <audio> element streams progressively straight from the resolver
    // endpoint (Range/206 aware) instead of buffering the whole file first.
    const audioUrl = `${audioApiBase}/api/soundplayer/${item.id}`;

    useEffect(() => {
        setLoading(true);
        setAudioReady(false);
        setError(null);
    }, [item.id]);

    const whileIsPlaying = () => {
        try {
            bar.current.value = player.current.currentTime;
            setCurrentTime(bar.current.value);
            animationRef.current = requestAnimationFrame(whileIsPlaying);
        } catch (error) {
            cancelAnimationFrame(animationRef.current);
        }
    };

    const onChangeBar = () => {
        // Read back from bar.current.value (the position we just asked for),
        // not player.current.currentTime — the <audio> element's currentTime
        // can lag behind a requested seek by a frame or more, which desynced
        // the filled portion of the bar (driven by this state) from the seek
        // thumb (driven directly by the input's own value).
        const seekTime = Number(bar.current.value);
        player.current.currentTime = seekTime;
        setCurrentTime(seekTime);
    };

    const HandlePlaying = async () => {
        if (!audioReady || !audioUrl) {
            console.error('Audio not ready yet');
            return;
        }

        const preValue = playing;
        setPlaying(!preValue);

        if (!preValue) {
            try {
                await player.current.play();
            } catch (error) {
                console.error('Error playing audio:', error);
            }
            animationRef.current = requestAnimationFrame(whileIsPlaying);
        } else {
            player.current.pause();
            cancelAnimationFrame(animationRef.current);
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

    const endendFunction = () => {
        player.current.load(); // Reset audio to start
        HandlePlaying(); // Auto-play next?  (Adjust logic if needed)
        setCurrentTime(0);
        bar.current.value = 0;
    };

    const volumeChange = () => {
        let realVolumeScale = volumeControl.current.value / 100;
        player.current.volume = realVolumeScale;
    };

    const saveHandle = () => {
        if (verificationSaved) return;
        dispatch({
            type: "ADD_TO_FAVORITES",
            payload: item,
        });
    };

    const delHandle = () => {
        if (!verificationSaved) return;
        dispatch({
            type: "REMOVE_FROM_FAVORITES",
            payload: item.id,
        });
    };

    const verificationSaved = sounds.some((element) => element.id === item.id);

    return (
        <div className={`${styles.player__panel} hud-frame`}>
            <div
                className={playing ? `${styles.vuMeter} ${styles.vuMeterActive}` : styles.vuMeter}
                aria-hidden="true"
            >
                {VU_BARS.map((_, i) => (
                    <span key={i} className={styles.vuMeter__bar} style={{ '--vu-i': i }} />
                ))}
            </div>
            <div className={styles.player__bar__container}>
                <div className={`${styles.time} ${styles.currentime}`}>{ConvertSecToMin(currentTime)}</div>
                <input
                    ref={bar}
                    type="range"
                    className={styles.bar}
                    defaultValue={0}
                    // Same source (item.duration) as --bar-progress below —
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
                    style={{ '--bar-progress': item.duration ? (currentTime / item.duration) * 100 : 0 }}
                />
                <div className={`${styles.time} ${styles.durationTotal}`}>{duration}</div>
            </div>

            <div className={styles.player__controls__container}>
                <div className={styles.controlUnit}>
                    <button
                        onClick={verificationSaved ? delHandle : saveHandle}
                        className={verificationSaved ? `${styles.button} ${styles.buttonAccent}` : styles.button}
                    >
                        {verificationSaved ? <FaHeart /> : <FaRegHeart />}
                    </button>
                    <span className={styles.controlLabel}>Fav</span>
                </div>
                <div className={styles.button__group}>
                    <audio
                        onCanPlay={() => {
                            setAudioReady(true);
                            setLoading(false);
                        }}
                        onError={() => {
                            setError('No se pudo cargar el audio de este video.');
                            setLoading(false);
                        }}
                        onEnded={endendFunction}
                        ref={player}
                        src={audioUrl}
                        preload="auto"
                    />

                    <div className={styles.controlUnit}>
                        <button className={styles.button} onClick={BackTime}>
                            <FaBackward className={styles.backward} />
                        </button>
                        <span className={styles.controlLabel}>Rew</span>
                    </div>

                    <div className={playing ? `${styles.controlUnit} ${styles.controlUnitActive}` : styles.controlUnit}>
                        <button className={styles.button} onClick={HandlePlaying} disabled={loading || !!error}>
                            {error ? (
                                <span title={error}>!</span>
                            ) : loading ? (
                                <FaSpinner className={styles.spinner} />
                            ) : playing ? (
                                <FaPause className={styles.pause} />
                            ) : (
                                <FaPlay className={styles.play} />
                            )}
                        </button>
                        <span className={styles.controlLabel}>{playing ? 'Pause' : 'Play'}</span>
                    </div>

                    <div className={styles.controlUnit}>
                        <button className={styles.button}>
                            <FaForward onClick={ForwardTime} className={styles.forward} />
                        </button>
                        <span className={styles.controlLabel}>Fwd</span>
                    </div>
                </div>

                <div className={styles.volumeGroup}>
                    <div className={styles.controlUnit}>
                        <button onClick={() => setVisible(!volVisible)} className={styles.btn__vol}>
                            <FaVolumeUp />
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
    );
};

export default Player;