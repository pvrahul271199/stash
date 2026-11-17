/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  experimental: { agentUpgrade: 'security' },
};

export default nextConfig;
