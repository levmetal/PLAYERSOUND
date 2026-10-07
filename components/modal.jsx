import { useEffect, useRef, useState } from "react"
import styles from '../styles/player.module.css'
import Player from '../components/player'
import GlobePanel from '../components/globePanel'
import QueuePanel from '../components/queuePanel'
import { useNowPlaying } from '../context/nowPlayingContext'
import { FaTimes, FaChevronDown, FaChevronUp, FaStop } from 'react-icons/fa'

// Matches the console-out/backdrop-out keyframe durations in player.module.css —
// keeps the expanded console on screen long enough to play its own ease-in
// exit before it collapses into the mini-player (or goes away on stop).
const CLOSE_ANIMATION_MS = 200

const SOURCE_PREFIX = { search: 'SEARCH', playlist: 'PLAYLIST', radio: 'SIMILAR VIBE', vibe: 'VIBE', history: 'HISTORY' }
const pad2 = (n) => String(n).padStart(2, '0')

// "NOW PLAYING // PLAYLIST: FAVORITES // TRK 03/12" for a queue, the plain
// signal-lock label for a lone track.
const headerLabel = (source, position) => {
    if (!position || position.total < 2) return 'NOW PLAYING // SIG. LOCK'
    const prefix = SOURCE_PREFIX[source?.type]
    const from = prefix ? `${prefix}: ${source.label} // ` : ''
    return `NOW PLAYING // ${from}TRK ${pad2(position.current)}/${pad2(position.total)}`
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

// One component, two layouts: the full console (`expanded`, a modal dialog)
// and the docked mini-player bar. Mounted once from pages/_app.js (see
// context/nowPlayingContext.js), and it never remounts between the two —
// same DOM tree, only CSS classes change — so the <audio> element or the
// YouTube iframe inside Player keep playing untouched across the switch
// (moving an iframe in the DOM would reload it).
const Modal = ({ item, expanded, onMinimize, onExpand, onStop }) => {
    const {
        source, position, notice, handoff, current, radio, setRadio, dismissHandoff,
    } = useNowPlaying()
    const [closing, setClosing] = useState(false)
    const closingRef = useRef(false)
    const dialogRef = useRef(null)
    const toggleButtonRef = useRef(null)

    // Plays the expanded console's exit animation, then hands off (minimize
    // or stop). Ref-guarded so the keydown listener below — registered per
    // expanded session — never reads a stale `closing` value.
    const animateOut = (then) => {
        if (closingRef.current) return
        closingRef.current = true
        setClosing(true)
        setTimeout(() => {
            closingRef.current = false
            setClosing(false)
            then()
        }, CLOSE_ANIMATION_MS)
    }
    const requestMinimize = () => animateOut(onMinimize)
    const requestStop = () => (expanded ? animateOut(onStop) : onStop())
    const requestMinimizeRef = useRef(requestMinimize)
    requestMinimizeRef.current = requestMinimize

    // Standard modal-dialog keyboard contract, only while expanded: focus
    // moves into the dialog, Escape minimizes it (playback continues in the
    // mini-player — closing no longer stops the music), Tab/Shift+Tab cycle
    // inside it, and focus returns to whatever opened it once it collapses.
    useEffect(() => {
        if (!expanded) return undefined
        const previouslyFocused = document.activeElement
        toggleButtonRef.current?.focus()

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                requestMinimizeRef.current()
                return
            }
            if (e.key !== 'Tab' || !dialogRef.current) return
            const focusables = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
                .filter((el) => el.offsetParent !== null || el === document.activeElement)
            if (focusables.length === 0) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
                e.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
        }
    }, [expanded])

    const description = item.description?.trim()

    const wrapperClass = expanded
        ? (closing ? `${styles.backdrop} ${styles.backdropClosing}` : styles.backdrop)
        : styles.backdropMini
    const consoleClass = [
        styles.console,
        'hud-frame',
        expanded ? '' : styles.consoleMini,
        closing ? styles.consoleClosing : '',
    ].filter(Boolean).join(' ')

    return (
        <>
            <div className={wrapperClass} onClick={expanded ? requestMinimize : undefined}>
                <div
                    ref={dialogRef}
                    role={expanded ? 'dialog' : 'region'}
                    aria-modal={expanded ? 'true' : undefined}
                    aria-label={expanded ? `Now playing: ${item.title}` : 'Now playing'}
                    data-player-state={expanded ? 'expanded' : 'mini'}
                    className={consoleClass}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.console__header}>
                        {notice ? (
                            <span className={`${styles.console__headerLabel} ${styles.headerNotice}`} aria-hidden="true">{notice}</span>
                        ) : (
                            <span className={styles.console__headerLabel} aria-hidden="true">{headerLabel(source, position)}</span>
                        )}
                        {/* Always mounted, so screen readers hear each new notice. */}
                        <span className="sr-only" role="status" aria-live="polite">{notice ?? handoff ?? ''}</span>
                        <div className={styles.console__headerActions}>
                            {/* The mini-player's Autoplay switch; expanded, it sits with
                                the list it controls (components/queuePanel.jsx). */}
                            <button
                                className={radio.enabled ? `${styles.btn__close} ${styles.radioOn} ${styles.miniAutoplay}` : `${styles.btn__close} ${styles.miniAutoplay}`}
                                onClick={() => setRadio(!radio.enabled)}
                                disabled={radio.status === 'unavailable'}
                                aria-pressed={radio.enabled}
                                aria-label="Autoplay similar vibe"
                                title={radio.status === 'unavailable'
                                    ? "Similar vibe isn't available on this server"
                                    : radio.enabled ? 'Autoplay on: tracks with a similar vibe play when your queue ends' : 'Autoplay off: playback stops when your queue ends'}
                            >
                                <span className={styles.miniAutoplay__text}>Autoplay</span>
                            </button>
                            <button
                                ref={toggleButtonRef}
                                className={styles.btn__close}
                                onClick={expanded ? requestMinimize : onExpand}
                                aria-label={expanded ? 'Minimize player' : 'Expand player'}
                                title={expanded ? 'Minimize' : 'Expand'}
                            >
                                {expanded ? <FaChevronDown aria-hidden="true" /> : <FaChevronUp aria-hidden="true" />}
                            </button>
                            <button
                                className={`${styles.btn__close} ${styles.btn__stop}`}
                                onClick={requestStop}
                                aria-label="Stop and close player"
                                title="Stop and close player"
                            >
                                <FaStop aria-hidden="true" />
                                <span className={styles.btn__stopText} aria-hidden="true">Stop</span>
                            </button>
                        </div>
                    </div>

                    {handoff && !notice && (
                        <div className={styles.handoff}>
                            <span>{handoff}</span>
                            <button type="button" onClick={() => setRadio(false)}>Stop autoplay</button>
                            <button type="button" onClick={dismissHandoff} aria-label="Dismiss">
                                <FaTimes aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {/* Grid, not stacked rows (see .faceplate in player.module.css):
                        [video/thumbnail] [transport] [globe] side by side, with the
                        description as one thin strip underneath — uses the console's
                        width instead of its height, so the transport never has to
                        scroll into view. Player renders the first two cells itself
                        (it owns the engine, and so which window to show). */}
                    <div className={styles.faceplate}>
                        {/* Not keyed by track: one Player (and one YouTube player /
                            <audio>) for the whole listening session, so the next track
                            starts even while the tab is in the background. It resets
                            its own per-track state when `item` changes. */}
                        <Player item={item} />

                        <div className={styles.globeWindow}>
                            <GlobePanel />
                        </div>

                        {description && (
                            <p className={styles.infoStrip}>{description}</p>
                        )}
                    </div>

                    <QueuePanel item={item} />

                    <div className={styles.console__footer}>
                        {process.env.NEXT_PUBLIC_PLAYBACK_MODE === 'iframe' && (
                            // Honest, not apologetic: this build plays via YouTube's own
                            // player (ads possible) —
                            // point people at the real, ad-free experience instead of
                            // silently degrading. See README.md's "Two ways to run this".
                            <span>
                                DEMO // via YouTube ·{' '}
                                <a href="https://github.com/levmetal/PLAYERSOUND" target="_blank" rel="noreferrer">
                                    run the repo locally for no ads
                                </a>
                                {' '}·{' '}
                            </span>
                        )}
                        {current?.origin === 'radio' && (
                            // Required by the Last.fm API terms wherever their data is shown.
                            <span>
                                <a href="https://www.last.fm" target="_blank" rel="noreferrer">Powered by AudioScrobbler</a>
                                {' '}·{' '}
                            </span>
                        )}
                        <span>PLAYERSOUND-84</span>
                    </div>
                </div>
            </div>
            {/* In-flow spacer at the end of the page so the docked mini-player
                (position: fixed) never covers the last rows of a list. */}
            <div className={styles.miniSpacer} aria-hidden="true" />
        </>
    )
}
export default Modal
