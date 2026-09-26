import { memo, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from '../../styles/search.module.css'
import SoundList from '../../components/soundList'

const Search = memo(function Search() {
  const router = useRouter()
  const search = typeof router.query.search === 'string' ? router.query.search.trim() : ''

  // 'idle' (query not readable yet) and 'loading' both render SoundList's
  // skeleton — only 'done' swaps in the real results/error.
  const [state, setState] = useState({ status: 'idle', data: [], error: null })
  // Bumped by "Retry" (or re-submitting the same term) to re-run the fetch.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // router.query is empty until Next finishes resolving this dynamic
    // route's params client-side (this page has no getServerSideProps, so
    // it's automatically statically optimized — see the note below on why).
    if (!router.isReady) return

    // Nothing to search for (e.g. a hand-typed /search/%20) — send the user
    // back to the home search box instead of hitting the API with an empty term.
    if (!search) {
      router.replace('/')
      return
    }

    let cancelled = false
    setState({ status: 'loading', data: [], error: null })

    const apiBase = process.env.NEXT_PUBLIC_SEARCH_API_BASE || ''
    // This fetch runs in the browser, so a relative path already resolves
    // against this app's own origin.
    fetch(`${apiBase}/api/search/${encodeURIComponent(search)}`)
      .then(async (response) => {
        if (response.status === 503) {
          // YouTube is rate-limiting searches: show the server's explanation.
          const body = await response.json().catch(() => ({}))
          throw Object.assign(new Error('rate limited'), { userMessage: body.error })
        }
        if (!response.ok) throw new Error(`search API responded ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        setState({ status: 'done', data: Array.isArray(data) ? data : [], error: null })
      })
      .catch((error) => {
        if (cancelled) return
        console.error(`search page error for "${search}":`, error)
        setState({ status: 'done', data: [], error: error.userMessage || 'Search failed. Try again in a moment.' })
      })

    return () => {
      cancelled = true
    }
  }, [router, router.isReady, search, attempt])

  // SoundList stays mounted across searches (its sticky search/filter bar
  // included); it renders its own skeleton while a search is in flight
  // instead of the full-screen Loader, which stays reserved for actual
  // page-to-page navigation.
  return (
    <div className={styles.container}>
      <SoundList
        query={search}
        status={state.status}
        results={state.data}
        error={state.error}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    </div>
  )
})

export default Search

// No getServerSideProps here on purpose: it used to fetch the search results
// server-side and block the whole route transition (behind the full-screen
// Loader in pages/_app.js) until YouTube responded. Fetching client-side
// instead means navigating to this page is instant, and the wait for
// results is scoped to the skeleton instead of the whole app.
// Without a data-fetching export, Next statically optimizes this page and
// resolves `[search]` from the URL client-side (see router.isReady above) —
// see https://nextjs.org/docs/pages/building-your-application/rendering/automatic-static-optimization.
