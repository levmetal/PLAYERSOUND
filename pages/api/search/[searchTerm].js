import container from "../../../services/container";

export default async function searchHandler(req, res) {
  const { searchTerm } = req.query

  try {
    res.status(200).json(await container.search.search(searchTerm))
  } catch (error) {
    console.error(`search error for "${searchTerm}":`, error);
    res.status(500).json({ error: error.message })
  }
}
