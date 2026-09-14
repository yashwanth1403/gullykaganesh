import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  // TS keys are camelCase (matching the frontend `Pandal` type); columns are
  // snake_case. The runtime client in db/index.ts must use the same setting.
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Supabase: only manage the public schema, and don't treat PostGIS's own
  // tables (spatial_ref_sys) as drift to be dropped.
  schemaFilter: ["public"],
  extensionsFilters: ["postgis"],
});
