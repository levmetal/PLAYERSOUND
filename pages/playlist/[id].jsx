import styles from '../../styles/library.module.css'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FaPlay, FaSave } from 'react-icons/fa'
import SoundItem from '../../components/soundItem'
import { useDispatchContext } from '../../context/libraryContext/libraryContext'
import { useNowPlaying } from '../../context/nowPlayingContext'
import { formatTrackNumber } from '../../core/format/trackNumber'
import { lookupPlaylist } from '../../utils/playlistClient'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// A YouTube playlist pasted into a search field: its tracks to play or to
// keep as a local playlist. Fetched client-side (like the search page) so
// the route change itself never waits on YouTube.
const PlaylistPreview = () => {
    const router = useRouter()
    const dispatch = useDispatchContext()
    const { playQueue } = useNowPlaying()
    const [state, setState] = useState({ status: 'loading', playlist: null, error: null })
    const [saved, setSaved] = useState(false)

    const id = router.query.id

    useEffect(() => {
        if (!router.isReady) return undefined
        let cancelled = false
        setState({ status: 'loading', playlist: null, error: null })
        setSaved(false)
        lookupPlaylist(id).then((result) => {
            if (cancelled) return
            setState(result.ok
                ? { status: 'done', playlist: result.playlist, error: null }
                : { status: 'error', playlist: null, error: result.error })
        })
        return () => { cancelled = true }
    }, [router.isReady, id])

    const { status, playlist, error } = state
    const videos = playlist?.videos ?? []
    const truncated = playlist ? playlist.total > videos.length : false
    const name = playlist?.title || 'YouTube playlist'

    const playFrom = (index) => playQueue(videos, index, { type: 'playlist', label: name })

    const save = () => {
        dispatch({ type: 'CREATE_PLAYLIST', payload: { name, tracks: videos } })
        setSaved(true)
    }

    return (
        <div className={styles.container}>
            <Head><title>{`${status === 'done' ? name : 'Playlist'} · PlayerSound`}</title></Head>
            <p className={styles.eyebrow}>SYSTEM_LOG // PLAYLIST LINK</p>

            {status === 'loading' && (
                <p className={styles.emptyState} role="status" aria-live="polite">Loading playlist…</p>
            )}

            {status === 'error' && (
                <>
                    <h1 className={styles.library__title}>Playlist</h1>
                    <p className={styles.emptyState} role="alert">{error}</p>
                    <Link href="/"><a className={styles.playAll}>Back to search</a></Link>
                </>
            )}

            {status === 'done' && (
                <>
                    <h1 className={styles.library__title}>{name}</h1>

                    <div className={styles.playlistHeader}>
                        <h2 className={styles.playlistHeader__name}>
                            {playlist.author ? `by ${playlist.author} ` : ''}
                            <span className={styles.playlistCount}>
                                ({truncated
                                    ? `first ${videos.length} of ${playlist.total} tracks`
                                    : plural(videos.length, 'track')})
                            </span>
                        </h2>
                        <div className={styles.playlistActions}>
                            <button type="button" className={styles.playAll} onClick={() => playFrom(0)} disabled={!videos.length}>
                                <FaPlay aria-hidden="true" /> Play all
                            </button>
                            <button type="button" className={styles.playAll} onClick={save} disabled={!videos.length || saved}>
                                <FaSave aria-hidden="true" /> Save as playlist
                            </button>
                        </div>
                    </div>
                    <p className={styles.backupStatus} role="status" aria-live="polite">
                        {saved ? `Saved as "${name}"` : ''}
                    </p>

                    <ul className={styles.list__container}>
                        {videos.length === 0 ? (
                            <p className={styles.emptyState}>This playlist has no playable tracks</p>
                        ) : (
                            videos.map((video, index) => (
                                <SoundItem
                                    key={video.id}
                                    item={video}
                                    number={formatTrackNumber(index + 1, videos.length)}
                                    onPlay={() => playFrom(index)}
                                    showStats={false}
                                />
                            ))
                        )}
                    </ul>
                </>
            )}
        </div>
    )
}

export default PlaylistPreview
