import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp, FaSpinner } from 'react-icons/fa';
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import { RemoveSpecialChar } from "../utils/removeSpecialChar";
import styles from '../styles/player.module.css';
import { useSoundContext, useDispatchContext } from "../context/libraryContext/libraryContext";
import axios from 'axios';

const Player = ({ item }) => {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volVisible, setVisible] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioReady, setAudioReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const player = useRef();
    const bar = useRef();
    const animationRef = useRef();
    const volumeControl = useRef();
    const titlefix = RemoveSpecialChar(item.title);
    const duration = ConvertSecToMin(item.duration);
    const sounds = useSoundContext();
    const dispatch = useDispatchContext();
    const hasFetched = useRef(false);

    useEffect(() => {
        const fetchAudioUrl = async () => {
            if (hasFetched.current) return;
            setLoading(true);
    
            try {
                const response = await axios.get(`https://yt-audio-l01p.onrender.com/audio/${item.id}`, {
                    timeout: 600000,
                    responseType: 'blob' // Request response as Blob
                });
    
                // Convert Blob to Data URL
                const blob = new Blob([response.data], { type: 'audio/mpeg' });
                const dataUrl = URL.createObjectURL(blob);
                setAudioUrl(dataUrl); // Set Data URL as audioUrl
                hasFetched.current = true;
    
            } catch (error) {
                console.error('Error fetching audio URL:', error);
            } finally {
                setLoading(false);
            }
        };
    
        fetchAudioUrl();
    }, [item.id]);

    useEffect(() => {
        if (player.current && player.current.duration) {
            bar.current.max = player.current.duration;
        }
    }, [audioUrl]);

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
        player.current.currentTime = bar.current.value;
        setCurrentTime(player.current.currentTime);
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
        setPlaying(false); // Pause after forward, adjust as needed
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
        if (verificationSaved) {
            return alert("The sound is already saved in the library");
        } else {
            dispatch({
                type: "addLibrary",
                payload: item,
            });
        }
    };

    const delHandle = () => {
        if (verificationSaved) {
            dispatch({
                type: "delLibrary",
                payload: item.id,
            });
            return alert("The sound is deleted from library");
        }
    };

    const verificationSaved = sounds.some((element) => element.id === item.id);

    return (
        <>
            <div className={styles.player__container}>
                <h2>{item.channel.verified ? item.channel.name : `No Oficial: ${item.channel.name}`}</h2>
                <span>{titlefix}</span>
                <div className={styles.player__panel}>
                    <div className={styles.player__bar__container}>
                        <div className={`${styles.time} ${styles.currentime}`}>{ConvertSecToMin(currentTime)}</div>
                        <input ref={bar} type="range" className={styles.bar} defaultValue={0} onChange={onChangeBar} />
                        <div className={`${styles.time} ${styles.durationTotal}`}>{duration}</div>
                    </div>

                    <div className={styles.player__controls__container}>
                        <div className={styles.fav}>
                            <button onClick={verificationSaved ? delHandle : saveHandle} className={styles.button}>
                                {verificationSaved ? <FaHeart /> : <FaRegHeart />}
                            </button>
                        </div>
                        <div className={styles.button__group}>
                            {audioUrl && (
                                <audio
                                    type='audio/mpeg' // Changed to audio/mpeg to match backend header
                                    onLoadedData={() => {
                                        setAudioReady(true);
                                        setLoading(false);
                                    }}
                                    onEnded={endendFunction}
                                    ref={player}
                                    src={audioUrl}
                                />
                            )}

                            <button className={styles.button} onClick={BackTime}>
                                <FaBackward className={styles.backward} />
                            </button>

                            <button className={styles.button} onClick={HandlePlaying} disabled={loading}>
                                {loading ? (
                                    <FaSpinner className={styles.spinner} />
                                ) : playing ? (
                                    <FaPause className={styles.pause} />
                                ) : (
                                    <FaPlay className={styles.play} />
                                )}
                            </button>

                            <button className={styles.button}>
                                <FaForward onClick={ForwardTime} className={styles.forward} />
                            </button>
                        </div>

                        <button onClick={() => setVisible(!volVisible)} className={styles.btn__vol}>
                            <FaVolumeUp />
                        </button>
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