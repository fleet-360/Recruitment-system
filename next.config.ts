import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // NFR-02: no framing (clickjacking), HTTPS only, no URL leaks to other sites. ponytail: no CSP yet — Next's inline scripts need nonces; add with a nonce proxy if we ever render user HTML.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // CV uploads, capped at 10MB in code
  },
};

export default nextConfig;
