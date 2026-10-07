// What the service worker does with each request. Only the shell is ever
// cached: build files, fonts, icons and the pages that read this browser's own
// data. Anything that needs YouTube, Last.fm or an API route goes to the network.
// Pure and self-contained (no imports): scripts/build-sw.mjs pastes this file
// into public/sw.js.

export const CACHE_PREFIX = 'playersound-'

// Pages that show this browser's data (playlists, history) or nothing remote.
const SHELL_PAGES = ['/', '/library', '/history', '/about', '/offline']

const STATIC_PREFIXES = ['/_next/static/', '/fonts/', '/icons/']
const STATIC_FILE = /\.(?:png|webp|jpe?g|svg|ico|woff2?|webmanifest)$/

const NETWORK_PREFIXES = ['/api/', '/_next/webpack-hmr', '/_next/data/']

/**
 * @param {{ url: string, method: string, mode: string }} request
 * @param {string} origin the worker's own origin
 * @returns {'network' | 'static' | 'page' | 'page-uncached'}
 */
export function strategyFor(request, origin) {
    if (request.method !== 'GET') return 'network'
    const url = new URL(request.url)
    if (url.origin !== origin) return 'network'
    const path = url.pathname
    if (path === '/sw.js' || NETWORK_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'network'
    if (request.mode === 'navigate') {
        const page = path.length > 1 ? path.replace(/\/+$/, '') : path
        return SHELL_PAGES.includes(page) ? 'page' : 'page-uncached'
    }
    if (STATIC_PREFIXES.some((prefix) => path.startsWith(prefix)) || STATIC_FILE.test(path)) return 'static'
    return 'network'
}

/** @param {string} version */
export function cacheNames(version) {
    return { static: `${CACHE_PREFIX}static-${version}`, pages: `${CACHE_PREFIX}pages-${version}` }
}

/**
 * Our caches from other versions, to delete; caches that aren't ours are left alone.
 * @param {string[]} names
 * @param {string} version
 */
export function staleCaches(names, version) {
    const current = Object.values(cacheNames(version))
    return names.filter((name) => name.startsWith(CACHE_PREFIX) && !current.includes(name))
}
