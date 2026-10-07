import { useLayoutEffect, useRef, useState } from 'react'
import { FaPlay, FaPlus, FaMusic, FaListUl, FaVolumeUp, FaTimes } from 'react-icons/fa'
import styles from '../styles/player.module.css'
import { useNowPlaying } from '../context/nowPlayingContext'
import { useDispatchContext } from '../context/libraryContext/libraryContext'
import PlaylistPicker from './playlistPicker'
import resolveTrack from '../core/track/resolveTrack'
import { formatTrackNumber } from '../core/format/trackNumber'
import { ConvertSecToMin } from '../utils/convertSecondToMinutes'

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
const QueuePanel = ({ item }) => {
    const areaRef = useRef(null)

    // The list scrolls on its own, and its scrollbar takes width from the
    // content only (the faceplate above has none), which pulled the right edge
    // of the lists in from the globe's. Measured, not assumed — classic and
    // overlay scrollbars differ — and handed to the CSS to give back as padding.
    useLayoutEffect(() => {
        const area = areaRef.current
        if (!area) return undefined
        const sync = () => area.style.setProperty('--scrollbar-w', `${area.offsetWidth - area.clientWidth}px`)
        sync()
        const observer = new ResizeObserver(sync)
        observer.observe(area)
        observer.observe(area.firstElementChild)
        return () => observer.disconnect()
    }, [])

    return (
        <div className={styles.listArea} ref={areaRef}>
            <div className={styles.listGrid}>
                <UpNextBlock />
                <VibeBlock item={item} />
            </div>
        </div>
    )
}

// Up next's header actions: "Save queue as playlist" (the tracks you chose,
// under a name you can change; hidden while there's nothing of yours) and,
// passed in as children so it shows even with nothing queued, the Autoplay
// switch. The name field opens inline under the header.
const SaveQueue = ({ children }) => {
    const { queueTracks, queueName } = useNowPlaying()
    const dispatch = useDispatchContext()
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [saved, setSaved] = useState('')

    if (!queueTracks.length) return children ? <div className={styles.vibeActions}>{children}</div> : null

    const toggle = () => {
        setSaved('')
        setName(queueName)
        setOpen(!open)
    }
    const save = (e) => {
        e.preventDefault()
        const clean = name.trim()
        if (!clean) return
        dispatch({ type: 'CREATE_PLAYLIST', payload: { name: clean, tracks: queueTracks } })
        setSaved(`Saved "${clean}" with ${queueTracks.length} ${queueTracks.length === 1 ? 'track' : 'tracks'}`)
        setOpen(false)
    }

    return (
        <>
            <div className={styles.vibeActions}>
                <button type="button" className={styles.listBlock__button} onClick={toggle} aria-expanded={open}>
                    Save queue as playlist
                </button>
                {children}
            </div>
            {open && (
                <form className={styles.saveQueue} onSubmit={save}>
                    <label htmlFor="save-queue-name" className="sr-only">Playlist name</label>
                    <input
                        id="save-queue-name"
                        className={styles.saveQueue__input}
                        type="text"
                        autoComplete="off"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <button type="submit" className={styles.listBlock__button}>Save</button>
                </form>
            )}
            <p className={styles.listBlock__note} role="status" aria-live="polite">{saved}</p>
        </>
    )
}

const UpNextBlock = () => {
    const { item, upNext, jumpTo, radio, autoplayTarget, setRadio, position } = useNowPlaying()
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
                {/* Autoplay sits up here, in sight at any window height: it decides
                    what plays when your picks run out. */}
                <SaveQueue>
                    {autoplayAvailable && <AutoplaySwitch on={radio.enabled} onChange={setRadio} />}
                </SaveQueue>
            </header>

            <ol className={styles.queueList}>
                {item && (
                    <QueueRow
                        current
                        number={formatTrackNumber(position?.current, position?.total)}
                        video={item}
                        title={item.title}
                        meta={item.channel?.name}
                    />
                )}
                {shown.map(({ item: queued, index }) => (
                    <QueueRow
                        key={queued.video.id}
                        number={formatTrackNumber(index + 1, position?.total)}
                        video={queued.video}
                        title={queued.video.title}
                        meta={queued.video.channel?.name}
                        onPlay={() => jumpTo(index)}
                    />
                ))}
            </ol>
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
                                : 'Autoplay is off. Playback stops when your queue ends.'}
                        </p>
                    </div>
                    {radio.enabled && <AutoplayList />}
                </>
            )}
        </section>
    )
}

// What Autoplay has lined up (or is fetching, or can't follow).
const AutoplayList = () => {
    const { upNext, jumpTo, radio, position } = useNowPlaying()
    const empty = !upNext.radio.length && !upNext.waiting.length
    const retrying = empty && !radio.loading && radio.retryAt !== null
    // Suggestions are only fetched once 2 or fewer of the user's tracks are left.
    const queuedAhead = empty && upNext.user.length > 2 ? upNext.user.length : 0
    const fetching = empty && !retrying && !queuedAhead && radio.status === 'idle'

    if (radio.status === 'unidentified') {
        return <p className={styles.listBlock__note}>This song couldn&apos;t be identified, so there&apos;s nothing to follow</p>
    }
    if (queuedAhead) {
        return <p className={styles.listBlock__note}>After your {queuedAhead} queued tracks, similar-vibe tracks will play</p>
    }
    if (retrying) {
        return <p className={styles.listBlock__note} role="status">Couldn&apos;t load tracks right now. Trying again shortly.</p>
    }
    if (fetching) return <SkeletonRows label="Finding tracks with a similar vibe…" />
    if (empty) {
        return (
            <p className={styles.listBlock__note}>
                {radio.status === 'exhausted' ? 'No more tracks with this vibe right now' : 'Nothing lined up yet'}
            </p>
        )
    }
    return (
        <>
            <ol className={styles.queueList}>
                {upNext.radio.map(({ item: queued, index }) => (
                    <QueueRow
                        key={queued.video.id}
                        number={formatTrackNumber(index + 1, position?.total)}
                        video={queued.video}
                        title={queued.video.title}
                        meta={[queued.video.channel?.name, ...(queued.reason?.sharedTags ?? [])].filter(Boolean).join(' · ')}
                        onPlay={() => jumpTo(index)}
                    />
                ))}
                {upNext.waiting.map((candidate) => (
                    <QueueRow
                        key={`${candidate.artist}|${candidate.title}`}
                        number=""
                        title={`${candidate.artist} – ${candidate.title}`}
                        meta={[upNext.waitMinutes ? 'waiting for YouTube' : 'finding a video…', ...(candidate.reason?.sharedTags ?? [])].join(' · ')}
                        waiting
                    />
                ))}
            </ol>
            {upNext.waitMinutes && (
                <p className={styles.listBlock__note} role="status">
                    YouTube is limiting searches right now. These become playable in about {upNext.waitMinutes} {upNext.waitMinutes === 1 ? 'minute' : 'minutes'}.
                </p>
            )}
            {CREDIT}
        </>
    )
}

// Last.fm gives a seed up to ~10 tags; the strongest few are enough to pick from.
const MAX_TAG_CHIPS = 5

const VibeBlock = ({ item }) => {
    const { vibe, playCandidate, ensureVideo, retryVibe, browseVibe, autoplayVibe, tags, browseTag, radio } = useNowPlaying()
    if (vibe.status === 'unavailable') return null

    const trackTitle = resolveTrack(item)?.title ?? item.title
    return (
        <section className={`${styles.listBlock} ${styles.listBlockVibe}`} aria-label="Similar vibe">
            <header className={styles.listBlock__header}>
                <h3 className={styles.listBlock__title}>Similar vibe</h3>
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

            {/* The playing track's tags: picking one swaps this list to that vibe,
                so they sit with the list they change. */}
            {tags.length > 0 && (
                <ul className={`${styles.tagChips} ${styles.vibeChips}`} aria-label="More like these tags, from Last.fm">
                    <li className={styles.tagChips__label} aria-hidden="true">More like</li>
                    {tags.slice(0, MAX_TAG_CHIPS).map((tag) => (
                        <li key={tag}>
                            <button
                                type="button"
                                onClick={() => browseVibe(tag)}
                                aria-pressed={browseTag === tag || radio.tags[0] === tag}
                                title={`Show more like ${tag}`}
                            >
                                {tag}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {vibe.status === 'loading' ? (
                <SkeletonRows label="Finding tracks with a similar vibe…" />
            ) : vibe.status === 'unidentified' ? (
                <p className={styles.listBlock__note}>This song couldn&apos;t be identified, so there&apos;s no vibe to follow</p>
            ) : vibe.status === 'error' ? (
                <p className={styles.listBlock__note} role="status">
                    Couldn&apos;t load tracks with a similar vibe.{' '}
                    <button type="button" className={styles.listBlock__button} onClick={retryVibe}>Retry</button>
                </p>
            ) : vibe.candidates.length === 0 ? (
                <p className={styles.listBlock__note} role="status">No tracks with a similar vibe found</p>
            ) : (
                <>
                    <ol className={styles.queueList}>
                        {vibe.candidates.map((candidate, rank) => (
                            <QueueRow
                                key={candidate.id}
                                number={formatTrackNumber(rank + 1, vibe.candidates.length)}
                                video={candidate.video}
                                title={`${candidate.artist} – ${candidate.title}`}
                                meta={candidateMeta(candidate)}
                                busy={candidate.resolving === 'loading'}
                                onPlay={() => playCandidate(candidate, 'now')}
                                onAdd={() => playCandidate(candidate, 'queue')}
                                findVideo={() => ensureVideo(candidate)}
                            />
                        ))}
                    </ol>
                    {CREDIT}
                </>
            )}
        </section>
    )
}

export function candidateMeta({ resolving, reason }) {
    if (resolving === 'loading') return 'finding video…'
    if (resolving === 'none') return 'no playable video found'
    if (resolving === 'limited') return 'YouTube is limiting searches. Try again in a few minutes.'
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

// Same anatomy as a search-result row: № · cover · title + meta · duration ·
// buttons. ▶ is always there and is the row's one tab stop; the rest of the
// row plays on a click too (an overlay hidden from keyboards and screen
// readers). `onAdd` adds ➕ (Similar vibe rows). `waiting` rows can't be
// played yet; `video` is absent for them and for Similar vibe rows until
// one is found, so those show a placeholder cover and `--:--`.
// The list button (Add to playlist) opens the same picker as a search row's
// ⋯ menu, inline under the row; a row with no video yet asks `findVideo`
// for it first. `current` is the track that's playing: marked like the
// playing row in search, with nothing to play or add. Home's Continue
// listening adds `progress` (0–1, a thin bar under the meta) and `onRemove`
// (✕, labelled by `removeLabel`), and drops Add to playlist (`pickable`) to
// leave the title room on phones.
export const QueueRow = ({
    number, video, title, meta, onPlay, onAdd, busy = false, waiting = false, current = false, findVideo,
    progress = null, onRemove = null, removeLabel = '', pickable = true,
}) => {
    const [picking, setPicking] = useState(false)
    const duration = video?.duration > 0 ? ConvertSecToMin(video.duration) : '--:--'
    const className = [
        styles.queueRow,
        waiting && styles.queueRowWaiting,
        busy && styles.queueRowBusy,
        current && styles.queueRowCurrent,
    ].filter(Boolean).join(' ')
    const canPick = pickable && !waiting && (Boolean(video) || Boolean(findVideo))

    const togglePicker = async () => {
        if (picking) {
            setPicking(false)
            return
        }
        if (!video && findVideo && !(await findVideo())) return
        setPicking(true)
    }

    return (
        <li className={className} aria-current={current ? 'true' : undefined}>
            {!waiting && !current && <div className={styles.queueRow__hit} onClick={busy ? undefined : onPlay} aria-hidden="true" />}
            <span className={styles.queueRow__num} aria-hidden="true">{number}</span>
            <span className={styles.queueRow__thumb} aria-hidden="true">
                {video?.thumbnail
                    ? <img src={video.thumbnail} alt="" loading="lazy" />
                    : <FaMusic className={styles.queueRow__thumbIcon} />}
                {current && <FaVolumeUp className={styles.queueRow__playingIcon} />}
            </span>
            <span className={styles.queueRow__main}>
                <span className={styles.queueRow__title} title={title}>{title}</span>
                <span className={styles.queueRow__meta}>
                    {current && <span className={styles.queueRow__nowTag}>Now playing</span>}
                    {meta}
                </span>
                {progress !== null && (
                    <span className={styles.queueRow__progress} aria-hidden="true">
                        <span style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
                    </span>
                )}
            </span>
            <span className={video?.duration > 0 ? styles.queueRow__duration : `${styles.queueRow__duration} ${styles.queueRow__durationUnknown}`}>{duration}</span>
            {!waiting && (
                <span className={styles.queueRow__actions}>
                    {!current && (
                        <button
                            type="button"
                            className={`${styles.queueRow__action} ${styles.queueRow__actionPlay}`}
                            onClick={onPlay}
                            disabled={busy}
                            aria-label={`Play ${title}`}
                            title="Play now"
                        >
                            <FaPlay aria-hidden="true" />
                        </button>
                    )}
                    {onAdd && (
                        <button
                            type="button"
                            className={styles.queueRow__action}
                            onClick={onAdd}
                            disabled={busy}
                            aria-label={`Add ${title} to queue`}
                            title="Add to queue"
                        >
                            <FaPlus aria-hidden="true" />
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            className={styles.queueRow__action}
                            onClick={onRemove}
                            aria-label={removeLabel}
                            title={removeLabel}
                        >
                            <FaTimes aria-hidden="true" />
                        </button>
                    )}
                    {canPick && (
                        <button
                            type="button"
                            className={picking ? `${styles.queueRow__action} ${styles.queueRow__actionOpen}` : styles.queueRow__action}
                            onClick={togglePicker}
                            disabled={busy}
                            aria-expanded={picking}
                            aria-label={`Add ${title} to a playlist`}
                            title="Add to playlist"
                        >
                            <FaListUl aria-hidden="true" />
                        </button>
                    )}
                </span>
            )}
            {picking && video && (
                <div className={styles.queueRow__picker}>
                    <PlaylistPicker video={video} onCreated={() => setPicking(false)} />
                </div>
            )}
        </li>
    )
}

export default QueuePanel
