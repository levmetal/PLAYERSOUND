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
                        Search every sound from this app to
                        enjoy your favorites podcasts, web show or music whitout ads
                    </p>
                    <footer className={styles.footer}>
                        <img src='Arrow 1.svg' alt="ARROW_SVG" />

                            <Link  href='/'><a  className={styles.button}>Home</a></Link>
                        
                    </footer>
                </article>
                <img src='youngBoy.jpg' className={styles.img__about} />

            </div>
        </Layout>
    )
}
export default About