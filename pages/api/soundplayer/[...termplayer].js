
import { useRouter } from 'next/router'
const stream = require('youtube-audio-stream')

export default async function (req, res) {
    const { query } = req
    const {termplayer}=query
    const url = `https://www.youtube.com/watch?v=${termplayer}`
  



    try {

        console.log("backend: ", termplayer);
         stream(url).pipe(res)
           
            res.status(200)
   

       


    } catch (err) {
        console.error("back",err)
    }
}


export const config = {
    api: {
        responseLimit: false,
    },
}