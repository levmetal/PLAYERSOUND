
import styles from '../styles/Home.module.css'
import { useState } from 'react'
import { useRouter } from 'next/router'
import DataPixelArc from '../components/dataPixelArc'
import Head from 'next/head'
import useLinkSubmit from '../hooks/useLinkSubmit'
import HomeBlocks from '../components/homeBlocks'

const HERO_SRCSET = '/cassetteHero-320.webp 320w, /cassetteHero-480.webp 480w, /cassetteHero-853.webp 853w'
// Its rendered width: .heroFrame in Home.module.css.
const HERO_SIZES = '(max-width: 768px) min(40vw, 10rem), 35vw'

export default function Home() {

  const router = useRouter()
  const [search, setSearch] = useState("")
  const link = useLinkSubmit()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const term = search.trim()
    if (!term || link.pending) return
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
       {/* The cassette is the largest thing on first paint: fetch it early. */}
       <link rel="preload" as="image" href="/cassetteHero-853.webp" imageSrcSet={HERO_SRCSET} imageSizes={HERO_SIZES} />
      </Head>
        <main className={styles.page}>
        <section className={styles.container}>

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
                <p className={styles.container__subtitle}>
                  Tune in to any song, podcast or live set on YouTube with no feed and
                  no account. Your playlists stay saved in this browser.
                </p>
              </div>

              {/* The message and the hint live inside the form so they can sit right
                  under the field: on phones the button wraps below them. While a
                  link loads, the field goes read-only instead of disabled, so the
                  keyboard focus stays where it was. */}
              <form className={styles.container__form} onSubmit={handleSubmit} aria-busy={link.pending}>
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
                  readOnly={link.pending}
                  aria-describedby="home-link-message home-link-hint"
                  onChange={e => { setSearch(e.target.value); link.clearError() }}
                />
                <button className={styles.form__button} type="submit" aria-disabled={link.pending}>
                  {link.pending ? 'Loading…' : 'Search'}
                </button>
                <p id="home-link-message" className={styles.linkMessage} role="status">
                  {link.pending ? 'Loading link…' : link.error}
                </p>
                {!link.pending && !link.error && (
                  <p id="home-link-hint" className={styles.linkHint}>Paste a YouTube video or playlist link to play it or save it</p>
                )}
              </form>
            </div>
            <div className={styles.heroFrame}>
              <DataPixelArc className={styles.heroArc} />
              <img
                className={styles.imghero}
                src="/cassetteHero-853.webp"
                srcSet={HERO_SRCSET}
                sizes={HERO_SIZES}
                width="853"
                height="1024"
                alt="A hand holding a PlayerSound cassette, dithered in phosphor green"
              />
            </div>

          </>
        </section>
        <HomeBlocks />
        </main>
    </>
  )
}


