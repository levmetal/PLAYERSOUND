import '../styles/globals.css'
import Head from 'next/head';
import Router, { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic';
import { SoundProvider } from '../context/libraryContext/libraryContext'
import { NowPlayingProvider, useNowPlaying } from '../context/nowPlayingContext'
import Loader from '../components/loader';
import Layout from '../components/layout';

// Code-split: the player (and its globe/marquee/engine code) only downloads
// once something is actually played.
const Modal = dynamic(() => import('../components/modal'))
// Delay before showing the loader at all: most route changes here resolve in
// well under this, so without the delay every navigation flashes a full-screen
// overlay for a single frame. Once shown, closing plays its own ease-in fade
// (Loader's overlayClosing) instead of popping off — see styles/loader.module.css.
const SHOW_DELAY_MS = 200
const CLOSE_ANIMATION_MS = 150

function Loading() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const loadingRef = useRef(false);
  // Refs, not local `let`s inside the effect: this effect has no dependency
  // array (resubscribes on every render, same as before this file added any
  // timers), and setClosing/setLoading each trigger exactly that kind of
  // re-render. With the timer ids living in the effect's own closure, the
  // re-render's cleanup ran `clearTimeout` on the timer the handler had JUST
  // scheduled a moment earlier — cancelling its own close/show timeout before
  // it could fire. setLoading(false) then never ran, leaving the full-screen
  // Loader mounted forever (invisible once its exit animation finished, but
  // still `position: fixed` over the whole viewport, eating every click).
  // Refs aren't reset by the effect re-running, so this can't happen.
  const showTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    // Compared against the live Router singleton, not `router` from
    // useRouter(): that one is a snapshot from Loading's last render, and
    // after a back/forward between two /search URLs it was still stale when
    // routeChangeComplete fired — so the show timer was never cleared and
    // the Loader appeared after the navigation had finished, stuck for good.
    const handleStart = (url) => {
      if (url === Router.asPath) return
      clearTimeout(showTimerRef.current)
      clearTimeout(closeTimerRef.current)
      setClosing(false)
      showTimerRef.current = setTimeout(() => {
        loadingRef.current = true
        setLoading(true)
      }, SHOW_DELAY_MS)
    };
    const handleComplete = (url) => {
      if (url !== Router.asPath) return
      clearTimeout(showTimerRef.current)
      if (!loadingRef.current) return
      setClosing(true)
      closeTimerRef.current = setTimeout(() => {
        loadingRef.current = false
        setLoading(false)
        setClosing(false)
      }, CLOSE_ANIMATION_MS)
    };

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  })

  // True-unmount safety net only (empty deps) — Loading itself never actually
  // unmounts in practice, but this avoids leaking a timer if that changes.
  useEffect(() => () => {
    clearTimeout(showTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  return loading && (<Loader closing={closing} />)
}

// Lives here, outside <Layout>'s page content, so the player isn't unmounted
// by route changes. Not keyed by track: moving through the queue only hands
// the Player inside it a new item (see components/modal.jsx), so the console
// itself — expanded/mini state, focus, entrance animation — stays put.
function NowPlayingHost() {
  const { item, expanded, minimize, expand, stop } = useNowPlaying()
  if (!item) return null
  return (
    <Modal
      item={item}
      expanded={expanded}
      onMinimize={minimize}
      onExpand={expand}
      onStop={stop}
    />
  )
}

function MyApp({ Component, pageProps }) {
  return (<>
    <Head>
      <title>PlayerSound</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      <meta name="keywords" content="music, podcasts, youtube audio, playlists, no login"></meta>
      <meta name="theme-color" content="#050B05" />
    </Head>
    <SoundProvider >
      <NowPlayingProvider>
        <Loading />

        <Layout>
          <Component {...pageProps} />
        </Layout>

        <NowPlayingHost />

        <div className="crt-scanlines" aria-hidden="true" />
        <div className="crt-vignette" aria-hidden="true" />
      </NowPlayingProvider>
    </SoundProvider>

  </>
  )
}

export default MyApp
