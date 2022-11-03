import Backdrop from "./backdrop";
import styles from '../styles/player.module.css'
import Player from '../components/player'
import {FaPlus} from 'react-icons/fa'

const Modal = ({ triggerModal,item }) => {
    return(<Backdrop>
        <div
            className={styles.modal}  

        >
             <img src={item.thumbnail} className={styles.img__bg}/>
            <div  className={styles.player__img}>

            <img src={item.thumbnail} alt="image_thumbnail"/>
            </div>
            <Player item={item}/>
            <button className={styles.btn__close} onClick={triggerModal }><FaPlus/></button>

        </div>
    </Backdrop>
)}
export default Modal