import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org', // Replace with your exact domain
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;