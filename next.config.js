/** @type {import('next').NextConfig} */
// basePath comes from NEXT_PUBLIC_BASEPATH (set to /history in docker/prod via
// docker-compose). Local `npm run dev` leaves it unset → no basePath, root works.
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASEPATH || undefined,
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
