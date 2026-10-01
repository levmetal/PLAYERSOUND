import { useState } from "react"
import styles from "../styles/soundlist.module.css"
import { useDispatchContext, usePlaylists } from "../context/libraryContext/libraryContext"
import { useNowPlaying } from "../context/nowPlayingContext"

// "Add to playlist": a checkbox per playlist (Favorites included) and a field
// to start a new one with this track in it. Shared by a search row's ⋯ menu
// and the player's queue rows, so both behave — and read — the same.
// Saving a track also counts as a mild like for the Similar vibe signals.
const PlaylistPicker = ({ video, onCreated }) => {
    const playlists = usePlaylists()
    const dispatch = useDispatchContext()
    const { like } = useNowPlaying()
    const [newName, setNewName] = useState("")

    const isIn = (playlistId) =>
        playlists.find((playlist) => playlist.id === playlistId)?.tracks.some((track) => track.id === video.id) ?? false

    const toggle = (playlistId) => {
        const alreadyIn = isIn(playlistId)
        if (!alreadyIn) like(video.id)
        dispatch({
            type: alreadyIn ? "REMOVE_FROM_PLAYLIST" : "ADD_TO_PLAYLIST",
            payload: alreadyIn
                ? { playlistId, trackId: video.id }
                : { playlistId, track: video },
        })
    }

    const create = (e) => {
        e.preventDefault()
        const name = newName.trim()
        if (!name) return
        dispatch({ type: "CREATE_PLAYLIST", payload: { name, track: video } })
        like(video.id)
        setNewName("")
        onCreated?.()
    }

    return (
        <>
            <p className={styles.rowMenu__heading}>Add to playlist</p>
            <ul className={styles.playlistMenu__list}>
                {playlists.map((playlist) => (
                    <li key={playlist.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={isIn(playlist.id)}
                                onChange={() => toggle(playlist.id)}
                            />
                            {playlist.name}
                        </label>
                    </li>
                ))}
            </ul>
            <form className={styles.playlistMenu__create} onSubmit={create}>
                <input
                    type="text"
                    aria-label="New playlist name"
                    placeholder="New playlist"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <button type="submit" className="pixel-depth">Add</button>
            </form>
        </>
    )
}

export default PlaylistPicker
