import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FaCheck } from "react-icons/fa";
import styles from "../styles/soundlist.module.css"
import SoundItem from "./soundItem";
import { useNowPlaying } from "../context/nowPlayingContext";
import { formatTrackNumber } from "../core/format/trackNumber";
import useLinkSubmit from "../hooks/useLinkSubmit";
import {
  SORT_OPTIONS,
  DURATION_FILTERS,
  DEFAULT_SORT,
  DEFAULT_DURATION,
  applySort,
  applyDurationFilter,
  groupByChannel,
} from "../utils/sortSearchResults";

// Placeholder rows shown while a search is in flight — enough to fill a
// typical viewport without the list visibly "growing" once results swap in.
const SKELETON_ROWS = 6

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// The player itself is not mounted here — SoundItem opens it through
// context/nowPlayingContext.js, and it lives in pages/_app.js so it keeps
// playing after leaving this page.
const SoundList = ({ query = '', status = 'done', results = [], error = null, onRetry }) => {
  const router = useRouter()
  const { playQueue } = useNowPlaying()
  const link = useLinkSubmit()
  const inputRef = useRef(null)
  const [draft, setDraft] = useState(query)

  const [sortKey, setSortKey] = useState(DEFAULT_SORT)
  const [durationKey, setDurationKey] = useState(DEFAULT_DURATION)
  const [groupByChannelOn, setGroupByChannelOn] = useState(false)

  // Keeps the field in sync when the query changes from outside it (back/
  // forward navigation, the router resolving the URL on first load).
  useEffect(() => setDraft(query), [query])

  const processedResults = useMemo(
    () => applySort(applyDurationFilter(results, durationKey), sortKey),
    [results, sortKey, durationKey]
  )

  const grouped = useMemo(
    () => (groupByChannelOn ? groupByChannel(processedResults) : null),
    [groupByChannelOn, processedResults]
  )

  // What ⏮/⏭ walk: the results in the order they're shown right now.
  const playOrder = useMemo(
    () => (grouped ? grouped.flatMap((group) => group.items) : processedResults),
    [grouped, processedResults]
  )

  // Each row's number is its place in that order, so it matches the player's
  // "TRK 05/20" and keeps counting across channel groups.
  const positions = useMemo(() => new Map(playOrder.map((video, index) => [video.id, index + 1])), [playOrder])

  const playFrom = (item) => {
    playQueue(playOrder, playOrder.indexOf(item), { type: 'search', label: query })
  }

  const done = status === 'done'
  const filtersActive = sortKey !== DEFAULT_SORT || durationKey !== DEFAULT_DURATION || groupByChannelOn

  const resetFilters = () => {
    setSortKey(DEFAULT_SORT)
    setDurationKey(DEFAULT_DURATION)
    setGroupByChannelOn(false)
  }

  const focusSearch = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const term = draft.trim()
    if (!term) {
      focusSearch()
      return
    }
    // A pasted YouTube video link plays; the results on screen stay as they are.
    const outcome = await link.submit(term)
    if (outcome === 'failed') return
    if (outcome === 'played' || outcome === 'opened') {
      setDraft(query)
      return
    }
    // Same term again: the URL wouldn't change, so re-run the fetch instead.
    if (term === query) {
      onRetry?.()
      return
    }
    // Encoded so "/", "?", "#" stay part of the term (see pages/index.js).
    router.push(`/search/${encodeURIComponent(term)}`)
  }

  let countText = ''
  if (!done) countText = 'Searching…'
  else if (!error) {
    countText = processedResults.length === results.length
      ? plural(results.length, 'result')
      : `${processedResults.length} of ${plural(results.length, 'result')}`
  }

  const renderRows = (items) => items.map((item) => (
    <SoundItem
      key={item.id}
      item={item}
      number={formatTrackNumber(positions.get(item.id), playOrder.length)}
      onPlay={() => playFrom(item)}
      highlightStat={sortKey}
    />
  ))

  let body
  if (!done) {
    body = (
      <div className={styles.skeletonList} aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div className={styles.skeletonRow} key={i}>
            <div className={styles.skeletonNum} />
            <div className={styles.skeletonThumb} />
            <div className={styles.skeletonLines}>
              <div className={styles.skeletonLine} />
              <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
            </div>
          </div>
        ))}
      </div>
    )
  } else if (error) {
    body = (
      <div className={styles.statusPanel} role="alert">
        <p className={styles.statusTitle}>Signal lost</p>
        <p className={styles.statusHint}>{error}</p>
        {onRetry && <button type="button" className={styles.statusBtn} onClick={onRetry}>Retry</button>}
      </div>
    )
  } else if (results.length === 0) {
    body = (
      <div className={styles.statusPanel}>
        <p className={styles.statusTitle}>No results for &ldquo;{query}&rdquo;</p>
        <p className={styles.statusHint}>Try fewer or different words</p>
        <button type="button" className={styles.statusBtn} onClick={focusSearch}>Edit search</button>
      </div>
    )
  } else if (processedResults.length === 0) {
    body = (
      <div className={styles.statusPanel}>
        <p className={styles.statusTitle}>Nothing matches &ldquo;{DURATION_FILTERS[durationKey].label}&rdquo;</p>
        <p className={styles.statusHint}>{plural(results.length, 'result')} hidden by the length filter</p>
        <button type="button" className={styles.statusBtn} onClick={resetFilters}>Clear filters</button>
      </div>
    )
  } else {
    body = (
      <>
        {grouped ? (
          grouped.map((group) => (
            <div key={group.channel} className={styles.channelGroup}>
              <h3 className={styles.channelGroup__title}>
                <span className={styles.channelGroup__name}>{group.channel}</span>
                {group.verified && <FaCheck className={styles.channelGroup__verified} role="img" aria-label="Verified channel" />}
                <span className={styles.channelGroup__count}>({group.items.length})</span>
              </h3>
              <ul className={styles.searchlist}>{renderRows(group.items)}</ul>
            </div>
          ))
        ) : (
          <ul className={styles.searchlist}>{renderRows(processedResults)}</ul>
        )}
        {/* Also the room the iframe engine's floating PiP window needs to
            clear the last rows — see .listEnd in soundlist.module.css. */}
        <p className={styles.listEnd}>
          <span>End of results // {processedResults.length}</span>
        </p>
      </>
    )
  }

  return (
    <div className={styles.soundlist__container}>

      <div className={`${styles.controls} hud-frame`}>
        <form className={styles.searchRow} role="search" onSubmit={handleSubmit}>
          <label htmlFor="results-search" className="sr-only">Search, or paste a YouTube video or playlist link</label>
          <span className={styles.prompt} aria-hidden="true">&gt;</span>
          <input
            id="results-search"
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            name="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck="false"
            placeholder="Search or paste a YouTube link"
            value={draft}
            disabled={link.pending}
            aria-describedby="results-link-message"
            onChange={(e) => { setDraft(e.target.value); link.clearError() }}
          />
          <button type="submit" className={styles.searchBtn} disabled={link.pending}>
            {link.pending ? 'Loading…' : 'Search'}
          </button>
          <p className={styles.resultCount} role="status" aria-live="polite">{countText}</p>
        </form>
        <p id="results-link-message" className={styles.linkMessage} role="alert">
          {link.pending ? 'Loading link…' : link.error}
        </p>

        <div className={styles.filterRow}>
          <div className={styles.segmentGroup} role="radiogroup" aria-labelledby="sort-label">
            <span id="sort-label" className={styles.groupLabel}>Sort</span>
            <div className={styles.segments}>
              {Object.entries(SORT_OPTIONS).map(([key, option]) => (
                <label key={key} className={styles.segment}>
                  <input
                    type="radio"
                    name="sort"
                    value={key}
                    checked={sortKey === key}
                    onChange={() => setSortKey(key)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.segmentGroup} role="radiogroup" aria-labelledby="length-label">
            <span id="length-label" className={styles.groupLabel}>Length</span>
            <div className={styles.segments}>
              {Object.entries(DURATION_FILTERS).map(([key, filter]) => (
                <label key={key} className={styles.segment}>
                  <input
                    type="radio"
                    name="length"
                    value={key}
                    checked={durationKey === key}
                    onChange={() => setDurationKey(key)}
                  />
                  <span>{filter.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={groupByChannelOn}
              onChange={(e) => setGroupByChannelOn(e.target.checked)}
            />
            <span className={styles.toggleBox} aria-hidden="true" />
            Group by channel
          </label>

          {filtersActive && (
            <button type="button" className={styles.resetBtn} onClick={resetFilters}>Reset</button>
          )}
        </div>
      </div>

      {body}
    </div>
  )
}
export default SoundList
