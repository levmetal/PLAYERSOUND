/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
    // `next lint` only covers pages/components/lib by default.
    dirs: ['pages', 'components', 'lib', 'context', 'hooks', 'utils', 'core', 'scripts'],
  },
}

module.exports = nextConfig
