import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Islamonlive.in",
    short_name: "Islamonlive",
    description: "Comprehensive Islamic portal in Malayalam",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3b0764",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // installed-app deep links: long-press the icon jumps straight into a section
    shortcuts: [
      { name: "Read", url: "/category/opinion", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Watch", url: "/watch-videos", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Listen", url: "/listen", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Saved", url: "/saved", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
