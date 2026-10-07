import { useEffect } from 'react'
import { CACHE_PREFIX } from '../core/pwa/cachePolicy'

// Production builds register the worker after the page has loaded. Dev removes
// any worker and its caches instead: one left by `npm run start` on the same
// port would serve dev chunks (which have no hash in their names) from its cache.
export default function useServiceWorker() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return

        if (process.env.NODE_ENV !== 'production') {
            // The removed worker still serves this one page load and may write to
            // its cache again; it never reads it, and the next load deletes it.
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                .then(() => ('caches' in window ? caches.keys() : []))
                .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name))))
                .catch(() => {})
            return
        }

        const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {})
        if (document.readyState === 'complete') {
            register()
            return
        }
        window.addEventListener('load', register, { once: true })
        return () => window.removeEventListener('load', register)
    }, [])
}
