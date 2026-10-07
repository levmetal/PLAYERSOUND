import { useEffect } from 'react'
import useOnlineStatus from '../hooks/useOnlineStatus'
import styles from '../styles/offlineNotice.module.css'

// One dim line while the browser has no connection: the pages already opened
// still work from the cache, but nothing can play.
export default function OfflineNotice() {
  const online = useOnlineStatus()

  // Lets globals.css make room for the line at the top of the page.
  useEffect(() => {
    const root = document.documentElement
    if (online) delete root.dataset.offline
    else root.dataset.offline = ''
  }, [online])

  return (
    <p className={styles.notice} role="status" hidden={online}>
      You&apos;re offline. Playing needs a connection
    </p>
  )
}
