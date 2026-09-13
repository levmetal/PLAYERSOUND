import styles from '../styles/library.module.css'
import SoundItem from "../components/soundItem";
import { useState, Suspense, lazy } from "react";
import { usePlaylists, useDispatchContext, FAVORITES_ID } from "../context/libraryContext/libraryContext";

const Modal = lazy(() => import('../components/modal'))

const Library = () => {

    const playlists = usePlaylists()
    const dispatch = useDispatchContext()
    const [selectedId, setSelectedId] = useState(FAVORITES_ID)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [openModal, setOpenModal] = useState(false)
    const [itemModal, setItemModal] = useState(null)

    const triggerModal = (itemModal) => {
        setOpenModal(!openModal)
        setItemModal(itemModal)
    }

    const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedId) ?? playlists[0]

    const createPlaylist = (e) => {
        e.preventDefault()
        const name = newPlaylistName.trim()
        if (!name) return
        dispatch({ type: "CREATE_PLAYLIST", payload: { name } })
        setNewPlaylistName("")
    }

    const deletePlaylist = (id) => {
        if (id === FAVORITES_ID) return
        dispatch({ type: "DELETE_PLAYLIST", payload: id })
        if (selectedId === id) setSelectedId(FAVORITES_ID)
    }

    return (
            <div className={styles.container}>
                {openModal && <Suspense> <Modal item={itemModal} triggerModal={triggerModal} /> </Suspense>}
                <p className={styles.eyebrow}>SYSTEM_LOG // PLAYLISTS</p>
                <h1 className={styles.library__title}>Playlists</h1>

                <div className={styles.playlistSwitcher}>
                    {playlists.map((playlist) => (
                        <div key={playlist.id} className={styles.playlistTabWrapper}>
                            <button
                                className={playlist.id === selectedPlaylist.id ? styles.playlistTabActive : styles.playlistTab}
                                onClick={() => setSelectedId(playlist.id)}
                            >
                                {playlist.name} <span className={styles.playlistCount}>({playlist.tracks.length})</span>
                            </button>
                            {playlist.id !== FAVORITES_ID && (
                                <button
                                    className={styles.playlistDelete}
                                    aria-label={`Delete playlist "${playlist.name}"`}
                                    title="Delete playlist"
                                    onClick={() => deletePlaylist(playlist.id)}
                                >&times;</button>
                            )}
                        </div>
                    ))}

                    <form className={styles.playlistCreate} onSubmit={createPlaylist}>
                        <label htmlFor="new-playlist-name" className="sr-only">New playlist name</label>
                        <input
                            id="new-playlist-name"
                            name="playlistName"
                            autoComplete="off"
                            type="text"
                            placeholder="New playlist name"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                        />
                        <button type="submit" className="pixel-depth">+ Create</button>
                    </form>
                </div>

                <ul className={styles.list__container}>
                    {selectedPlaylist.tracks.length === 0 ? (
                        <p className={styles.emptyState}>No tracks saved here yet.</p>
                    ) : (
                        selectedPlaylist.tracks.map(sound => (
                            <SoundItem
                                key={sound.id}
                                item={sound}
                                triggerModal={triggerModal}
                            />
                        ))
                    )}
                </ul>
            </div>
    )
}
export default Library
