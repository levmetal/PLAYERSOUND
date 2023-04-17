
import styles from '../styles/Home.module.css'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/layout'
import Head from 'next/head'

export default function Home() {

  const router = useRouter()
  const [search, setSearch] = useState("")
  const [submiting, setSubmit] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmit(!submiting)
    router.push(`/search/${search}`)
    setSearch("")
    setSubmit(!submiting)
  }

  return (
    <>
      <Layout>
    <Head>
       <meta name="google-site-verification" content="_Y-WmLWOjBhsxYjfH08TLdnHZ0-SoiKZmeJ9IelQI0g" />
      </Head>
        <main className={styles.container}>

          <>

            <div className={styles.infoHero}>
              <div className={styles.mainTitle}>
                <h1 className={styles.container__title}>Music,Podcast or whatever you want</h1>
                <h3 className={styles.container__subtitle}>Search every sound from this app to
                  enjoy your favorites podcasts, web show or music whitout ads
                </h3>
              </div>

              <form className={styles.container__form} onSubmit={handleSubmit} >

                <input spellCheck="false" className={styles.form__input} value={search} type="text" placeholder='Lets Rock !' onChange={e => setSearch(e.target.value)} />
                <button className={styles.form__button} type="submit" >Search</button>
              </form>
            </div>
            <img className={styles.imghero} src='discHero.png' />

          </>
        </main>
      </Layout>
    </>
  )
}


