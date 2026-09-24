import { useEffect, useRef, useState } from "react"
import styles from '../styles/player.module.css'
import Player from '../components/player'
import GlobePanel from '../components/globePanel'
import { FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa'

// Matches the console-out/backdrop-out keyframe durations in player.module.css —
// keeps the expanded console on screen long enough to play its own ease-in
// exit before it collapses into the mini-player (or goes away on stop).
const CLOSE_ANIMATION_MS = 200

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

// One component, two layouts: the full console (`expanded`, a modal dialog)
// and the docked mini-player bar. Mounted once from pages/_app.js (see
// context/nowPlayingContext.js), and it never remounts between the two —
// same DOM tree, only CSS classes change — so the <audio> element or the
// YouTube iframe inside Player keep playing untouched across the switch
// (moving an iframe in the DOM would reload it).
const Modal = ({ item, expanded, onMinimize, onExpand, onStop }) => {
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
                        <span className={styles.console__headerLabel} aria-hidden="true">NOW PLAYING // SIG. LOCK</span>
                        <div className={styles.console__headerActions}>
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
                                className={styles.btn__close}
                                onClick={requestStop}
                                aria-label="Stop and close player"
                                title="Stop"
                            >
                                <FaTimes aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    {/* Grid, not stacked rows (see .faceplate in player.module.css):
                        [video/thumbnail] [transport] [globe] side by side, with the
                        description as one thin strip underneath — uses the console's
                        width instead of its height, so the transport never has to
                        scroll into view. Player renders the first two cells itself
                        (it owns the engine, and so which window to show). */}
                    <div className={styles.faceplate}>
                        <Player item={item} />

                        <div className={styles.globeWindow}>
                            <GlobePanel />
                        </div>

                        {description && (
                            <p className={styles.infoStrip}>{description}</p>
                        )}
                    </div>

                    <div className={styles.console__footer}>
                        {process.env.NEXT_PUBLIC_PLAYBACK_MODE === 'iframe' && (
                            // Honest, not apologetic: this build plays via YouTube's own
                            // player (ads possible) —
                            // point people at the real, ad-free experience instead of
                            // silently degrading. See README.md's "Two ways to run this".
                            <span>
                                DEMO // via YouTube —{' '}
                                <a href="https://github.com/levmetal/PLAYERSOUND" target="_blank" rel="noreferrer">
                                    run the repo locally for no ads
                                </a>
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
