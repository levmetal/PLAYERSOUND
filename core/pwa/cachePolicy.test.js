import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strategyFor, cacheNames, staleCaches } from './cachePolicy.js'

const ORIGIN = 'https://playersound.vercel.app'
const get = (path) => ({ url: path.startsWith('http') ? path : ORIGIN + path, method: 'GET', mode: 'no-cors' })
const navigate = (path) => ({ url: ORIGIN + path, method: 'GET', mode: 'navigate' })

test('a request that is not a GET goes to the network', () => {
    assert.equal(strategyFor({ url: ORIGIN + '/api/discover', method: 'POST', mode: 'cors' }, ORIGIN), 'network')
})

test('another origin (YouTube, Last.fm, thumbnails) goes to the network', () => {
    for (const url of [
        'https://www.youtube-nocookie.com/embed/FxzBvqY5PP0',
        'https://ws.audioscrobbler.com/2.0/?method=track.getsimilar',
        'https://i.ytimg.com/vi/FxzBvqY5PP0/hqdefault.jpg',
    ]) assert.equal(strategyFor(get(url), ORIGIN), 'network', url)
})

test('API routes are never cached', () => {
    for (const path of ['/api/search/daft%20punk', '/api/soundplayer/FxzBvqY5PP0', '/api/video/FxzBvqY5PP0']) {
        assert.equal(strategyFor(get(path), ORIGIN), 'network', path)
    }
})

test('a navigation to an API route is not treated as a page', () => {
    assert.equal(strategyFor(navigate('/api/search/daft%20punk'), ORIGIN), 'network')
})

test('dev hot reload, page data and the worker itself go to the network', () => {
    for (const path of ['/_next/webpack-hmr', '/_next/data/abc123/index.json', '/sw.js']) {
        assert.equal(strategyFor(get(path), ORIGIN), 'network', path)
    }
})

test('hashed build files and fonts are static (cache first)', () => {
    for (const path of [
        '/_next/static/chunks/pages/index-3f1a.js',
        '/_next/static/css/2b6e1c.css',
        '/fonts/dseg7-classic/DSEG7Classic-Bold.woff2',
    ]) assert.equal(strategyFor(get(path), ORIGIN), 'static', path)
})

test('icons, the manifest and public images are static', () => {
    for (const path of ['/icons/icon-192.png', '/manifest.webmanifest', '/cassetteHero-480.webp', '/favicon.ico']) {
        assert.equal(strategyFor(get(path), ORIGIN), 'static', path)
    }
})

test('the shell pages are network first and saved for offline', () => {
    for (const path of ['/', '/library', '/history', '/about', '/offline']) {
        assert.equal(strategyFor(navigate(path), ORIGIN), 'page', path)
    }
})

test('a shell page with a query or a trailing slash is still a shell page', () => {
    assert.equal(strategyFor(navigate('/library?x=1'), ORIGIN), 'page')
    assert.equal(strategyFor(navigate('/history/'), ORIGIN), 'page')
})

test('search and playlist pages need the network and are never saved', () => {
    for (const path of ['/search/daft%20punk', '/playlist/PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG']) {
        assert.equal(strategyFor(navigate(path), ORIGIN), 'page-uncached', path)
    }
})

test('an unknown page path is network only but falls back to the offline page', () => {
    assert.equal(strategyFor(navigate('/whatever'), ORIGIN), 'page-uncached')
})

test('cache names carry the version', () => {
    assert.deepEqual(cacheNames('b2'), { static: 'playersound-static-b2', pages: 'playersound-pages-b2' })
})

test('stale caches are ours from other versions, never someone else\'s', () => {
    assert.deepEqual(
        staleCaches(['playersound-static-a1', 'playersound-pages-a1', 'playersound-static-b2', 'playersound-pages-b2', 'other-cache'], 'b2'),
        ['playersound-static-a1', 'playersound-pages-a1'],
    )
})
