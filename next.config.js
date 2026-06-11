/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/history',
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
