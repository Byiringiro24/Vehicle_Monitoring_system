/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' is for Docker only — Vercel needs the default output mode.
  // Remove this line when deploying to Vercel; add it back for Docker builds.
  // output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'articvms.ddnsgeek.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'ARTIC Vehicle Monitoring System',
    NEXT_PUBLIC_APP_SHORT_NAME: 'ARTIC VMS',
  },
};
export default nextConfig;
