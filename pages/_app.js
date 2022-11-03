import '../styles/globals.css'
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react'
import { SoundProvider } from '../context/libraryContext/libraryContext'
import Loader from '../components/loader';
function Loading() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = (url) => (url !== router.asPath) && setLoading(true);
    const handleComplete = (url) => (url === router.asPath) && setLoading(false);

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  })

  return loading && (<Loader />)
}

function MyApp({ Component, pageProps }) {
  return (<>
    <Head>
      <title>PlayerSound</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      <meta name="keywords" content="music, streaming, without ads"></meta>
    </Head>
    <SoundProvider >
      <Loading />

      <Component {...pageProps} />


    </SoundProvider>

  </>
  )
}

export default MyApp
