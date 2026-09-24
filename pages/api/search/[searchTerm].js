import { searchVideos } from "../../../lib/searchVideos";


export default async function (req, res) {
  const { query } = req
  const { searchTerm } = query

  try {
    res.status(200).json(await searchVideos(searchTerm))

  } catch (error) {
    console.error(`search error for "${searchTerm}":`, error);
    res.status(500).json({ error: error.message })

  }

}
