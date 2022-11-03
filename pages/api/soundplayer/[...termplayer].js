
import stream from 'youtube-audio-stream'


export const config = {
    api: {
        externalResolver: true,
        bodyParser: false,
        responseLimit: false,
    },
}

// React will only re-render once at the end (that's batching!)


export default async function (req, res) {
  
  const { query } = req
  const { termplayer } = query
  const url = `https://www.youtube.com/watch?v=${termplayer}`
    
    
  try {   
    console.log(req.headers);
    console.log("TEST");
    for await (const chunk of stream(url)) {
      res.write(chunk)
    }
    res.end()
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end('internal system error')
    }
  }
}

