import { youtube } from "scrape-youtube";

// Server-only: the YouTube search behind the /api/search route, kept out of
// the route handler so any server code can call it in-process instead of
// making an HTTP request back to its own server.
export async function searchVideos(term) {
  const { videos } = await youtube.search(term);
  return videos;
}
