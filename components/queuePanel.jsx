import { useEffect, useState } from "react"
import { FaPlay, FaPlus } from 'react-icons/fa'
import { MdWaves } from 'react-icons/md'
import styles from '../styles/player.module.css'
import { useNowPlaying } from '../context/nowPlayingContext'
import { discover } from '../utils/discoverClient'
import resolveTrack from '../core/track/resolveTrack'

const CREDIT = (
    <p className={styles.listBlock__credit}>
        Picked from <a href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a> listener data
    </p>
)

// The expanded player's lower half (hidden in the mini-player): what the
// listener queued, and the "Similar vibe" tracks — what they are, why each
// was picked, and whether they'll play on their own (the Autoplay switch).
const QueuePanel = ({ item }) => {
    const { upNext, jumpTo } = useNowPlaying()
    return (
        <div className={styles.listArea}>
            {upNext.user.length > 0 && (
                <section className={styles.listBlock} aria-label="Up next">
                    <header className={styles.listBlock__header}>
                        <h3 className={styles.listBlock__title}>Up next</h3>
                        <p className={styles.listBlock__subtitle}>Your picks, in order</p>
                    </header>
                    <ol className={styles.queueList}>
                        {upNext.user.map(({ item: queued, index }) => (
                            <QueueRow key={queued.video.id} video={queued.video} onPlay={() => jumpTo(index)} />
                        ))}
                    </ol>
                </section>
            )}
            <VibeBlock item={item} />
        </div>
    )
}

function vibeSubtitle({ source, radio, upNext, item }) {
    if (source?.type === 'tag') return `Vibe: ${source.label}`
    if (source?.type === 'radio' && radio.seeds.length > 1) return `Like the playlist "${source.label}"`
    const seed = upNext.radio[0]?.item.reason?.seed ?? upNext.waiting[0]?.reason?.seed ?? resolveTrack(item)?.title
    return `Like "${seed ?? item.title}"`
}

const VibeBlock = ({ item }) => {
    const nowPlaying = useNowPlaying()
    const { radio, upNext, jumpTo, setRadio } = nowPlaying
    if (radio.status === 'unavailable') return null

    const identified = resolveTrack(item) !== null || upNext.radio.length > 0
    const cantFollow = radio.status === 'unidentified' || (!identified && !radio.seeds.length && !radio.tags.length)
    const empty = !upNext.radio.length && !upNext.waiting.length
    const retrying = empty && !radio.loading && radio.retryAt !== null
    // Suggestions are only fetched once 2 or fewer of the user's tracks are left.
    const queuedAhead = empty && upNext.user.length > 2 ? upNext.user.length : 0
    const fetching = radio.enabled && empty && !cantFollow && !retrying && (radio.loading || radio.status === 'idle')

    return (
        <section className={`${styles.listBlock} ${styles.listBlockVibe}`} aria-label="Similar vibe">
            <header className={styles.listBlock__header}>
                <h3 className={styles.listBlock__title}><MdWaves aria-hidden="true" /> Similar vibe</h3>
                <p className={styles.listBlock__subtitle}>{vibeSubtitle({ ...nowPlaying, item })}</p>
                <AutoplaySwitch on={radio.enabled} onChange={setRadio} />
            </header>

            {!radio.enabled ? (
                <OnDemandVibe key={item.id} item={item} identified={identified} />
            ) : cantFollow ? (
                <p className={styles.listBlock__note}>We couldn&apos;t identify this song, so there&apos;s no vibe to follow.</p>
            ) : queuedAhead ? (
                <p className={styles.listBlock__note}>
                    After your {queuedAhead} queued tracks, tracks with a similar vibe will play.
                </p>
            ) : retrying ? (
                <p className={styles.listBlock__note} role="status">Couldn&apos;t load tracks right now — trying again shortly.</p>
            ) : fetching ? (
                <SkeletonRows label="Finding tracks with a similar vibe…" />
            ) : empty ? (
                <p className={styles.listBlock__note}>
                    {radio.status === 'exhausted' ? 'No more tracks with this vibe right now.' : 'Nothing lined up yet.'}
                </p>
            ) : (
                <>
                    <ol className={styles.queueList}>
                        {upNext.radio.map(({ item: queued, index }) => (
                            <QueueRow
                                key={queued.video.id}
                                video={queued.video}
                                tags={queued.reason?.sharedTags}
                                onPlay={() => jumpTo(index)}
                            />
                        ))}
                        {upNext.waiting.map((candidate) => (
                            <li key={`${candidate.artist}|${candidate.title}`} className={`${styles.queueRow} ${styles.queueRowWaiting}`}>
                                <span className={styles.queueRow__main}>
                                    <span className={styles.queueRow__title}>{candidate.artist} – {candidate.title}</span>
                                    <span className={styles.queueRow__meta}>
                                        {upNext.waitMinutes ? 'waiting for YouTube' : 'finding a video…'}
                                        {candidate.reason?.sharedTags?.length > 0 && ` · ${candidate.reason.sharedTags.join(', ')}`}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    {upNext.waitMinutes && (
                        <p className={styles.listBlock__note} role="status">
                            YouTube is limiting searches right now — these become playable in about {upNext.waitMinutes} min.
                        </p>
                    )}
                    {CREDIT}
                </>
            )}
        </section>
    )
}

// Labelled, so it says what it does instead of hiding behind an icon.
const AutoplaySwitch = ({ on, onChange }) => (
    <div className={styles.autoplay}>
        <button
            type="button"
            role="switch"
            aria-checked={on}
            className={on ? `${styles.autoplay__switch} ${styles.autoplay__switchOn}` : styles.autoplay__switch}
            onClick={() => onChange(!on)}
        >
            <span className={styles.autoplay__label}>Autoplay</span>
            <span className={styles.autoplay__state} aria-hidden="true">{on ? 'On' : 'Off'}</span>
        </button>
        <span className={styles.autoplay__hint}>
            {on ? 'When your queue ends, these play next.' : 'Off — playback stops when your queue ends.'}
        </span>
    </div>
)

const SkeletonRows = ({ label }) => (
    <div>
        <p className={styles.listBlock__note} role="status">{label}</p>
        <ul className={styles.queueList} aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <li key={i} className={`${styles.queueRow} ${styles.queueRowSkeleton}`}>
                    <span className={styles.queueRow__main}>
                        <span className={styles.skeletonBar} />
                        <span className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} />
                    </span>
                </li>
            ))}
        </ul>
    </div>
)

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

// Autoplay off: one /api/discover call for this track, only when asked.
// Keyed by track, so a new track starts from the button again.
const OnDemandVibe = ({ item, identified }) => {
    const { enqueue, playNow, signals } = useNowPlaying()
    const [state, setState] = useState({ status: 'idle', candidates: [] })
    const load = () => setState({ status: 'loading', candidates: [] })

    useEffect(() => {
        if (state.status !== 'loading') return undefined
        let cancelled = false
        discover({ seeds: [item], exclude: signals.exclude, affinity: signals.affinity }).then((result) => {
            if (cancelled) return
            if (!result.ok) {
                setState({ status: 'error', candidates: [] })
                return
            }
            const playable = result.data.candidates.filter((c) => c.video)
            const waiting = result.data.candidates.filter((c) => !c.video).slice(0, 5)
            setState({
                status: 'done',
                candidates: playable,
                waiting,
                minutes: result.data.retryAfter ? Math.ceil(result.data.retryAfter / 60) : null,
            })
        })
        return () => { cancelled = true }
        // Only the transition into 'loading' should fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status])

    if (!identified) return <p className={styles.listBlock__note}>We couldn&apos;t identify this song, so there&apos;s no vibe to follow.</p>
    if (state.status === 'idle') {
        return (
            <button type="button" className={styles.listBlock__button} onClick={load}>
                Show tracks with a similar vibe
            </button>
        )
    }
    if (state.status === 'loading') return <SkeletonRows label="Finding tracks with a similar vibe…" />
    if (state.status === 'error') {
        return (
            <p className={styles.listBlock__note} role="status">
                Couldn&apos;t load tracks with a similar vibe.{' '}
                <button type="button" className={styles.listBlock__button} onClick={load}>Retry</button>
            </p>
        )
    }
    if (!state.candidates.length && !state.waiting.length) {
        return <p className={styles.listBlock__note} role="status">No tracks with a similar vibe found.</p>
    }
    return (
        <>
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
                {state.minutes && state.waiting.map((candidate) => (
                    <li key={`${candidate.artist}|${candidate.title}`} className={`${styles.queueRow} ${styles.queueRowWaiting}`}>
                        <span className={styles.queueRow__main}>
                            <span className={styles.queueRow__title}>{candidate.artist} – {candidate.title}</span>
                            <span className={styles.queueRow__meta}>waiting for YouTube</span>
                        </span>
                    </li>
                ))}
            </ol>
            {state.minutes && (
                <p className={styles.listBlock__note} role="status">
                    YouTube is limiting searches right now — try again in about {state.minutes} min.
                </p>
            )}
            {CREDIT}
        </>
    )
}

export default QueuePanel
