
import styles from '../styles/Home.module.css'
import { useState } from 'react'
import { useRouter } from 'next/router'
import DataPixelArc from '../components/dataPixelArc'
import Head from 'next/head'
import useLinkSubmit from '../hooks/useLinkSubmit'

export default function Home() {

  const router = useRouter()
  const [search, setSearch] = useState("")
  const link = useLinkSubmit()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const term = search.trim()
    if (!term) return
    // A pasted YouTube video link plays instead of being searched for.
    const outcome = await link.submit(term)
    if (outcome === 'failed') return
    if (outcome === 'played' || outcome === 'opened') {
      setSearch("")
      return
    }
    // Encoded so "/", "?", "#" etc. stay part of the term instead of
    // changing the route (e.g. "AC/DC" becoming /search/AC/DC → 404).
    router.push(`/search/${encodeURIComponent(term)}`)
    setSearch("")
  }

  return (
    <>
    <Head>
       <meta name="description" content="PlayerSound is a no-login audio deck for YouTube. Search music or podcasts, keep the signal playing while you browse, and save playlists right in your browser."/>
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
                <h1 className={styles.container__title}>Music, podcasts or whatever you want</h1>
                <h2 className={styles.container__subtitle}>
                  Tune in to any song, podcast or live set on YouTube with no feed and
                  no account. Your playlists stay saved in this browser.
                </h2>
              </div>

              <form className={styles.container__form} onSubmit={handleSubmit} >

                <label htmlFor="home-search" className="sr-only">Search for a sound, or paste a YouTube video or playlist link</label>
                <input
                  id="home-search"
                  name="search"
                  autoComplete="off"
                  spellCheck="false"
                  className={styles.form__input}
                  value={search}
                  type="text"
                  placeholder="Search or paste a YouTube link"
                  disabled={link.pending}
                  aria-describedby="home-link-message"
                  onChange={e => { setSearch(e.target.value); link.clearError() }}
                />
                <button className={styles.form__button} type="submit" disabled={link.pending}>
                  {link.pending ? 'Loading…' : 'Search'}
                </button>
              </form>
              <p id="home-link-message" className={styles.linkMessage} role="alert">
                {link.pending ? 'Loading link…' : link.error}
              </p>
              {!link.pending && !link.error && (
                <p className={styles.linkHint}>Paste a YouTube video or playlist link to play it or save it.</p>
              )}
            </div>
            <div className={styles.heroFrame}>
              <DataPixelArc className={styles.heroArc} />
              <img className={styles.imghero} src="/cassetteHero.png" width="853" height="1024" alt="A hand holding a PlayerSound cassette, dithered in phosphor green" />
            </div>

          </>
        </main>
    </>
  )
}


