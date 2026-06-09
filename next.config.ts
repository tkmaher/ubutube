import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [new URL('https://upload.wikimedia.org/**')],
  },
};

export default nextConfig;