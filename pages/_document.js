import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* The body face (styles/tokens.css), fetched with the HTML instead of
            after the CSS has been parsed. */}
        <link
          rel="preload"
          href="/fonts/share-tech-mono/ShareTechMono-Regular-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
