import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLookupVideoService, InvalidVideoIdError } from './lookupVideo.js'

const toto = { id: 'FTQbiNvZqaY', title: 'Toto - Africa (Official HD Video)', duration: 0 }

const fakeLookup = (answer = toto) => {
    const ids = []
    return { ids, video: async (id) => { ids.push(id); return answer } }
}

test('looks the id up and returns the video unchanged', async () => {
    const videoLookup = fakeLookup()
    const service = createLookupVideoService({ videoLookup })
    assert.equal(await service.video('FTQbiNvZqaY'), toto)
    assert.deepEqual(videoLookup.ids, ['FTQbiNvZqaY'])
})

test('ids that are not 11 characters of [A-Za-z0-9_-] are rejected without asking YouTube', async () => {
    const videoLookup = fakeLookup()
    const service = createLookupVideoService({ videoLookup })
    for (const bad of ['', 'short', 'FTQbiNvZqaY1', 'FTQbiNv ZqaY', '../etc/pass', 'FTQbiNvZqa?', undefined, 42]) {
        await assert.rejects(service.video(bad), (error) => error instanceof InvalidVideoIdError && error.code === 'invalid-id')
    }
    assert.deepEqual(videoLookup.ids, [])
})

test('an adapter failure propagates with its own code', async () => {
    const failure = Object.assign(new Error('gone'), { code: 'not-found' })
    const service = createLookupVideoService({ videoLookup: { video: async () => { throw failure } } })
    await assert.rejects(service.video('FTQbiNvZqaY'), failure)
})
