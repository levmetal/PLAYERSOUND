import Head from 'next/head'
import { useState } from 'react'
import { FaPlay } from 'react-icons/fa'
import styles from '../styles/library.module.css'
import SoundItem from '../components/soundItem'
import { useNowPlaying } from '../context/nowPlayingContext'
import { historyDays } from '../core/home/homeSections'
import { formatTrackNumber } from '../core/format/trackNumber'

const DAY_MS = 24 * 60 * 60 * 1000

// The listener's own calendar day of a moment, as a whole number.
const localDay = (ms) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60 * 1000) / DAY_MS)

function dayLabel(daysAgo, at) {
    if (daysAgo === 0) return 'Today'
    if (daysAgo === 1) return 'Yesterday'
    return new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// What was listened to (30 s or more, or to the end) in this browser, by day.
// Only plays from the version that started keeping the video show up.
const History = () => {
    const { history, positions, playQueue, clearHistory } = useNowPlaying()
    const [confirming, setConfirming] = useState(false)

    const days = historyDays(history, Date.now(), localDay)
    const videos = days.flatMap((day) => day.items.map((entry) => entry.video))
    const resumeAt = (id) => positions.find((entry) => entry.video.id === id)?.seconds ?? 0

    const playFrom = (index) => playQueue(videos, index, { type: 'history', label: 'History' })
    const clear = () => {
        clearHistory()
        setConfirming(false)
    }

    let number = 0
    return (
        <>
            <Head>
                <title>History · PlayerSound</title>
            </Head>
            <div className={styles.container}>
                <p className={styles.eyebrow}>SYSTEM_LOG // HISTORY</p>
                <h1 className={styles.library__title}>History</h1>

                <div className={styles.playlistHeader}>
                    <h2 className={styles.playlistHeader__name}>
                        Listened in this browser{' '}
                        <span className={styles.playlistCount}>({videos.length})</span>
                    </h2>
                    <div className={styles.playlistActions}>
                        <button type="button" className={styles.playAll} onClick={() => playFrom(0)} disabled={!videos.length}>
                            <FaPlay aria-hidden="true" /> Play all
                        </button>
                        {!confirming ? (
                            <button type="button" className={styles.playAll} onClick={() => setConfirming(true)} disabled={!history.length}>
                                Clear history
                            </button>
                        ) : (
                            <p className={styles.historyConfirm} role="alert">
                                Clear your listening history? Playlists and resume points stay. This can&apos;t be undone.{' '}
                                <button type="button" className={styles.playAll} onClick={clear}>Yes</button>{' '}
                                <button type="button" className={styles.playAll} onClick={() => setConfirming(false)}>Cancel</button>
                            </p>
                        )}
                    </div>
                </div>

                {!videos.length ? (
                    <p className={styles.emptyState}>
                        Nothing here yet. Tracks you listen to for 30 seconds or more show up here.
                    </p>
                ) : days.map((day) => (
                    <section key={day.daysAgo} className={styles.historyDay} aria-label={dayLabel(day.daysAgo, day.items[0].at)}>
                        <h3 className={styles.historyDay__title}>{dayLabel(day.daysAgo, day.items[0].at)}</h3>
                        <ul className={styles.list__container}>
                            {day.items.map((entry) => {
                                const index = number++
                                return (
                                    <SoundItem
                                        key={`${day.daysAgo}:${entry.id}`}
                                        item={entry.video}
                                        number={formatTrackNumber(index + 1, videos.length)}
                                        onPlay={() => playFrom(index)}
                                        showStats={false}
                                        resumeAt={resumeAt(entry.id)}
                                    />
                                )
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </>
    )
}

export default History
