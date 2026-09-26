import styles from "../styles/soundlist.module.css"
import { FaPlay, FaHeart, FaRegHeart, FaCheck, FaVolumeUp } from 'react-icons/fa'
import { MdPlaylistAdd } from 'react-icons/md'
import { useDispatchContext, usePlaylists, FAVORITES_ID } from "../context/libraryContext/libraryContext"
import { useNowPlaying } from "../context/nowPlayingContext"
import { useEffect, useRef, useState } from "react";
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";
import { formatViews } from "../utils/formatViews";
import { formatUploaded } from "../utils/sortSearchResults";

// A context menu shouldn't animate on entrance, only on exit — this just
// keeps it mounted long enough to play playlistMenuClosing's ease-in fade
// (styles/soundlist.module.css) instead of vanishing instantly.
const MENU_CLOSE_MS = 120

// .playlistMenu's max-height (14rem) plus its offset from the toggle.
const MENU_SPACE_REM = 14.5

const remToPx = (rem) => rem * parseFloat(getComputedStyle(document.documentElement).fontSize)

// ↑/↓ move between rows' primary buttons, across channel groups too.
const focusSiblingRow = (current, step) => {
    const rows = Array.from(document.querySelectorAll('[data-row-primary]'))
    rows[rows.indexOf(current) + step]?.focus()
}

// `onPlay` lets the list decide what a click queues (its visible results, a
// playlist); without it the row plays on its own.
const SoundItem = ({ item, onPlay, showStats = true, highlightStat = null }) => {

    const dispatch = useDispatchContext()
    const { item: nowPlaying, open } = useNowPlaying()
    const playlists = usePlaylists()
    const isCurrent = nowPlaying?.id === item.id

    const [menuOpen, setMenuOpen] = useState(false)
    const [menuClosing, setMenuClosing] = useState(false)
    const [menuUp, setMenuUp] = useState(false)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [thumbFailed, setThumbFailed] = useState(false)

    const actionsRef = useRef(null)
    const toggleRef = useRef(null)
    const menuRef = useRef(null)
    const closeTimerRef = useRef(null)

    useEffect(() => () => clearTimeout(closeTimerRef.current), [])

    const closeMenu = (restoreFocus = false) => {
        if (!menuOpen || menuClosing) return
        setMenuClosing(true)
        if (restoreFocus) toggleRef.current?.focus()
        closeTimerRef.current = setTimeout(() => {
            setMenuOpen(false)
            setMenuClosing(false)
        }, MENU_CLOSE_MS)
    }

    const openMenu = () => {
        // Open upward when the space below (minus the docked mini-player,
        // if one is showing) can't fit the menu — otherwise the last rows'
        // menus open hidden behind the bar.
        const rect = toggleRef.current.getBoundingClientRect()
        const miniPlayer = nowPlaying
            ? remToPx(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mini-player-height')) || 0)
            : 0
        setMenuUp(window.innerHeight - miniPlayer - rect.bottom < remToPx(MENU_SPACE_REM))
        setMenuOpen(true)
    }

    const toggleMenu = () => (menuOpen ? closeMenu() : openMenu())

    // While open: focus moves into the menu, Escape closes it (focus back on
    // the toggle), a click anywhere outside closes it.
    useEffect(() => {
        if (!menuOpen || menuClosing) return undefined
        menuRef.current?.querySelector('input')?.focus()

        const handlePointerDown = (e) => {
            if (!actionsRef.current?.contains(e.target)) closeMenu()
        }
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            closeMenu(true)
        }
        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuOpen, menuClosing])

    const isInPlaylist = (playlistId) =>
        playlists.find((playlist) => playlist.id === playlistId)?.tracks.some((track) => track.id === item.id) ?? false

    const isFavorite = isInPlaylist(FAVORITES_ID)

    const toggleFavorite = () => {
        dispatch({
            type: isFavorite ? "REMOVE_FROM_FAVORITES" : "ADD_TO_FAVORITES",
            payload: isFavorite ? item.id : item,
        })
    }

    const togglePlaylist = (playlistId) => {
        const alreadyIn = isInPlaylist(playlistId)
        dispatch({
            type: alreadyIn ? "REMOVE_FROM_PLAYLIST" : "ADD_TO_PLAYLIST",
            payload: alreadyIn
                ? { playlistId, trackId: item.id }
                : { playlistId, track: item },
        })
    }

    const createPlaylistWithTrack = (e) => {
        e.preventDefault()
        const name = newPlaylistName.trim()
        if (!name) return
        dispatch({ type: "CREATE_PLAYLIST", payload: { name, track: item } })
        setNewPlaylistName("")
        closeMenu(true)
    }

    const handleRowKeys = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        focusSiblingRow(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1)
    }

    const title = item.title || 'Untitled'
    const channelName = item.channel?.name || 'Unknown channel'
    const verified = Boolean(item.channel?.verified)
    // 0/missing = unknown (e.g. a live stream) — dashes, not a fake 00:00.
    const durationText = typeof item.duration === 'number' && item.duration > 0 ? ConvertSecToMin(item.duration) : '--:--'
    const views = showStats ? formatViews(item.views) : null
    const uploaded = showStats ? formatUploaded(item.uploaded) : null
    const showThumb = Boolean(item.thumbnail) && !thumbFailed
    const menuId = `playlist-menu-${item.id}`

    const rowClass = [
        styles.row,
        showStats ? '' : styles.rowNoStats,
        isCurrent ? styles.rowCurrent : '',
        menuOpen ? styles.rowMenuOpen : '',
    ].filter(Boolean).join(' ')

    const statClass = (key) => (highlightStat === key ? `${styles.row__stat} ${styles.row__statActive}` : styles.row__stat)

    return (
        <li className={rowClass} aria-current={isCurrent ? 'true' : undefined}>
            <div className={styles.row__thumb} aria-hidden="true">
                {showThumb ? (
                    <img src={item.thumbnail} alt="" loading="lazy" onError={() => setThumbFailed(true)} />
                ) : (
                    <span className={styles.row__thumbFallback}>No signal</span>
                )}
                {isCurrent
                    ? <FaVolumeUp className={styles.row__thumbIcon} />
                    : <FaPlay className={styles.row__thumbIcon} />}
                <span className={styles.row__thumbDuration}>{durationText}</span>
            </div>

            <div className={styles.row__info}>
                {/* Stretched over the whole row (::after), so the entire row opens
                    the player; the action buttons sit above it (z-index). */}
                <button
                    type="button"
                    data-row-primary
                    className={styles.row__primary}
                    onClick={onPlay ?? (() => open(item))}
                    onKeyDown={handleRowKeys}
                    aria-label={isCurrent ? `Now playing: ${title}. Open player` : `Play ${title}`}
                    title={title}
                >
                    <span className={styles.row__title}>{title}</span>
                </button>
                <span className={styles.row__meta}>
                    {isCurrent && <span className={styles.row__nowTag}>Now playing</span>}
                    <span className={styles.row__channel}>{channelName}</span>
                    {verified && <FaCheck className={styles.row__verified} role="img" aria-label="Verified channel" />}
                    {views && <span className={styles.row__metaStat}>{views}</span>}
                    {uploaded && <span className={styles.row__metaStat}>{uploaded}</span>}
                </span>
            </div>

            {showStats && <span className={statClass('views')}>{views}</span>}
            {showStats && <span className={statClass('recent')}>{uploaded}</span>}

            <span className={styles.row__duration}>{durationText}</span>

            <div className={styles.row__actions} ref={actionsRef}>
                <button
                    type="button"
                    className={isFavorite ? `${styles.actionBtn} ${styles.favActive}` : styles.actionBtn}
                    onClick={toggleFavorite}
                    aria-pressed={isFavorite}
                    aria-label="Favorite"
                    title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                    {isFavorite ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
                </button>

                <button
                    type="button"
                    ref={toggleRef}
                    className={menuOpen && !menuClosing ? `${styles.actionBtn} ${styles.actionBtnOpen}` : styles.actionBtn}
                    onClick={toggleMenu}
                    aria-expanded={menuOpen && !menuClosing}
                    aria-controls={menuOpen ? menuId : undefined}
                    aria-label="Add to playlist"
                    title="Add to playlist"
                >
                    <MdPlaylistAdd aria-hidden="true" />
                </button>

                {menuOpen && (
                    <div
                        id={menuId}
                        ref={menuRef}
                        role="group"
                        aria-label={`Playlists for ${title}`}
                        className={[
                            styles.playlistMenu,
                            'hud-frame',
                            menuUp ? styles.playlistMenuUp : '',
                            menuClosing ? styles.playlistMenuClosing : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <ul className={styles.playlistMenu__list}>
                            {playlists.map((playlist) => (
                                <li key={playlist.id}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isInPlaylist(playlist.id)}
                                            onChange={() => togglePlaylist(playlist.id)}
                                        />
                                        {playlist.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                        <form className={styles.playlistMenu__create} onSubmit={createPlaylistWithTrack}>
                            <input
                                type="text"
                                aria-label="New playlist name"
                                placeholder="New playlist"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                            />
                            <button type="submit" className="pixel-depth">Add</button>
                        </form>
                    </div>
                )}
            </div>
        </li>
    )
}
export default SoundItem
