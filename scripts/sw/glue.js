/* global self, caches, fetch, Response, VERSION, strategyFor, cacheNames, staleCaches */
// Service worker glue, pasted by scripts/build-sw.mjs after the cache policy
// (core/pwa/cachePolicy.js) and the VERSION constant. The policy decides; this
// file only talks to the Cache and Fetch APIs.

const CACHES = cacheNames(VERSION)
const OFFLINE_URL = '/offline'
const STATIC_URL = /\/_next\/static\/[^"'\s)]+/g

// Pages are saved under their path without a query or trailing slash, so
// `/library?x=1` and `/library/` find the same saved copy.
const pageKey = (url) => {
    const { origin, pathname } = new URL(url)
    return origin + (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const response = await fetch(OFFLINE_URL, { cache: 'reload' })
        if (!response.ok) throw new Error(`${OFFLINE_URL} answered ${response.status}`)
        const html = await response.clone().text()
        const pages = await caches.open(CACHES.pages)
        await pages.put(pageKey(new URL(OFFLINE_URL, self.location.origin).href), response)
        // The offline page's own code and styles, so it renders with no network.
        const assets = [...new Set(html.match(STATIC_URL) || [])]
        const statics = await caches.open(CACHES.static)
        await statics.addAll([...assets, '/manifest.webmanifest', '/icons/icon-192.png'])
    })())
    // No skipWaiting(): a new version waits until every tab of the old one is
    // closed, so an update never interrupts what's playing.
})

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const stale = staleCaches(await caches.keys(), VERSION)
        await Promise.all(stale.map((name) => caches.delete(name)))
        // Only reached once no page of an older version is open, so taking
        // control here just covers the very first visit too.
        await self.clients.claim()
    })())
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    const strategy = strategyFor(request, self.location.origin)
    if (strategy === 'static') event.respondWith(cacheFirst(request))
    else if (strategy === 'page') event.respondWith(networkFirstPage(request, true))
    else if (strategy === 'page-uncached') event.respondWith(networkFirstPage(request, false))
    // 'network': not handled, the browser fetches it as if there were no worker.
})

async function cacheFirst(request) {
    const cache = await caches.open(CACHES.static)
    const hit = await cache.match(request)
    if (hit) return hit
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
    return response
}

async function networkFirstPage(request, save) {
    const cache = await caches.open(CACHES.pages)
    try {
        const response = await fetch(request)
        if (save && response.ok && response.type === 'basic') await cache.put(pageKey(request.url), response.clone())
        return response
    } catch (error) {
        const saved = save && await cache.match(pageKey(request.url))
        const fallback = saved || await cache.match(pageKey(new URL(OFFLINE_URL, self.location.origin).href))
        return fallback || Response.error()
    }
}
