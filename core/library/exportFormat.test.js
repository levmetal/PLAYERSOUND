import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toExport, parseImport, mergePlaylists } from './exportFormat.js'
import { FAVORITES_ID } from './libraryReducer.js'

const [A, B, C] = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const NOW = new Date('2026-09-25T18:30:00.000Z')

const favorites = (...tracks) => ({ id: FAVORITES_ID, name: 'Favorites', tracks })
const playlist = (id, name, ...tracks) => ({ id, name, tracks })
const exported = (playlists) => JSON.stringify(toExport(playlists, NOW))

// --- toExport ---

test('export wraps the playlists with app, version and timestamp', () => {
    const playlists = [favorites(A)]
    assert.deepEqual(toExport(playlists, NOW), {
        app: 'playersound', version: 1, exportedAt: '2026-09-25T18:30:00.000Z', playlists,
    })
})

// --- parseImport ---

test('a file made by export imports back unchanged', () => {
    const playlists = [favorites(A), playlist('p1', 'Night drive', B, C)]
    assert.deepEqual(parseImport(exported(playlists)), { ok: true, playlists })
})

test('text that is not JSON is rejected', () => {
    assert.deepEqual(parseImport('not json {'), { ok: false, error: 'not-json' })
})

test('JSON from something else is rejected', () => {
    assert.deepEqual(parseImport('[]'), { ok: false, error: 'not-playersound' })
    assert.deepEqual(parseImport('{"foo":1}'), { ok: false, error: 'not-playersound' })
    assert.deepEqual(parseImport('null'), { ok: false, error: 'not-playersound' })
})

test('a backup from a newer version is rejected', () => {
    const file = JSON.stringify({ ...toExport([favorites()], NOW), version: 2 })
    assert.deepEqual(parseImport(file), { ok: false, error: 'unsupported-version' })
})

test('missing or malformed playlists are rejected', () => {
    const base = toExport([], NOW)
    for (const playlists of [undefined, 'x', [{ name: 'No id', tracks: [] }], [{ id: 'p', tracks: [] }], [{ id: 'p', name: 'P', tracks: 'x' }]]) {
        const file = JSON.stringify({ ...base, playlists })
        assert.deepEqual(parseImport(file), { ok: false, error: 'invalid-playlists' }, JSON.stringify(playlists))
    }
})

test('tracks without a string id are dropped, the rest imports', () => {
    const file = JSON.stringify({ ...toExport([], NOW), playlists: [playlist('p1', 'P', A, { title: 'no id' }, { id: 7 }, B)] })
    assert.deepEqual(parseImport(file), { ok: true, playlists: [playlist('p1', 'P', A, B)] })
})

// --- mergePlaylists ---

test('Favorites gains only the tracks it did not have', () => {
    const { playlists, added } = mergePlaylists([favorites(B)], [favorites(A, B)])
    assert.deepEqual(playlists, [favorites(B, A)])
    assert.deepEqual(added, { playlists: 0, tracks: 1 })
})

test('a playlist with a known id gains its new tracks and keeps its current name', () => {
    const { playlists, added } = mergePlaylists(
        [favorites(), playlist('p1', 'Night drive', A)],
        [playlist('p1', 'Renamed elsewhere', A, B)],
    )
    assert.deepEqual(playlists, [favorites(), playlist('p1', 'Night drive', A, B)])
    assert.deepEqual(added, { playlists: 0, tracks: 1 })
})

test('a playlist with a new id is appended at the end', () => {
    const { playlists, added } = mergePlaylists([favorites(A)], [playlist('p2', 'Focus', B, C)])
    assert.deepEqual(playlists, [favorites(A), playlist('p2', 'Focus', B, C)])
    assert.deepEqual(added, { playlists: 1, tracks: 2 })
})

test('importing the same backup twice changes nothing the second time', () => {
    const backup = [favorites(A), playlist('p1', 'Night drive', B)]
    const once = mergePlaylists([favorites()], backup).playlists
    const twice = mergePlaylists(once, backup)
    assert.deepEqual(twice.playlists, once)
    assert.deepEqual(twice.added, { playlists: 0, tracks: 0 })
})
