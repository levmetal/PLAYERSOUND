
import styles from "../styles/soundlist.module.css"
import { FaPlus, FaPlay, FaCheck, FaChevronDown } from 'react-icons/fa'
import { useDispatchContext, usePlaylists, FAVORITES_ID } from "../context/libraryContext/libraryContext"
import { useState } from "react";
import { RemoveSpecialChar } from "../utils/removeSpecialChar";
import { ConvertSecToMin } from "../utils/convertSecondToMinutes";

// A context menu shouldn't animate on entrance, only on exit — this just
// keeps it mounted long enough to play playlistMenuClosing's ease-in fade
// (styles/soundlist.module.css) instead of vanishing instantly.
const MENU_CLOSE_MS = 120

const SoundItem = ({ item, triggerModal }) => {

    const dispatch = useDispatchContext()
    const playlists = usePlaylists()

    const [menuOpen, setMenuOpen] = useState(false)
    const [menuClosing, setMenuClosing] = useState(false)
    const [newPlaylistName, setNewPlaylistName] = useState("")

    const closeMenu = () => {
        if (menuClosing) return
        setMenuClosing(true)
        setTimeout(() => {
            setMenuOpen(false)
            setMenuClosing(false)
        }, MENU_CLOSE_MS)
    }

    const toggleMenu = () => (menuOpen ? closeMenu() : setMenuOpen(true))

    const titlefix = RemoveSpecialChar(item.title)

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
        closeMenu()
    }

    return (
        <li className={styles.row}>
            <div className={styles.row__thumb} onClick={() => triggerModal(item)}>
                <img src={item.thumbnail} alt="image-song" />
                <FaPlay className={styles.row__playIcon} />
            </div>

            <div className={styles.row__info}>
                <span className={styles.row__title}>{titlefix}</span>
                <span className={styles.row__channel}>
                    {item.channel.verified ? item.channel.name : `No Oficial: ${item.channel.name}`}
                </span>
            </div>

            {typeof item.duration === 'number' && (
                <span className={styles.row__duration}>{ConvertSecToMin(item.duration)}</span>
            )}

            <div className={styles.saveControls}>
                <div className={styles.saveControls__buttons}>
                    <button
                        className={isFavorite ? `${styles.addBtn} ${styles.addBtnActive}` : styles.addBtn}
                        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        onClick={toggleFavorite}
                    >{isFavorite ? <FaCheck /> : <FaPlus />}</button>

                    <button
                        className={styles.menuToggleBtn}
                        title="Add to playlist"
                        onClick={toggleMenu}
                    ><FaChevronDown /></button>
                </div>

                {menuOpen && (
                    <div className={`${styles.playlistMenu} hud-frame ${menuClosing ? styles.playlistMenuClosing : ''}`}>
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
