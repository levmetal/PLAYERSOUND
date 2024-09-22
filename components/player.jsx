
import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp } from 'react-icons/fa';
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import { RemoveSpecialChar } from "../utils/removeSpecialChar";
import styles from '../styles/player.module.css';
import { useSoundContext, useDispatchContext } from "../context/libraryContext/libraryContext";
import axios from 'axios';

const Player = ({ item }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volVisible, setVisible] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null); // Estado para guardar la URL del audio
  const player = useRef();
  const bar = useRef();
  const animationRef = useRef();
  const volumeControl = useRef();
  const titlefix = RemoveSpecialChar(item.title);
  const duration = ConvertSecToMin(item.duration);
  const sounds = useSoundContext();
  const dispatch = useDispatchContext();

  // Solicitar la URL del audio al servidor local
  useEffect(() => {
    const fetchAudioUrl = async () => {
      try {
        const response = await axios.get(`http://localhost:4000/audio?id=${item.id}`);
        console.log(response.data.audioUrl);
        setAudioUrl(response.data.audioUrl);
         // Guardamos la URL en el estado
      } catch (error) {
        console.error('Error fetching audio URL:', error);
      }
    };
    
    fetchAudioUrl();
  }, [item.id]); // Dependemos del id del video para hacer la solicitud

  useEffect(() => {
    bar.current.max = item.duration;
  }, [player?.current?.loadedmetadata, player?.current?.readyState]);

  const whileIsPlaying = () => {
    try {
      bar.current.value = player.current.currentTime;
      setCurrentTime(bar.current.value);
      animationRef.current = requestAnimationFrame(whileIsPlaying);
    } catch (error) {
      animationRef.current = cancelAnimationFrame(animationRef.current);
    }
  };

  const onChangeBar = () => {
    player.current.currentTime = bar.current.value;
    setCurrentTime(player.current.currentTime);
  };

  const HandlePlaying = () => {
    const preValue = playing;
    setPlaying(!preValue);
  
    // Verificar si el ref 'player' está disponible y si hay una URL cargada
    if (!player.current || !audioUrl) {
      console.error('El reproductor de audio no está disponible o la URL del audio no se ha cargado.');
      return;
    }
  
    if (!preValue) {
      // Asegurarse de que el reproductor pueda reproducir
      player.current.play().catch(error => console.error('Error al intentar reproducir:', error));
      animationRef.current = requestAnimationFrame(whileIsPlaying);
    } else {
      player.current.pause();
      animationRef.current = cancelAnimationFrame(animationRef.current);
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
      return alert("The sound is already saved in the library ");
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

  const handelPause = () => player.current.pause();

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
              {/* Aquí cargamos la URL del audio cuando está disponible */}
              {audioUrl && <audio onEnded={endendFunction} ref={player} src={audioUrl} />}

              <button className={styles.button} onClick={BackTime}>
                <FaBackward className={styles.backward} />
              </button>

              <button className={styles.button} onClick={HandlePlaying}>
                {playing ? <FaPause className={styles.pause} /> : <FaPlay className={styles.play} />}
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
