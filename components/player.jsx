
import { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaBackward, FaPause, FaRegHeart, FaHeart, FaVolumeUp } from 'react-icons/fa';
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import { RemoveSpecialChar } from "../utils/removeSpecialChar";
import styles from '../styles/player.module.css'
import { useSoundContext, useDispatchContext } from "../context/libraryContext/libraryContext";



const Player = ({ item }) => {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volVisible, setVisible] = useState(false)

  const player = useRef()
  const bar = useRef()
  const animationRef = useRef()
  const volumeControl = useRef()
  const titlefix = RemoveSpecialChar(item.title)
  const duration = ConvertSecToMin(item.duration)
  const sounds = useSoundContext()
  const dispatch = useDispatchContext()

  useEffect(() => {

    bar.current.max = item.duration

  }, [player?.current?.loadedmetadata, player?.current?.readyState])




  const whileIsPlaying = () => {

   try {
    bar.current.value = player.current.currentTime
    setCurrentTime(bar.current.value)
    animationRef.current = requestAnimationFrame(whileIsPlaying)
   } catch (error) {
    animationRef.current = cancelAnimationFrame(animationRef.current)
   }
    


  }

  const onChangeBar = () => {
    if (item.duration === currentTime) {
      player.current.currentTime = bar.current.value

      setCurrentTime(player.current.currentTime)
    }
    player.current.currentTime = bar.current.value

    setCurrentTime(player.current.currentTime)
  }


  const HandlePlaying = () => {

    const preValue = playing

    setPlaying(!preValue)

    if (!preValue) {
      player.current.play()
      animationRef.current = requestAnimationFrame(whileIsPlaying)

    } else {
      player.current.pause()
      animationRef.current = cancelAnimationFrame(animationRef.current)
    }

  }
  const BackTime = () => {


    bar.current.value = Number(bar.current.value - 10)


    onChangeBar()

  }
  const ForwardTime = () => {
    bar.current.value = Number(bar.current.value) + 10

    onChangeBar()

  }

  const endendFunction = () => {

    player.current.load()

    HandlePlaying()
    setCurrentTime(0)
    bar.current.value = 0
  }

  const volumeChange = () => {
    let realVolumeScale = volumeControl.current.value / 100
    console.log(realVolumeScale)
    player.current.volume = realVolumeScale
  }

  const saveHandle = () => {
    if (verificationSaved) {
      return alert("The sound is already saved in the library ")

    } else {
      dispatch({
        type: "addLibrary",
        payload: item
      })

    }
  }
  const delHandle = () => {


    if (verificationSaved) {
      dispatch({
        type: "delLibrary",
        payload: item.id
      })
      return alert("The sound is deleted from library")

    }

  }
  const handelPause = () => player.current.pause()

  const even = (element) => element.id === item.id
  const verificationSaved = sounds.some(even)

  return (
    <>
      <div className={styles.player__container}>


        <h2>{item.channel.verified ? item.channel.name : `No Oficial: ${item.channel.name}`}</h2>

        <span>{titlefix}</span>

        <div className={styles.player__panel}>

          <div className={styles.player__bar__container}>
            <div className={`${styles.time} ${styles.currentime}`}>{ConvertSecToMin(currentTime)}</div>
            <input ref={bar}
              type='range'
              className={styles.bar}
              defaultValue={0}
              onChange={onChangeBar}
            />
            <div className={`${styles.time} ${styles.durationTotal} `}>{duration}</div>
          </div>

          <div className={styles.player__controls__container}>
            <div className={styles.fav}>
              <button onClick={verificationSaved ? delHandle : saveHandle} className={styles.button}>{verificationSaved ? < FaHeart /> : < FaRegHeart />}</button>

            </div>
            <div className={styles.button__group}> 
              <audio onEnded={endendFunction}  ref={player} src={`https://sever-playersound.onrender.com/audio?id=${item.id}`} />

              <button className={styles.button} onClick={BackTime}><FaBackward className={styles.backward} /></button>

              <button className={styles.button} onClick={HandlePlaying}>{playing ? <FaPause className={styles.pause} /> : <FaPlay className={styles.play} />}</button>


              <button className={styles.button}><FaForward onClick={ForwardTime} className={styles.forward} /></button>



            </div>


            <button
              onClick={() => setVisible(!volVisible)}
              className={styles.btn__vol}
            ><FaVolumeUp />
            </button>
            <input

              onChange={volumeChange}
              ref={volumeControl}
              type="range"
              defaultValue={100}
              className={!volVisible ? `${styles.volHide}` : `${styles.volShow}`} />


          </div>


        </div>

      </div>
    </>
  )
}
export default Player

