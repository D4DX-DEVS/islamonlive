import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allow opening the dev server from other devices on the LAN
  allowedDevOrigins: ["192.168.1.23", "localhost"],
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
