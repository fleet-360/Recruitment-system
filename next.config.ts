import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // CV uploads, capped at 10MB in code
  },
};

export default nextConfig;
