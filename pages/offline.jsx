import Head from 'next/head'
import Link from 'next/link'
import { FaBook, FaRedo } from 'react-icons/fa'
import styles from '../styles/about.module.css'

// What the service worker shows for a page that was never opened on this
// device while there's no connection. Static, so it renders from the cache.
const Offline = () => (
    <>
        <Head>
            <title>Offline · PlayerSound</title>
        </Head>
        <div className={styles.container}>
            <article className={styles.info__about}>
                <p className={styles.eyebrow}>SYSTEM_LOG // NO SIGNAL</p>
                <h1 className={styles.title}>You&apos;re offline</h1>

                <p className={styles.content}>
                    This page hasn&apos;t been opened on this device yet, so it needs a connection.
                    Your playlists and history are still here
                </p>

                <footer className={styles.footer}>
                    <button type="button" className={styles.button} onClick={() => window.location.reload()}>
                        Try again
                        <FaRedo className={styles.buttonIcon} aria-hidden="true" />
                    </button>
                    <Link href="/library">
                        <a className={styles.button}>
                            Playlists
                            <FaBook className={styles.buttonIcon} aria-hidden="true" />
                        </a>
                    </Link>
                </footer>
            </article>
        </div>
    </>
)

export default Offline
