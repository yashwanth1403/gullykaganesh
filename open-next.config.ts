import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

/**
 * Cloudflare Workers deployment via OpenNext. Bindings are declared in
 * wrangler.jsonc.
 *
 * `/` and `/top` are ISR pages (revalidate: 60): the R2 cache holds the
 * rendered HTML, the Durable Object queue re-renders them when stale, and the
 * sharded tag cache is what lets createPandal's revalidatePath("/") drop the
 * cached map page so a new mandapam shows up without waiting a minute.
 * The regional cache layer keeps hot pages in the edge cache near the
 * visitor so a burst of festival traffic doesn't hit R2 for every request.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
    bypassTagCacheOnCacheHit: true,
  }),
  queue: doQueue,
  tagCache: doShardedTagCache({ baseShardSize: 12 }),
  enableCacheInterception: true,
});
