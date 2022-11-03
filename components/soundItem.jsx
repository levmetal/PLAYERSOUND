
import styles from "../styles/soundlist.module.css"
import { FaPlus, FaPlay, FaCheckCircle, FaCheck } from 'react-icons/fa'
import { useDispatchContext, useSoundContext } from "../context/libraryContext/libraryContext"
import { useState, lazy, Suspense, useReducer } from "react";
import { RemoveSpecialChar } from "../utils/removeSpecialChar";
import { v4 as uuidv4 } from 'uuid';


const Modal = lazy(() => import('./modal'))


const SoundItem = ({ item ,triggerModal}) => {

    const dispatch = useDispatchContext()
    const sounds = useSoundContext()

    const [play, setPlay] = useState(false)


    const handlePlay = () => {

        setPlay(!play)
      
    }



    const titlefix = RemoveSpecialChar(item.title)

    const even = (element) => element.id === item.id
    const verificationSaved = sounds.some(even)

    const AddLibrary = (item) => {


        if (verificationSaved) {
            return alert("The sound is already saved in the library ")

        } else {
            dispatch({
                type: "addLibrary",
                payload: item
            })

        }

    }
    const delLibrary = (id) => {


        if (verificationSaved) {
            dispatch({
                type: "delLibrary",
                payload: id
            })
            return alert("The sound is deleted ")

        } 

    }


    return (
        <>
            <div key={item.id} className={styles.item}>

                <div className={styles.img__container}>
                    <div onClick={()=>triggerModal(item)} className={styles.img__coverPlay}><FaPlay key={uuidv4()} className={styles.coverPlay__icon} /></div>
                    <img src={item.thumbnail} alt="image-song" />

                    <button

                        className={styles.addBtn}
                        onClick={!verificationSaved ? () => AddLibrary(item):() => delLibrary(item.id)}
                    >{verificationSaved ? <FaCheck /> : <FaPlus />}</button>


                </div>

                <h2 >{item.channel.verified ? item.channel.name : `No Oficial: ${item.channel.name}`}</h2>

                <li key={uuidv4()}>
                    <span>{titlefix}</span>

                </li>




            </div>
           

        </>
    )
}
export default SoundItem