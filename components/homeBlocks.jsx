import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from '../styles/Home.module.css'
import listStyles from '../styles/player.module.css'
import { useNowPlaying } from '../context/nowPlayingContext'
import { QueueRow, candidateMeta } from './queuePanel'
import { continueListening, becauseSeed, vibeChips } from '../core/home/homeSections'
import resolveTrack from '../core/track/resolveTrack'
import { formatTrackNumber } from '../core/format/trackNumber'
import { ConvertSecToMin } from '../utils/convertSecondToMinutes'

// "Because you listened to …" shows the first few of the seed's Similar vibe list.
const BECAUSE_ROWS = 6

// Home under the hero: what was left half-heard, more like the last track
// really listened to, and vibes to start from — all from what this browser
// already keeps (positions, history, tag likes). A block with nothing to show
// isn't rendered.
const HomeBlocks = () => {
    const {
        positions, history, affinity, similarListFor, loadSimilarFor, playCandidate, ensureVideo, open, expand,
        startVibe, vibeStart, forgetPosition,
    } = useNowPlaying()

    // Picked once per visit (history hydrates a moment after mount), so
    // listening on while Home is open doesn't swap the list under the cursor.
    const [seed, setSeed] = useState(null)
    useEffect(() => {
        if (!seed) setSeed(becauseSeed(history))
    }, [seed, history])
    useEffect(() => {
        if (seed) loadSimilarFor(seed)
    }, [seed, loadSimilarFor])

    const resume = continueListening(positions)
    const because = seed ? similarListFor(seed.id) : null
    const chips = vibeChips(affinity)

    return (
        <div className={styles.homeBlocks}>
            {resume.length > 0 && (
                <section className={`${listStyles.listBlock} ${styles.blockContinue}`} aria-labelledby="home-continue">
                    <header className={listStyles.listBlock__header}>
                        <h2 id="home-continue" className={listStyles.listBlock__title}>Continue listening</h2>
                        <p className={listStyles.listBlock__subtitle}>Long tracks you left part-way</p>
                    </header>
                    <ol className={listStyles.queueList}>
                        {resume.map(({ video, seconds, progress }, i) => (
                            <QueueRow
                                key={video.id}
                                number={formatTrackNumber(i + 1, resume.length)}
                                video={video}
                                title={video.title}
                                meta={`${ConvertSecToMin(seconds)} / ${ConvertSecToMin(video.duration)} · ${video.channel?.name ?? ''}`}
                                progress={progress}
                                onPlay={() => open(video)}
                                onRemove={() => forgetPosition(video.id)}
                                removeLabel={`Forget where you left ${video.title}`}
                                pickable={false}
                            />
                        ))}
                    </ol>
                    <p className={listStyles.listBlock__note}>
                        <Link href="/history" className={styles.homeLink}>See all history</Link>
                    </p>
                </section>
            )}

            {because && because.status !== 'unavailable' && because.status !== 'unidentified' && (
                <section className={`${listStyles.listBlock} ${styles.blockBecause}`} aria-labelledby="home-because">
                    <header className={listStyles.listBlock__header}>
                        <h2 id="home-because" className={listStyles.listBlock__title}>Because you listened to</h2>
                        <p className={listStyles.listBlock__subtitle}>&ldquo;{resolveTrack(seed)?.title ?? seed.title}&rdquo;</p>
                    </header>
                    {because.status === 'loading' ? (
                        <p className={listStyles.listBlock__note} role="status">Finding tracks with a similar vibe…</p>
                    ) : because.status === 'error' ? (
                        <p className={listStyles.listBlock__note} role="status">Couldn&apos;t load suggestions right now</p>
                    ) : because.candidates.length === 0 ? (
                        <p className={listStyles.listBlock__note} role="status">No tracks with a similar vibe found</p>
                    ) : (
                        <>
                            <ol className={listStyles.queueList}>
                                {because.candidates.slice(0, BECAUSE_ROWS).map((candidate, rank) => (
                                    <QueueRow
                                        key={candidate.id}
                                        number={formatTrackNumber(rank + 1, BECAUSE_ROWS)}
                                        video={candidate.video}
                                        title={`${candidate.artist} – ${candidate.title}`}
                                        meta={candidateMeta(candidate)}
                                        busy={candidate.resolving === 'loading'}
                                        onPlay={() => playCandidate(candidate, 'now').then(expand)}
                                        onAdd={() => playCandidate(candidate, 'queue')}
                                        findVideo={() => ensureVideo(candidate)}
                                    />
                                ))}
                            </ol>
                            <p className={listStyles.listBlock__credit}>
                                Picked from <a href="https://www.last.fm" target="_blank" rel="noreferrer">Last.fm</a> listener data
                            </p>
                        </>
                    )}
                </section>
            )}

            <section className={`${listStyles.listBlock} ${styles.blockVibes}`} aria-labelledby="home-vibes">
                <header className={listStyles.listBlock__header}>
                    <h2 id="home-vibes" className={listStyles.listBlock__title}>Start from a vibe</h2>
                    <p className={listStyles.listBlock__subtitle}>Tap one to play music like it</p>
                </header>
                <ul className={`${listStyles.tagChips} ${styles.homeChips}`}>
                    {chips.map((tag) => {
                        const starting = vibeStart?.tag === tag && vibeStart.status === 'idle'
                        return (
                            <li key={tag}>
                                <button type="button" onClick={() => startVibe(tag)} aria-busy={starting} title={`Play the "${tag}" vibe`}>
                                    {starting ? `${tag}…` : tag}
                                </button>
                            </li>
                        )
                    })}
                </ul>
                {vibeStart && vibeStart.status !== 'idle' && (
                    <p className={listStyles.listBlock__note} role="status">
                        {vibeStart.status === 'unavailable'
                            ? 'Vibes aren’t available on this server'
                            : `Couldn't find music for "${vibeStart.tag}"`}
                    </p>
                )}
                {vibeStart?.waiting && vibeStart.status === 'idle' && (
                    <p className={listStyles.listBlock__note} role="status">Couldn&apos;t reach Last.fm. Trying again shortly.</p>
                )}
            </section>
        </div>
    )
}

export default HomeBlocks
