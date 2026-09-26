import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import resolveTrack from './resolveTrack.js'

const videos = JSON.parse(readFileSync(new URL('../__fixtures__/videos.json', import.meta.url), 'utf8'))
const byId = (id) => videos.find((video) => video.id === id)
const byTitle = (prefix) => videos.find((video) => video.title.startsWith(prefix))

test('Topic upload resolves from its "Provided to YouTube by" description (R1)', () => {
    assert.deepEqual(resolveTrack(byId('5oWyMakvQew')), {
        artist: 'Fleetwood Mac', title: 'Dreams', rule: 'R1', confidence: 'high',
    })
})

test('R1 cleans the track title', () => {
    assert.deepEqual(resolveTrack(byId('MfO6EYbVBFw')), {
        artist: 'Daft Punk', title: 'Digital Love', rule: 'R1', confidence: 'high',
    })
})

test('a " - Topic" channel gives the artist without the suffix (R2)', () => {
    // Real Topic upload with the suffix restored and no description, so R1 can't fire first.
    const video = byId('5oWyMakvQew')
    const topic = { ...video, description: '', channel: { ...video.channel, name: 'Fleetwood Mac - Topic' } }
    assert.deepEqual(resolveTrack(topic), {
        artist: 'Fleetwood Mac', title: 'Dreams', rule: 'R2', confidence: 'high',
    })
})

test('"Artist - Track" title resolves by splitting on the dash (R3)', () => {
    assert.deepEqual(resolveTrack(byTitle('Daft Punk - Digital Love (Official Video)')), {
        artist: 'Daft Punk', title: 'Digital Love', rule: 'R3', confidence: 'medium',
    })
})

test('R3 splits on an en dash', () => {
    const track = resolveTrack(byTitle('Billie Eilish – BIRDS OF A FEATHER (Live Performance'))
    assert.equal(track.artist, 'Billie Eilish')
    assert.equal(track.title, 'BIRDS OF A FEATHER')
    assert.equal(track.rule, 'R3')
})

test('R3 ignores what follows " | "', () => {
    const track = resolveTrack(byTitle('Bad Bunny - Tití Me Preguntó (Official Video)'))
    assert.equal(track.artist, 'Bad Bunny')
    assert.equal(track.title, 'Tití Me Preguntó')
})

test('R3 swaps the parts when the right side is the channel', () => {
    // Real official upload, retitled "Track - Artist" as some official channels do.
    const video = byTitle('Daft Punk - Digital Love (Official Video)')
    const reversed = { ...video, title: 'Digital Love - Daft Punk' }
    assert.equal(resolveTrack(reversed).artist, 'Daft Punk')
    assert.equal(resolveTrack(reversed).title, 'Digital Love')
})

test('reversed title from a third-party channel is taken as-is (known limitation)', () => {
    assert.deepEqual(resolveTrack(byId('1ZJCDGUGc1o')), {
        artist: 'Titi Me Pregunto', title: 'Bad Bunny 2022', rule: 'R3', confidence: 'medium',
    })
})

test('verified channel with a bare track title resolves to the channel (R4)', () => {
    assert.deepEqual(resolveTrack(byId('T6eK-2OQtew')), {
        artist: 'Kendrick Lamar', title: 'Not Like Us', rule: 'R4', confidence: 'medium',
    })
})

test('R4 drops a leading "Official " from the channel name', () => {
    // Real "Official Arctic Monkeys" upload, retitled without the artist prefix.
    const video = byId('bpOSxM0rNPM')
    const track = resolveTrack({ ...video, title: 'Do I Wanna Know? (Official Video)' })
    assert.equal(track.artist, 'Arctic Monkeys')
    assert.equal(track.title, 'Do I Wanna Know?')
    assert.equal(track.rule, 'R4')
})

test('unverified channel without a usable dash is unidentified', () => {
    assert.equal(resolveTrack(byId('2KAfxFQhyCQ')), null)
})

test('anything longer than 15 minutes is unidentified', () => {
    assert.equal(resolveTrack(byTitle('Fred again.. | Boiler Room')), null)
    assert.equal(resolveTrack(byTitle('Joe Rogan Experience')), null)
})

test('a live stream (duration 0) is unidentified', () => {
    assert.equal(resolveTrack({ ...byTitle('Daft Punk - Digital Love (Official Video)'), duration: 0 }), null)
})

test('resolves at least 80% of the music-length fixtures', () => {
    const music = videos.filter((video) => video.duration > 0 && video.duration <= 900)
    const resolved = music.filter((video) => resolveTrack(video) !== null)
    assert.ok(resolved.length / music.length >= 0.8, `${resolved.length}/${music.length} resolved`)
})
