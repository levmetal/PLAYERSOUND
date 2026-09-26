import styles from '../styles/library.module.css'
import SoundItem from "../components/soundItem";
import { useRef, useState } from "react";
import { FaPlay, FaRandom } from "react-icons/fa";
import { MdRadio } from "react-icons/md";
import { usePlaylists, useDispatchContext, FAVORITES_ID } from "../context/libraryContext/libraryContext";
import { useNowPlaying } from "../context/nowPlayingContext";
import { toExport, parseImport, mergePlaylists } from "../core/library/exportFormat";
import shuffle from "../core/queue/shuffle";

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// The listener's own calendar date, not UTC's, for the backup file name.
const localDate = (date) =>
    [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('-')

const IMPORT_ERRORS = {
    'not-json': "That file is damaged or incomplete.",
    'invalid-playlists': "That file is damaged or incomplete.",
    'not-playersound': "That file isn't a PlayerSound backup.",
    'unsupported-version': "That backup was made by a newer version of PlayerSound.",
}

function importSummary({ playlists, tracks }) {
    if (!playlists && !tracks) return 'Already up to date — nothing new in that file.'
    const parts = []
    if (playlists) parts.push(plural(playlists, 'playlist'))
    if (tracks) parts.push(plural(tracks, 'track'))
    return `Imported ${parts.join(' and ')}.`
}

const Library = () => {

    const playlists = usePlaylists()
    const dispatch = useDispatchContext()
    const { playQueue, startPlaylistRadio, radio } = useNowPlaying()
    const [selectedId, setSelectedId] = useState(FAVORITES_ID)
    const [newPlaylistName, setNewPlaylistName] = useState("")
    const [backupStatus, setBackupStatus] = useState("")
    const importInputRef = useRef(null)
    const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedId) ?? playlists[0]
    const isEmpty = selectedPlaylist.tracks.length === 0

    // The whole playlist is the queue, from the first track or the clicked one.
    const playFrom = (index) => {
        playQueue(selectedPlaylist.tracks, index, { type: 'playlist', label: selectedPlaylist.name })
    }

    const playShuffled = () => {
        playQueue(shuffle(selectedPlaylist.tracks, Math.random), 0, { type: 'playlist', label: `${selectedPlaylist.name} · shuffled` })
    }

    const createPlaylist = (e) => {
        e.preventDefault()
        const name = newPlaylistName.trim()
        if (!name) return
        dispatch({ type: "CREATE_PLAYLIST", payload: { name } })
        setNewPlaylistName("")
    }

    const exportPlaylists = () => {
        const now = new Date()
        const blob = new Blob([JSON.stringify(toExport(playlists, now), null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `playersound-playlists-${localDate(now)}.json`
        link.click()
        URL.revokeObjectURL(url)
        setBackupStatus(`Exported ${plural(playlists.length, 'playlist')}.`)
    }

    const importPlaylists = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        const result = parseImport(await file.text())
        if (!result.ok) {
            setBackupStatus(IMPORT_ERRORS[result.error])
            return
        }
        setBackupStatus(importSummary(mergePlaylists(playlists, result.playlists).added))
        dispatch({ type: 'IMPORT', payload: { playlists: result.playlists } })
    }

    const deletePlaylist = (id) => {
        if (id === FAVORITES_ID) return
        dispatch({ type: "DELETE_PLAYLIST", payload: id })
        if (selectedId === id) setSelectedId(FAVORITES_ID)
    }

    return (
            <div className={styles.container}>
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

                <div className={styles.playlistHeader}>
                    <h2 className={styles.playlistHeader__name}>
                        {selectedPlaylist.name}{' '}
                        <span className={styles.playlistCount}>
                            ({selectedPlaylist.tracks.length} {selectedPlaylist.tracks.length === 1 ? 'track' : 'tracks'})
                        </span>
                    </h2>
                    <div className={styles.playlistActions}>
                        <button
                            type="button"
                            className={styles.playAll}
                            onClick={() => playFrom(0)}
                            disabled={isEmpty}
                        >
                            <FaPlay aria-hidden="true" /> Play all
                        </button>
                        <button type="button" className={styles.playAll} onClick={playShuffled} disabled={isEmpty}>
                            <FaRandom aria-hidden="true" /> Shuffle
                        </button>
                        {radio.status !== 'unavailable' && (
                            <button
                                type="button"
                                className={styles.playAll}
                                onClick={() => startPlaylistRadio(selectedPlaylist.tracks, selectedPlaylist.name)}
                                disabled={isEmpty}
                                title="Play tracks like the ones in this playlist"
                            >
                                <MdRadio aria-hidden="true" /> Radio
                            </button>
                        )}
                    </div>
                </div>

                <ul className={styles.list__container}>
                    {selectedPlaylist.tracks.length === 0 ? (
                        <p className={styles.emptyState}>No tracks saved here yet.</p>
                    ) : (
                        selectedPlaylist.tracks.map((sound, index) => (
                            <SoundItem
                                key={sound.id}
                                item={sound}
                                onPlay={() => playFrom(index)}
                                showStats={false}
                            />
                        ))
                    )}
                </ul>

                <div className={styles.backupRow}>
                    <span className={styles.backupLabel}>Backup</span>
                    <button type="button" className={styles.backupBtn} onClick={exportPlaylists}>Export</button>
                    <button type="button" className={styles.backupBtn} onClick={() => importInputRef.current?.click()}>Import</button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={importPlaylists}
                    />
                    <p className={styles.backupStatus} role="status" aria-live="polite">{backupStatus}</p>
                </div>
            </div>
    )
}
export default Library
