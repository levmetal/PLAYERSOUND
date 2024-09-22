
import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp, FaSpinner } from 'react-icons/fa'; // Agregar FaSpinner para la señal de carga
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
  const [audioReady, setAudioReady] = useState(false); // Para indicar si el audio está listo
  const [loading, setLoading] = useState(true); // Estado de carga
  const player = useRef();
  const bar = useRef();
  const animationRef = useRef();
  const volumeControl = useRef();
  const titlefix = RemoveSpecialChar(item.title);
  const duration = ConvertSecToMin(item.duration);
  const sounds = useSoundContext();
  const dispatch = useDispatchContext();
  const hasFetched = useRef(false);

  // Solicitar la URL del audio al servidor local
  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (hasFetched.current) return;  // Evitar la segunda solicitud
      setLoading(true); // Establecer el estado de carga a true cuando comienza la solicitud

      try {
        const response = await axios.get(`https://sever-playersound.onrender.com/audio?id=${item.id}`);
        setAudioUrl(response.data.audioUrl);
        hasFetched.current = true;
      } catch (error) {
        console.error('Error fetching audio URL:', error);
      } finally {
        setLoading(false); // Establecer el estado de carga a false cuando la solicitud termine
      }
    };

    fetchAudioUrl();
  }, [item.id]);

  // Asegurar que la barra de progreso refleje la duración del audio
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

  const HandlePlaying = () => {
    if (!audioReady || !audioUrl) {
      console.error('Audio not ready yet');
      return;
    }

    const preValue = playing;
    setPlaying(!preValue);

    if (!preValue) {
      player.current.play().catch(error => console.error('Error playing audio:', error));
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
    player.current.load();
    HandlePlaying();
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

  const even = (element) => element.id === item.id;
  const verificationSaved = sounds.some(even);

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
                  onLoadedData={() => {
                    setAudioReady(true); // Indicar que el audio está listo
                    setLoading(false); // Detener la carga
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
                {/* Mostrar spinner si está cargando */}
                {loading ? (
                  <FaSpinner className={styles.spinner} />
                ) : (
                  playing ? <FaPause className={styles.pause} /> : <FaPlay className={styles.play} />
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
