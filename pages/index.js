
import styles from '../styles/Home.module.css'
import { useState } from 'react'
import { useRouter } from 'next/router'
import DataPixelArc from '../components/dataPixelArc'
import Head from 'next/head'

export default function Home() {

  const router = useRouter()
  const [search, setSearch] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    router.push(`/search/${search}`)
    setSearch("")
  }

  return (
    <>
    <Head>
       <meta name="description" content="Find any YouTube audio without ads using our easy-to-use search app. Enjoy your favorite songs and create custom playlists uninterrupted. Try our app today and enjoy an uninterrupted online audio experience!"/>
       <meta name="description" content="Encuentra cualquier audio de YouTube sin publicidad con nuestra aplicación de búsqueda fácil de usar. Disfruta de tus canciones favoritas y crea listas de reproducción personalizadas sin interrupciones publicitarias. ¡Prueba nuestra aplicación hoy mismo y disfruta de una experiencia de audio en línea sin interrupciones!"/>
       <meta name="google-site-verification" content="_Y-WmLWOjBhsxYjfH08TLdnHZ0-SoiKZmeJ9IelQI0g" />
      </Head>
        <main className={styles.container}>

          <>

            <div className={styles.heroAura} aria-hidden="true">
              <div className={styles.heroAura__lattice} />
              <div className={styles.heroAura__band} />
              <div className={styles.heroAura__glow} />
            </div>

            <div className={styles.infoHero}>
              <div className={styles.mainTitle}>
                <p className={styles.eyebrow}>SYSTEM_LOG // HOME</p>
                <h1 className={styles.container__title}>Music,Podcast or whatever you want</h1>
                <h2 className={styles.container__subtitle}>Search every sound from this app to
                  enjoy your favorites podcasts, web show or music whitout ads
                </h2>
              </div>

              <form className={styles.container__form} onSubmit={handleSubmit} >

                <label htmlFor="home-search" className="sr-only">Search for a sound</label>
                <input
                  id="home-search"
                  name="search"
                  autoComplete="off"
                  spellCheck="false"
                  className={styles.form__input}
                  value={search}
                  type="text"
                  placeholder='Lets Rock !'
                  onChange={e => setSearch(e.target.value)}
                />
                <button className={styles.form__button} type="submit" >Search</button>
              </form>
            </div>
            <div className={styles.heroFrame}>
              <DataPixelArc className={styles.heroArc} />
              <img className={styles.imghero} src="/cassetteHero.png" width="853" height="1024" alt="Mano sosteniendo un cassette de PlayerSound, estilo tramado verde fósforo" />
            </div>

          </>
        </main>
    </>
  )
}


