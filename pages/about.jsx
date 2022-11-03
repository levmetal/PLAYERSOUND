import styles from '../styles/about.module.css'
import Layout from '../components/layout'
import Link from 'next/link'
const About = () => {
    return (
        <Layout>

            <div className={styles.container}>
                <article className={styles.info__about}>

                    <h2 className={styles.title}>About</h2>
                    <p className={styles.content}> Search every sound from this app to
                        enjoy your favorites podcasts, web show or music whitout ads

                        If you are looking for a way to enjoy your favorite podcasts, web shows or music without ads, then look no further than the Search every sound app. This great little app allows you to search for any sound you want, and then play it back without any annoying commercials.

                        What is even better is that the app is totally free to use. So if you are tired of dealing with ad-filled streaming services, give Search every sound a try today  you wont be disappointed!
                    </p>
                    <footer className={styles.footer}>
                        <img src='Arrow 1.svg' alt="ARROW_SVG" />

                        <Link href='/'><a className={styles.button}>Home</a></Link>

                    </footer>
                </article>
                <img src='youngBoy.jpg' className={styles.img__about} />

            </div>
        </Layout>
    )
}
export default About