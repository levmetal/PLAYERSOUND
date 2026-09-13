import styles from '../styles/about.module.css'
import Layout from '../components/layout'
import Link from 'next/link'
import { FaHome } from 'react-icons/fa'

const About = () => {
    return (
        <Layout>

            <div className={styles.container}>
                <article className={styles.info__about}>

                    <p className={styles.eyebrow}>SYSTEM_LOG // ABOUT</p>
                    <h1 className={styles.title}>PlayerSound</h1>

                    <p className={styles.content}>
                        Search any sound, stream it instantly, and save it to a playlist —
                        no ad breaks, no catalog to browse first.
                    </p>

                    <ul className={styles.specList}>
                        <li><span>SEARCH</span> — pull tracks straight from the source, ad-free.</li>
                        <li><span>PLAYLISTS</span> — save favorites and build custom playlists.</li>
                        <li><span>ANONYMOUS</span> — no login. Everything stays in this browser.</li>
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
                        className={styles.heroArt__img}
                        alt="Silhouette of a person wearing headphones crossing a rain-lit Tokyo street at night, neon signs glowing overhead"
                    />
                    <div className={styles.heroArt__fade} aria-hidden="true" />
                </div>

            </div>
        </Layout>
    )
}
export default About
