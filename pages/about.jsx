import styles from '../styles/about.module.css'
import Link from 'next/link'
import { FaHome } from 'react-icons/fa'

const About = () => {
    return (
            <div className={styles.container}>
                <article className={styles.info__about}>

                    <p className={styles.eyebrow}>SYSTEM_LOG // ABOUT</p>
                    <h1 className={styles.title}>PlayerSound</h1>

                    <p className={styles.content}>
                        PlayerSound strips YouTube down to the one channel you came for: the
                        audio. Search any sound, start playing and keep browsing while it runs.
                    </p>

                    <ul className={styles.specList}>
                        <li><span>SEARCH</span>Find music, podcasts and live sets, sorted by length, with verified channels marked.</li>
                        <li><span>NON-STOP</span>Playback follows you across pages in a docked mini-player.</li>
                        <li><span>PLAYLISTS</span>Favorites and custom playlists are stored locally in this browser.</li>
                        <li><span>ANONYMOUS</span>No login, no feed and no recommendations pulling you off-frequency.</li>
                        <li><span>LOCAL MODE</span>Run the repo on your own machine for a direct audio stream with no ads and lock-screen controls.</li>
                    </ul>

                    <footer className={styles.footer}>
                        <Link href='/'>
                            <a className={styles.button}>
                                Home
                                <FaHome className={styles.buttonIcon} aria-hidden="true" />
                            </a>
                        </Link>
                    </footer>
                </article>

                <div className={styles.heroArt}>
                    <img
                        src='/tokyo.png'
                        width="1541"
                        height="1021"
                        className={styles.heroArt__img}
                        alt="Silhouette of a person wearing headphones crossing a rain-lit Tokyo street at night, neon signs glowing overhead"
                    />
                    <div className={styles.heroArt__fade} aria-hidden="true" />
                </div>

            </div>
    )
}
export default About
