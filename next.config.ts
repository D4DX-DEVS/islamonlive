import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a prod build/start run beside the dev server (unset = normal .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // allow opening the dev server from other devices on the LAN
  allowedDevOrigins: ["192.168.1.23", "localhost"],
  // client router cache: `dynamic` defaults to 0s since Next 15, so navigating back
  // re-rendered the page from scratch. 5 min matches the WP fetch revalidate.
  experimental: { staleTimes: { dynamic: 300, static: 300 } },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "islamonlive.in" },
      { protocol: "https", hostname: "*.islamonlive.in" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
