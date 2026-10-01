import { useState } from 'react'
import { FaPlay, FaPlus } from 'react-icons/fa'
import { MdWaves } from 'react-icons/md'
import styles from '../styles/player.module.css'
import { useNowPlaying } from '../context/nowPlayingContext'
import resolveTrack from '../core/track/resolveTrack'

// A long queue (a whole search result list) would push everything else off
// screen, so only the first few of the listener's picks show until asked.
const QUEUE_PREVIEW = 5

const CREDIT = (
    <p className={styles.listBlock__credit}>
        Picked from <a href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a> listener data
    </p>
)

// The expanded player's lower half (hidden in the mini-player), two blocks:
//  - Up next: what plays after this track — your picks, then what Autoplay
//    will add when they run out (and the switch that controls it).
//  - Similar vibe: tracks like the one playing, always, whatever Autoplay is.
const QueuePanel = ({ item }) => (
    <div className={styles.listArea}>
        <UpNextBlock />
        <VibeBlock item={item} />
    </div>
)

const UpNextBlock = () => {
    const { upNext, jumpTo, radio, autoplayTarget, setRadio } = useNowPlaying()
    const [showAll, setShowAll] = useState(false)
    const autoplayAvailable = radio.status !== 'unavailable'
    const hidden = showAll ? 0 : Math.max(0, upNext.user.length - QUEUE_PREVIEW)
    const shown = hidden ? upNext.user.slice(0, QUEUE_PREVIEW) : upNext.user
    return (
        <section className={styles.listBlock} aria-label="Up next">
            <header className={styles.listBlock__header}>
                <h3 className={styles.listBlock__title}>Up next</h3>
                <p className={styles.listBlock__subtitle}>
                    {upNext.user.length ? 'Your picks, in order' : 'Nothing of yours is queued'}
                </p>
            </header>

            {upNext.user.length > 0 && (
                <ol className={styles.queueList}>
                    {shown.map(({ item: queued, index }) => (
                        <QueueRow
                            key={queued.video.id}
                            title={queued.video.title}
                            meta={queued.video.channel?.name}
                            onPlay={() => jumpTo(index)}
                        />
                    ))}
                </ol>
            )}
            {upNext.user.length > QUEUE_PREVIEW && (
                <button type="button" className={styles.queueMore} onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                    {showAll ? 'Show fewer' : `Show ${hidden} more in your queue`}
                </button>
            )}

            {autoplayAvailable && (
                <>
                    <div className={styles.autoplayRow}>
                        <p className={styles.autoplayRow__text}>
                            {radio.enabled
                                ? <>Then, autoplay: <strong>{autoplayTarget ?? 'similar vibe'}</strong></>
                                : 'Autoplay is off — playback stops when your queue ends.'}
                        </p>
                        <AutoplaySwitch on={radio.enabled} onChange={setRadio} />
                    </div>
                    {radio.enabled && <AutoplayList />}
                </>
            )}
        </section>
    )
}

// What Autoplay has lined up (or is fetching, or can't follow).
const AutoplayList = () => {
    const { upNext, jumpTo, radio } = useNowPlaying()
    const empty = !upNext.radio.length && !upNext.waiting.length
    const retrying = empty && !radio.loading && radio.retryAt !== null
    // Suggestions are only fetched once 2 or fewer of the user's tracks are left.
    const queuedAhead = empty && upNext.user.length > 2 ? upNext.user.length : 0
    const fetching = empty && !retrying && !queuedAhead && radio.status === 'idle'

    if (radio.status === 'unidentified') {
        return <p className={styles.listBlock__note}>We couldn&apos;t identify this song, so there&apos;s nothing to follow.</p>
    }
    if (queuedAhead) {
        return <p className={styles.listBlock__note}>After your {queuedAhead} queued tracks, similar-vibe tracks will play.</p>
    }
    if (retrying) {
        return <p className={styles.listBlock__note} role="status">Couldn&apos;t load tracks right now — trying again shortly.</p>
    }
    if (fetching) return <SkeletonRows label="Finding tracks with a similar vibe…" />
    if (empty) {
        return (
            <p className={styles.listBlock__note}>
                {radio.status === 'exhausted' ? 'No more tracks with this vibe right now.' : 'Nothing lined up yet.'}
            </p>
        )
    }
    return (
        <>
            <ol className={styles.queueList}>
                {upNext.radio.map(({ item: queued, index }) => (
                    <QueueRow
                        key={queued.video.id}
                        title={queued.video.title}
                        meta={[queued.video.channel?.name, ...(queued.reason?.sharedTags ?? [])].filter(Boolean).join(' · ')}
                        onPlay={() => jumpTo(index)}
                    />
                ))}
                {upNext.waiting.map((candidate) => (
                    <QueueRow
                        key={`${candidate.artist}|${candidate.title}`}
                        title={`${candidate.artist} – ${candidate.title}`}
                        meta={[upNext.waitMinutes ? 'waiting for YouTube' : 'finding a video…', ...(candidate.reason?.sharedTags ?? [])].join(' · ')}
                        waiting
                    />
                ))}
            </ol>
            {upNext.waitMinutes && (
                <p className={styles.listBlock__note} role="status">
                    YouTube is limiting searches right now — these become playable in about {upNext.waitMinutes} min.
                </p>
            )}
            {CREDIT}
        </>
    )
}

const VibeBlock = ({ item }) => {
    const { vibe, playCandidate, retryVibe, browseVibe, autoplayVibe } = useNowPlaying()
    if (vibe.status === 'unavailable') return null

    const trackTitle = resolveTrack(item)?.title ?? item.title
    return (
        <section className={`${styles.listBlock} ${styles.listBlockVibe}`} aria-label="Similar vibe">
            <header className={styles.listBlock__header}>
                <h3 className={styles.listBlock__title}><MdWaves aria-hidden="true" /> Similar vibe</h3>
                <p className={styles.listBlock__subtitle}>
                    {vibe.kind === 'tag' ? `Vibe: ${vibe.tag}` : `Like "${trackTitle}"`}
                </p>
                {vibe.kind === 'tag' && (
                    <div className={styles.vibeActions}>
                        <button type="button" className={styles.listBlock__button} onClick={() => autoplayVibe(vibe.tag)}>
                            Autoplay this vibe
                        </button>
                        <button type="button" className={styles.listBlock__button} onClick={() => browseVibe(vibe.tag)}>
                            Back to this track
                        </button>
                    </div>
                )}
            </header>

            {vibe.status === 'loading' ? (
                <SkeletonRows label="Finding tracks with a similar vibe…" />
            ) : vibe.status === 'unidentified' ? (
                <p className={styles.listBlock__note}>We couldn&apos;t identify this song, so there&apos;s no vibe to follow.</p>
            ) : vibe.status === 'error' ? (
                <p className={styles.listBlock__note} role="status">
                    Couldn&apos;t load tracks with a similar vibe.{' '}
                    <button type="button" className={styles.listBlock__button} onClick={retryVibe}>Retry</button>
                </p>
            ) : vibe.candidates.length === 0 ? (
                <p className={styles.listBlock__note} role="status">No tracks with a similar vibe found.</p>
            ) : (
                <>
                    <ol className={styles.queueList}>
                        {vibe.candidates.map((candidate) => (
                            <QueueRow
                                key={candidate.id}
                                title={`${candidate.artist} – ${candidate.title}`}
                                meta={candidateMeta(candidate)}
                                busy={candidate.resolving === 'loading'}
                                onPlay={() => playCandidate(candidate, 'now')}
                                onAdd={() => playCandidate(candidate, 'queue')}
                            />
                        ))}
                    </ol>
                    {CREDIT}
                </>
            )}
        </section>
    )
}

function candidateMeta({ resolving, reason }) {
    if (resolving === 'loading') return 'finding video…'
    if (resolving === 'none') return 'no playable video found'
    if (resolving === 'limited') return 'YouTube is limiting searches — try again in a few minutes'
    return (reason?.sharedTags ?? []).join(' · ')
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

// `onAdd` adds the ➕ / ▶ pair (Similar vibe rows); without it the whole row
// is the play button (Up next rows). `waiting` rows can't be played yet.
const QueueRow = ({ title, meta, onPlay, onAdd, busy = false, waiting = false }) => (
    <li className={waiting ? `${styles.queueRow} ${styles.queueRowWaiting}` : styles.queueRow}>
        {waiting ? (
            <span className={styles.queueRow__main}>
                <span className={styles.queueRow__title}>{title}</span>
                <span className={styles.queueRow__meta}>{meta}</span>
            </span>
        ) : (
            <button type="button" className={styles.queueRow__main} onClick={onPlay} disabled={busy} title={`Play ${title}`}>
                <span className={styles.queueRow__title}>{title}</span>
                <span className={styles.queueRow__meta}>{meta}</span>
            </button>
        )}
        {onAdd && (
            <>
                <button type="button" className={styles.queueRow__action} onClick={onAdd} disabled={busy} aria-label={`Add ${title} to queue`} title="Add to queue">
                    <FaPlus aria-hidden="true" />
                </button>
                <button type="button" className={styles.queueRow__action} onClick={onPlay} disabled={busy} aria-label={`Play ${title} now`} title="Play now">
                    <FaPlay aria-hidden="true" />
                </button>
            </>
        )}
    </li>
)

export default QueuePanel
