import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import libraryReducer, { defaultPlaylists, FAVORITES_ID } from './libraryReducer.js'

const [A, B] = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const P = 'playlist-p'

const favorites = (state) => state.find((playlist) => playlist.id === FAVORITES_ID).tracks
const tracksOf = (state, id) => state.find((playlist) => playlist.id === id).tracks
const reduce = (state, ...actions) => actions.reduce(libraryReducer, state)
const withP = reduce(defaultPlaylists, { type: 'CREATE_PLAYLIST', payload: { id: P, name: 'Night drive' } })

test('starts with an empty Favorites playlist only', () => {
    assert.deepEqual(defaultPlaylists, [{ id: 'favorites', name: 'Favorites', tracks: [] }])
})

test('adding the same track to Favorites twice keeps one copy', () => {
    const state = reduce(defaultPlaylists, { type: 'ADD_TO_FAVORITES', payload: A }, { type: 'ADD_TO_FAVORITES', payload: A })
    assert.deepEqual(favorites(state), [A])
})

test('removes a track from Favorites by id', () => {
    const state = reduce(defaultPlaylists,
        { type: 'ADD_TO_FAVORITES', payload: A },
        { type: 'ADD_TO_FAVORITES', payload: B },
        { type: 'REMOVE_FROM_FAVORITES', payload: A.id })
    assert.deepEqual(favorites(state), [B])
})

test('adding to a playlist leaves the others untouched', () => {
    const state = reduce(withP, { type: 'ADD_TO_PLAYLIST', payload: { playlistId: P, track: A } })
    assert.deepEqual(tracksOf(state, P), [A])
    assert.deepEqual(favorites(state), [])
})

test('removing from a playlist leaves the others untouched', () => {
    const state = reduce(withP,
        { type: 'ADD_TO_PLAYLIST', payload: { playlistId: P, track: A } },
        { type: 'ADD_TO_FAVORITES', payload: A },
        { type: 'REMOVE_FROM_PLAYLIST', payload: { playlistId: P, trackId: A.id } })
    assert.deepEqual(tracksOf(state, P), [])
    assert.deepEqual(favorites(state), [A])
})

test('creates an empty playlist with the given id', () => {
    assert.deepEqual(withP.at(-1), { id: P, name: 'Night drive', tracks: [] })
})

test('creates a playlist seeded with a track', () => {
    const state = reduce(defaultPlaylists, { type: 'CREATE_PLAYLIST', payload: { id: P, name: 'Night drive', track: A } })
    assert.deepEqual(tracksOf(state, P), [A])
})

test('deletes a playlist', () => {
    const state = reduce(withP, { type: 'DELETE_PLAYLIST', payload: P })
    assert.deepEqual(state.map((playlist) => playlist.id), [FAVORITES_ID])
})

test('Favorites can never be deleted', () => {
    assert.equal(libraryReducer(withP, { type: 'DELETE_PLAYLIST', payload: FAVORITES_ID }), withP)
})

test('HYDRATE replaces the state with the stored playlists', () => {
    const stored = [{ id: FAVORITES_ID, name: 'Favorites', tracks: [A] }]
    assert.equal(libraryReducer(defaultPlaylists, { type: 'HYDRATE', payload: stored }), stored)
})

test('an unknown action returns the same state object', () => {
    assert.equal(libraryReducer(withP, { type: 'NOPE' }), withP)
})

test('IMPORT merges a backup into the current playlists', () => {
    const state = reduce(withP,
        { type: 'ADD_TO_FAVORITES', payload: A },
        { type: 'IMPORT', payload: { playlists: [{ id: FAVORITES_ID, name: 'Favorites', tracks: [A, B] }] } })
    assert.deepEqual(favorites(state), [A, B])
    assert.deepEqual(tracksOf(state, P), [])
})

test('creates a playlist seeded with several tracks at once, in order', () => {
    const B = { id: 'b', title: 'B' }
    const state = reduce(defaultPlaylists, { type: 'CREATE_PLAYLIST', payload: { id: P, name: 'Imported', tracks: [A, B] } })
    assert.deepEqual(tracksOf(state, P), [A, B])
})
