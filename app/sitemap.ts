import type { MetadataRoute } from "next";
import { getLivePandalsForSitemap } from "@/lib/queries";
import { absoluteUrl } from "@/lib/site";

/**
 * Rendered per request, not at build: `next build` prerenders routes in
 * parallel workers, and a second DB-backed route swapping the cached pool
 * (db/index.ts) kills this one's query mid-flight. Crawlers fetch this a few
 * times a day, so a live query costs nothing worth caching.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pandals = await getLivePandalsForSitemap();
  const newest = pandals.reduce<Date | undefined>(
    (m, p) => (m && m > p.updatedAt ? m : p.updatedAt),
    undefined,
  );

  return [
    { url: absoluteUrl("/"), lastModified: newest, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/top"), lastModified: newest, changeFrequency: "hourly", priority: 0.8 },
    ...pandals.map((p) => ({
      url: absoluteUrl(`/p/${p.id}`),
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
      images: p.cover ? [p.cover] : undefined,
    })),
  ];
}
