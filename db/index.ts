import { cache } from "react";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Server-only database client. Never import from a client component — the
 * connection string carries the database password.
 *
 * `prepare: false` is required by Supabase's transaction-mode pooler
 * (Supavisor, port 6543), which is what serverless functions should connect
 * through.
 *
 * The pool is cached on globalThis so dev HMR does not open a new one per
 * module reload — keyed on the URL and the schema module, so editing
 * DATABASE_URL in .env.local (which Next hot-reloads) or db/schema.ts swaps
 * the pool instead of silently keeping a stale one. The Proxy defers the lookup to first use so the
 * env is read at request time, not at import time.
 */

type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  // prepare: false for Supabase's transaction-mode pooler in dev; Hyperdrive
  // is fine either way. fetch_types is an extra round-trip on connect that
  // only matters for array columns, which the schema has none of.
  const client = postgres(url, { prepare: false, fetch_types: false });
  return drizzle(client, { schema, casing: "snake_case" });
}

const onWorkers = globalThis.navigator?.userAgent === "Cloudflare-Workers";

const globalForDb = globalThis as unknown as { __gkDb?: { url: string; schema: typeof schema; db: Db } };

/** One client per request on Workers; cache() scopes it to the render or action. */
const getRequestDb = cache((): Db => {
  const { env } = getCloudflareContext() as { env: { HYPERDRIVE?: { connectionString: string } } };
  const url = env.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Neither the HYPERDRIVE binding nor DATABASE_URL is set");
  return createDb(url);
});

function getDb(): Db {
  if (onWorkers) return getRequestDb();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Also keyed on the schema module: Drizzle's casing cache memoises each
  // table's columns on first use and never re-scans it, so a client that
  // outlives an HMR reload of db/schema.ts renders any newly added column
  // as `undefined` ("Cannot read properties of undefined (reading 'replace')").
  const cached = globalForDb.__gkDb;
  if (cached?.url === url && cached.schema === schema) return cached.db;
  void cached?.db.$client.end({ timeout: 1 });
  const fresh = { url, schema, db: createDb(url) };
  globalForDb.__gkDb = fresh;
  return fresh.db;
}

export const db = new Proxy({} as Db, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
