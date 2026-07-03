/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shina/marketing-ai"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
