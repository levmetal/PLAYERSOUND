const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

// What the browser may load. The only third parties are YouTube's IFrame API
// script (www.youtube.com), its player frame (youtube-nocookie.com) and video
// thumbnails (i.ytimg.com); everything else, API calls included, is this origin.
// Inline styles come from React `style` props.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => ({
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Dev needs eval and a websocket for hot reload, so the policy is production-only.
    const csp = phase === PHASE_DEVELOPMENT_SERVER ? [] : [{ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY }]
    return [{ source: '/(.*)', headers: [...SECURITY_HEADERS, ...csp] }]
  },
})
