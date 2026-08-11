import type { MetadataRoute } from "next";
import { getPosts, getCategories, postPath } from "@/lib/wordpress";

const BASE = "https://islamonlive.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, cats] = await Promise.all([
    getPosts({ perPage: 100 }).catch(() => []),
    getCategories(81).catch(() => []),
  ]);
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/watch-videos`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/listen`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((p) => ({ url: `${BASE}${postPath(p)}`, lastModified: new Date(p.date), priority: 0.7 })),
    ...cats.map((c) => ({ url: `${BASE}/category/${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
