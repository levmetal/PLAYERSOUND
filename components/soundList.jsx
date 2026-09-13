import { useMemo, useState, Suspense } from "react";
import dynamic from 'next/dynamic'
import styles from "../styles/soundlist.module.css"
import { SORT_OPTIONS, DURATION_FILTERS, applySort, applyDurationFilter, groupByChannel } from "../utils/sortSearchResults";
const SoundItem = dynamic(() => import('./soundItem'), { Suspense: true })


const Modal = dynamic(() => import('../components/modal'), { Suspense: true })

const SoundList = ({ dataSearch }) => {

  const [openModal, setOpenModal] = useState(false)
  const [itemModal, setItemModal] = useState(null)
  const [sortKey, setSortKey] = useState("relevance")
  const [durationKey, setDurationKey] = useState("all")
  const [groupByChannelOn, setGroupByChannelOn] = useState(false)

  const triggerModal = (itemModal) => {
    setOpenModal(!openModal)
    setItemModal(itemModal)
  }

  const results = dataSearch[0]

  const processedResults = useMemo(
    () => applySort(applyDurationFilter(results, durationKey), sortKey),
    [results, sortKey, durationKey]
  )

  const grouped = useMemo(
    () => (groupByChannelOn ? groupByChannel(processedResults) : null),
    [groupByChannelOn, processedResults]
  )

  return (
    <div className={styles.soundlist__container}>

      {openModal && <Suspense fallback={`Loading`}> <Modal item={itemModal} triggerModal={triggerModal} /> </Suspense>}

      <div className={`${styles.controls} hud-frame`}>
        <label>
          Sort by
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            {Object.entries(SORT_OPTIONS).map(([key, option]) => (
              <option key={key} value={key}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          Length
          <select value={durationKey} onChange={(e) => setDurationKey(e.target.value)}>
            {Object.entries(DURATION_FILTERS).map(([key, filter]) => (
              <option key={key} value={key}>{filter.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.groupToggle}>
          <input
            type="checkbox"
            checked={groupByChannelOn}
            onChange={(e) => setGroupByChannelOn(e.target.checked)}
          />
          Group by channel
        </label>
      </div>

      {grouped ? (
        grouped.map((group) => (
          <div key={group.channel} className={styles.channelGroup}>
            <h3 className={styles.channelGroup__title}>{group.channel}</h3>
            <ul className={styles.searchlist}>
              {group.items.map((item) => (
                <Suspense fallback={`Loading`} key={item.id}>
                  <SoundItem item={item} triggerModal={triggerModal} />
                </Suspense>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className={styles.searchlist}>
          {processedResults.map(item => (
            <Suspense fallback={`Loading`} key={item.id}>
              <SoundItem item={item} triggerModal={triggerModal} />
            </Suspense>
          ))}
        </ul>
      )}
    </div>
  )
}
export default SoundList
