import { useEffect, useState } from "react"
import { FaPlay, FaPlus } from 'react-icons/fa'
import { MdRadio } from 'react-icons/md'
import styles from '../styles/player.module.css'
import { useNowPlaying } from '../context/nowPlayingContext'
import { discover } from '../utils/discoverClient'
import resolveTrack from '../core/track/resolveTrack'

const LASTFM = <a href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a>

// Under the expanded player's faceplate (hidden in the mini-player). With
// radio on, the suggestions already are the similar tracks, so it lists what
// plays next; with radio off it offers similar tracks on request instead.
const QueuePanel = ({ item }) => {
    const { upNext, radio, jumpTo } = useNowPlaying()

    if (!radio.enabled) return <SimilarSection key={item.id} item={item} />

    const { user, radio: suggested } = upNext
    return (
        <section className={styles.queuePanel} aria-label="Up next">
            <h3 className={styles.queuePanel__title}>Up next</h3>
            {user.length === 0 && suggested.length === 0 && (
                <p className={styles.queuePanel__empty}>
                    {radio.loading ? 'Finding similar tracks…' : radio.status === 'exhausted' ? 'Radio ran out of new tracks.' : 'Nothing queued.'}
                </p>
            )}
            {user.length > 0 && (
                <>
                    <p className={styles.queuePanel__group}>Your queue</p>
                    <ol className={styles.queueList}>
                        {user.map(({ item: queued, index }) => (
                            <QueueRow key={queued.video.id} video={queued.video} onPlay={() => jumpTo(index)} />
                        ))}
                    </ol>
                </>
            )}
            {suggested.length > 0 && (
                <>
                    <p className={styles.queuePanel__group}>
                        <MdRadio aria-hidden="true" /> From radio <span className={styles.queuePanel__credit}>· {LASTFM}</span>
                    </p>
                    <ol className={styles.queueList}>
                        {suggested.map(({ item: queued, index }) => (
                            <QueueRow
                                key={queued.video.id}
                                video={queued.video}
                                tags={queued.reason?.sharedTags}
                                onPlay={() => jumpTo(index)}
                            />
                        ))}
                    </ol>
                </>
            )}
        </section>
    )
}

const QueueRow = ({ video, tags, onPlay, onAdd }) => (
    <li className={styles.queueRow}>
        <button type="button" className={styles.queueRow__main} onClick={onPlay} title={`Play ${video.title}`}>
            <span className={styles.queueRow__title}>{video.title}</span>
            <span className={styles.queueRow__meta}>
                {video.channel?.name}
                {tags?.length > 0 && ` · ${tags.join(', ')}`}
            </span>
        </button>
        {onAdd && (
            <button type="button" className={styles.queueRow__action} onClick={onAdd} aria-label={`Add ${video.title} to queue`} title="Add to queue">
                <FaPlus aria-hidden="true" />
            </button>
        )}
        {onAdd && (
            <button type="button" className={styles.queueRow__action} onClick={onPlay} aria-label={`Play ${video.title} now`} title="Play now">
                <FaPlay aria-hidden="true" />
            </button>
        )}
    </li>
)

// Radio off: one /api/discover call for this track, only when asked. Keyed by
// track in QueuePanel, so a new track starts from the button again.
const SimilarSection = ({ item }) => {
    const { enqueue, playNow, signals } = useNowPlaying()
    const [state, setState] = useState({ status: 'idle', candidates: [] })
    const identified = resolveTrack(item) !== null

    useEffect(() => {
        if (state.status !== 'loading') return undefined
        let cancelled = false
        discover({ seeds: [item], exclude: signals.exclude, affinity: signals.affinity }).then((result) => {
            if (cancelled) return
            if (!result.ok) {
                setState({ status: result.unavailable ? 'unavailable' : 'error', candidates: [] })
                return
            }
            const playable = result.data.candidates.filter((c) => c.video)
            if (!playable.length && result.data.retryAfter) {
                setState({ status: 'limited', candidates: [], minutes: Math.ceil(result.data.retryAfter / 60) })
                return
            }
            setState({ status: 'done', candidates: playable })
        })
        return () => { cancelled = true }
        // Only the transition into 'loading' should fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status])

    if (state.status === 'unavailable') return null

    return (
        <section className={styles.queuePanel} aria-label="Similar to this">
            <h3 className={styles.queuePanel__title}>Similar to this</h3>
            {!identified ? (
                <p className={styles.queuePanel__empty}>We couldn&apos;t identify this song.</p>
            ) : state.status === 'idle' ? (
                <button type="button" className={styles.queuePanel__button} onClick={() => setState({ status: 'loading', candidates: [] })}>
                    Show similar
                </button>
            ) : state.status === 'loading' ? (
                <p className={styles.queuePanel__empty} role="status">Finding similar tracks…</p>
            ) : state.status === 'error' ? (
                <p className={styles.queuePanel__empty} role="status">
                    Couldn&apos;t load similar tracks.{' '}
                    <button type="button" className={styles.queuePanel__button} onClick={() => setState({ status: 'loading', candidates: [] })}>Retry</button>
                </p>
            ) : state.status === 'limited' ? (
                <p className={styles.queuePanel__empty} role="status">
                    YouTube is limiting searches right now — try again in {state.minutes} min.
                </p>
            ) : state.candidates.length === 0 ? (
                <p className={styles.queuePanel__empty} role="status">No similar tracks found.</p>
            ) : (
                <>
                    <p className={styles.queuePanel__group}>
                        via <span className={styles.queuePanel__credit}>{LASTFM}</span>
                    </p>
                    <ol className={styles.queueList}>
                        {state.candidates.map((candidate) => (
                            <QueueRow
                                key={candidate.video.id}
                                video={candidate.video}
                                tags={candidate.reason?.sharedTags}
                                onPlay={() => playNow(candidate.video)}
                                onAdd={() => enqueue(candidate.video)}
                            />
                        ))}
                    </ol>
                </>
            )}
        </section>
    )
}

export default QueuePanel
