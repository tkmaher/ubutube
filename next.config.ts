import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    cpus: 1,
    isrFlushToDisk: false,
  },
  output: "standalone",
};

export default nextConfig;
