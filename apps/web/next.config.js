/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    // Proxy /api and /health to the backend API when NEXT_PUBLIC_API_URL is
    // not set (i.e. when the web app is accessed directly on port 30000
    // instead of through the nginx proxy on port 30080).
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:3001/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://api:3001/health',
      },
    ];
  },
};

module.exports = nextConfig;
