# PLAYERSOUND — UX Flow & Information Architecture

This document fixes the navigation structure, playlist model, and search-page layout decisions
before any UI restructuring work starts. It complements `docs/design/DESIGN_SYSTEM.md` (which
covers visual style only — this file covers structure and flow). Any IA/navigation change should
be checked against this file first.

## Current state (baseline, confirmed by codebase audit)

- No login/auth exists anywhere — the app is fully anonymous. Keep it that way.
- No real category/genre/tag data exists anywhere in the pipeline (`scrape-youtube`'s result
  object only has `id, title, link, thumbnail, channel{...}, views, uploaded, duration,
  description` — nothing else). The old "Categories" section (`components/soundList.jsx`) was a
  static, non-functional placeholder (Rock/Pop/Rap/R&B, "Will be implemented soon") — it is being
  removed, not repurposed.
- The existing "library" (`pages/library.jsx` + `context/libraryContext/`) is a real, wired-up
  screen, but has no persistence: state lives only in React memory, seeded from a hardcoded JSON
  file (`objectLibrary/initialLibrary.json`), and resets on every page refresh.
- There is no playlist concept today — only one undifferentiated saved list.
- The search-results page currently mixes three concerns in one screen: search results, the saved
  library list, and the fake categories block.

## Decisions

### 1. Categories: removed
No deterministic data supports a genre/category filter. The static placeholder is deleted, not
hidden. If a "personal organization" need resurfaces later, it happens through playlists (below),
not through a fake YouTube-genre filter. A manual user-defined tag system is an explicit
non-goal for now — revisit only if playlists turn out to be insufficient in practice.

### 2. Playlists model
- A default **"Favorites"** playlist replaces today's single "library" list — this migrates the
  existing add/remove-to-library behavior 1:1, so nothing breaks.
- The user can create additional named playlists from the same flow (a lightweight "add to
  playlist" action lets them pick an existing playlist or create a new one inline).
- No login: playlists are a per-browser concept, not a per-account one.

### 3. Storage mechanism: IndexedDB (via `idb-keyval`)
`localStorage` was considered and rejected: every write re-serializes and re-writes the entire
stored blob synchronously, which can cause audible/visible jank during playback as playlists grow,
and it has no way to update a single playlist without touching the rest.

**Decision**: use IndexedDB through `idb-keyval` (~600B gzipped, promise-based, no transitive
deps) instead. It's async/non-blocking and lets a single playlist be read or written without
touching the others.

Proposed shape — one record per playlist, store name `playlists`, keyed by playlist id:
```json
{
  "id": "favorites",
  "name": "Favorites",
  "tracks": [
    { "id": "...", "title": "...", "thumbnail": "...", "channel": { "name": "...", "verified": false }, "duration": 213 }
  ]
}
```
Storing the full track object (not just an id) avoids re-hitting the search API to redisplay a
saved playlist — matches the shape already consumed by `soundItem.jsx`/`player.jsx` today, so
those components don't need to change how they read a track.

### 4. Search page vs. Library: fully separated
- `/search/[search]` becomes discovery-only: results list, sort/grouping controls (below), and a
  quick "add to playlist" action per result. The "Library sounds" section is removed from this
  page entirely.
- `/library` becomes the only place saved content lives, restructured around playlists (a
  playlist switcher/list, then the selected playlist's tracks using the existing `SoundItem`
  card).

### 5. Search results: sorting & grouping
Using only the real fields available (`views`, `uploaded`, `duration`, `channel`), search results
gain:
- **Sort**: Relevance (default, as returned), Most viewed, Most recent, Duration (shortest /
  longest first).
- **Group by channel**: useful when the same uploader has multiple similar results (common for
  sound/SFX sources).
- **Quick duration filter**: short (< 1 min) / medium (1–5 min) / long (5+ min) — relevant for a
  "sound" app that mixes short clips and full tracks.

No other grouping is introduced (no fake genre, no AI classification) — everything here is
backed by a field that actually exists in the API response today.

## Navigation (updated)

Sidebar stays 3 items, renamed/repurposed:
- Home (`/`) — unchanged, search entry point
- **Playlists** (`/library`, renamed conceptually, route can stay `/library` to avoid churn) —
  playlist switcher + selected playlist's tracks
- About (`/about`) — unchanged

## Out of scope for this pass

- Any backend/account system.
- Manual tagging system for personal categorization (may come later if needed).
- Changing the audio streaming/proxy pipeline (`pages/api/soundplayer/[...termplayer].js`) —
  untouched.
