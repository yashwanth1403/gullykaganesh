/**
 * Copies MapLibre's worker chunks into public/maplibre/.
 *
 * MapLibre v6 is ESM-only and builds its worker as a separate module chunk
 * (`maplibre-gl-worker.mjs`, which imports `maplibre-gl-shared.mjs`). Next
 * does not emit that chunk for a dependency, so the Worker gets constructed
 * against the page URL, dies immediately, and vector tiles never parse —
 * silently, because the failure never reaches the map's error event.
 *
 * Serving the chunks statically and pointing `setWorkerUrl` at them is the
 * supported fix. Run before dev and build so it tracks the installed version.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = join(process.cwd(), "public", "maplibre");

// The worker imports the shared chunk by relative path, so they must land
// in the same directory.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(out, { recursive: true });
for (const f of FILES) {
  await copyFile(join(dist, f), join(out, f));
}
console.log(`maplibre worker → public/maplibre/ (${FILES.join(", ")})`);
