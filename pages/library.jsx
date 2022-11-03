import { v4 as uuidv4 } from 'uuid';
import { useSoundContext } from "../context/libraryContext/libraryContext";
import Layout from '../components/layout'
import styles from '../styles/library.module.css'
import SoundItem from "../components/soundItem";
import { useState ,Suspense,lazy} from "react";

const Modal = lazy(() => import('../components/modal'))
const Library = () => {

    const sounds = useSoundContext()
    const [openModal, setOpenModal] = useState(false)
    const [itemModal, setItemModal] = useState(null)

    const triggerModal = (itemModal) => {
        setOpenModal(!openModal)
        setItemModal(itemModal)
    }

    return (
        <Layout>

            <div className={styles.container}>
            {openModal && <Suspense> <Modal item={itemModal} triggerModal={triggerModal} /> </Suspense>}
                <h2 className={styles.library__title}>Library</h2>
                <ul className={styles.list__container}>
                    {
                        sounds.map(sound => {
                            return (
                                <SoundItem
                                    key={uuidv4()}
                                    item={sound}
                                    triggerModal={triggerModal}
                                />

                            )
                        })
                    }
                </ul>
            </div>
        </Layout>
    )
}
export default Library