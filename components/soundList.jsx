import { useState, Suspense } from "react";
import { v4 as uuidv4 } from 'uuid';
import { handleScrollright, handleScrollLeft } from '../utils/handleScroll.js'
import { HiArrowSmRight, HiArrowSmLeft } from 'react-icons/hi';
import { useRef } from "react";
import { useSoundContext } from "../context/libraryContext/libraryContext.js";
import dynamic from 'next/dynamic'
import styles from "../styles/soundlist.module.css"
const SoundItem = dynamic(() => import('./soundItem'), { Suspense: true })


const Modal = dynamic(() => import('../components/modal'), { Suspense: true })

const SoundList = ({ dataSearch }) => {

  const library = useSoundContext()
  const scrollSearchList = useRef()
  const [openModal, setOpenModal] = useState(false)
  const [itemModal, setItemModal] = useState(null)

  const triggerModal = (itemModal) => {
    setOpenModal(!openModal)
    setItemModal(itemModal)
  }

  return (
    <div className={styles.soundlist__container}>


      {openModal && <Suspense fallback={`Loading`}> <Modal item={itemModal} triggerModal={triggerModal} /> </Suspense>}

      <ul ref={scrollSearchList} className={styles.searchlist}>

        <button
          key={uuidv4()}
          onClick={() => handleScrollLeft(scrollSearchList)}
          className={styles.sliderleft} >

          <HiArrowSmLeft
            key={uuidv4()}
            style={{ width: "1.5rem", height: "1.5rem", alignSelf: "center" }}
          />

        </button>


        {
          dataSearch[0].map(item => {

            return (

              <Suspense fallback={`Loading`} >

                <SoundItem
                  key={uuidv4()}
                  item={item}
                  triggerModal={triggerModal}
                />

              </Suspense>

            )
          })

        }

        <button
          key={uuidv4()}
          onClick={() => handleScrollright(scrollSearchList)}
          className={styles.slideright}>
          <HiArrowSmRight
            key={uuidv4()}
            style={{ width: "1.5rem", height: "1.5rem", alignSelf: "center" }}
          />
        </button>
      </ul>


      <div className={styles.itemlibrary__categories}>


        <h2 className={styles.titleLibrary}>Library sounds </h2>
        <ul className={styles.soundlist__library}>
          {
            library.map((item) => {
              return (
                <Suspense fallback={`Loading`}>
                  <SoundItem
                    key={uuidv4()}
                    item={item}
                    triggerModal={triggerModal}
                  />
                </Suspense>
              )

            })

          }
        </ul>
        <h2 className={styles.titleCategories}>Categories </h2>

        <ul className={styles.categories__container}>

          <li title="Will be implemented soon" key={uuidv4()} ><span>Rock</span></li>
          <li title="Will be implemented soon" key={uuidv4()}><span>Pop</span></li>
          <li title="Will be implemented soon" key={uuidv4()}><span>Rap</span></li>
          <li title="Will be implemented soon" key={uuidv4()}><span>{`R&B`}</span></li>


        </ul>

      </div>
    </div>
  )
}
export default SoundList
