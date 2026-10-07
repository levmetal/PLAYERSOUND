import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import SideBar from '../components/sideBar'
import OfflineNotice from '../components/offlineNotice'

// Page content is keyed by route, so each page change remounts this wrapper
// and replays the "tuning in" transition (.route-tune in styles/globals.css).
// Keyed by pathname, not asPath: a new search (/search/a -> /search/b) is the
// same page re-querying, not a new "station", so it doesn't flicker. The
// rail and the player live outside it and stay put as the fixed anchors.
// Not React's <ViewTransition>: that needs the App Router + React canary.
export default function Layout({ children }) {
  const router = useRouter()
  // Skip the very first page load — only navigations tune in.
  const navigatedRef = useRef(false)

  useEffect(() => {
    const markNavigated = () => { navigatedRef.current = true }
    router.events.on('routeChangeStart', markNavigated)
    return () => router.events.off('routeChangeStart', markNavigated)
  }, [router.events])

  const tune = navigatedRef.current

  return (
    <>
      <SideBar />
      <OfflineNotice />
      <div key={router.pathname} className={tune ? 'route-tune' : undefined}>
        {tune && <span className="route-tune__scan" aria-hidden="true" />}
        {children}
      </div>
    </>
  )
}
