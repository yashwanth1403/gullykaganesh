import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawl the map, the pandal pages and the leaderboard; skip everything that
 * needs a signed-in user or is a form. Admin is a 404 to crawlers anyway,
 * but there's no reason to let them find out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth/", "/api/", "/p/*/manage", "/add"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
