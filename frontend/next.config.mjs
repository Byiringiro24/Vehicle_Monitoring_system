/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { domains: ['localhost'] },
  env: {
    NEXT_PUBLIC_APP_NAME: 'ARTIC Vehicle Monitoring System',
    NEXT_PUBLIC_APP_SHORT_NAME: 'ARTIC VMS',
  },
};
export default nextConfig;