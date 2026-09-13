import { useState } from "react"
import Backdrop from "./backdrop";
import styles from '../styles/player.module.css'
import Player from '../components/player'
import GlobePanel from '../components/globePanel'
import MarqueeText from './marqueeText'
import { FaTimes } from 'react-icons/fa'
import { RemoveSpecialChar } from "../utils/removeSpecialChar"

// Matches the console-out/backdrop-out keyframe durations in player.module.css —
// keeps the modal mounted long enough to play its own ease-in exit instead of
// popping off the instant the user clicks close/backdrop.
const CLOSE_ANIMATION_MS = 200

const Modal = ({ triggerModal, item }) => {
    const [closing, setClosing] = useState(false)
    const titlefix = RemoveSpecialChar(item.title)

    const requestClose = () => {
        if (closing) return
        setClosing(true)
        setTimeout(triggerModal, CLOSE_ANIMATION_MS)
    }

    return (
        <Backdrop onClick={requestClose} closing={closing}>
            <div
                className={`${styles.console} hud-frame ${closing ? styles.consoleClosing : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.console__header}>
                    <span className={styles.console__headerLabel}>NOW PLAYING // SIG. LOCK</span>
                    <button className={styles.btn__close} onClick={requestClose}><FaTimes /></button>
                </div>

                <div className={styles.faceplate}>
                    <div className={styles.windowsRow}>
                        <div className={styles.player__img}>
                            <img src={item.thumbnail} alt="image_thumbnail" />
                        </div>
                        <div className={styles.deckWindow}>
                            <GlobePanel />
                        </div>
                        <div className={`${styles.player__meta} hud-frame`}>
                            <h2>{item.channel.verified ? item.channel.name : `No Oficial: ${item.channel.name}`}</h2>
                            <MarqueeText text={titlefix} className={styles.player__title} />
                        </div>
                    </div>

                    <Player item={item} />
                </div>

                <div className={styles.console__footer}>
                    <span>PLAYERSOUND-84</span>
                </div>
            </div>
        </Backdrop>
    )
}
export default Modal
