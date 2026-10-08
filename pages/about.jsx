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
                        PlayerSound is a no-login audio deck for YouTube. Search any sound,
                        start playing and keep browsing while it runs.
                    </p>

                    <ul className={styles.specList}>
                        <li><span>SEARCH</span>Find music, podcasts and live sets, sorted by length, with verified channels marked</li>
                        <li><span>NON-STOP</span>Playback follows you across pages in a docked mini-player</li>
                        <li><span>PLAYLISTS</span>Favorites and custom playlists are stored locally in this browser</li>
                        <li><span>SIMILAR VIBE</span>Every track comes with a list of similar ones, picked from Last.fm listener data. Autoplay continues with them when your queue ends, and you can switch it off.</li>
                        <li><span>ANONYMOUS</span>No login, no account and no feed. Playlists and listening signals stay in this browser.</li>
                        <li><span>INSTALL</span>Add PlayerSound to your home screen. In Safari, tap Share, then Add to Home Screen. In Chrome or Edge, choose Install app in the menu</li>
                        <li><span>LOCAL MODE</span>Run the repo on your own machine for a direct audio stream with no ads and lock-screen controls</li>
                    </ul>

                    <footer className={styles.footer}>
                        <Link href='/' className={styles.button}>
                            Home
                            <FaHome className={styles.buttonIcon} aria-hidden="true" />
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
