import { youtube } from "scrape-youtube";


export default async function (req, res) {
  const { query } = req
  const { searchTerm } = query
  
  try {
    console.log(searchTerm);


    await youtube.search(searchTerm).then(value => {

      res.status(200).json(value.videos)
    })

  } catch (error) {
    console.error(error);
    res.status(500).json(error)

  }




}   