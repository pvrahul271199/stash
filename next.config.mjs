/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  experimental: { agentUpgrade: 'security', inlineCss: true }, // 10 KB of Tailwind CSS: inline it so it stops blocking first paint
};

export default nextConfig;
