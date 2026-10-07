import { useSyncExternalStore } from 'react'

const subscribe = (onChange) => {
    window.addEventListener('online', onChange)
    window.addEventListener('offline', onChange)
    return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
    }
}

// The server render and the first client render assume online, so hydration
// never mismatches; an offline browser switches right after.
export default function useOnlineStatus() {
    return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
