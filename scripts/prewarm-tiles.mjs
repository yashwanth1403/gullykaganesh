/**
 * Warm Cloudflare's edge cache for the Protomaps archive by fetching every
 * tile's byte range over the city at the zooms people actually use.
 *
 *   node scripts/prewarm-tiles.mjs https://tiles.gullykaganesh.in/tiles/hyderabad-20260913.pmtiles
 *
 * Talks to the archive directly (no browser): reads the header and
 * directories, then issues one ranged GET per tile through the public URL so
 * the PoP nearest this machine holds a copy. Run it from Hyderabad, or from
 * a phone hotspot on each carrier, for the PoPs that matter. Pointless on an
 * r2.dev URL — there is no edge cache in front of those.
 */
import { PMTiles, FetchSource } from "pmtiles";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/prewarm-tiles.mjs <pmtiles url>");
  process.exit(1);
}
const MIN_Z = 9;
const MAX_Z = Number(process.argv[3] ?? 14);
// HYDERABAD_BOUNDS from lib/validation.ts, plus margin — same as the extract.
const [W, S, E, N] = [78.0, 17.0, 78.9, 17.8];

const tile = (lng, lat, z) => {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return [x, y];
};

const archive = new PMTiles(new FetchSource(url));
let fetched = 0, empty = 0;
for (let z = MIN_Z; z <= MAX_Z; z++) {
  const [x0, y0] = tile(W, N, z);
  const [x1, y1] = tile(E, S, z);
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  for (let i = 0; i < jobs.length; i += 24) {
    await Promise.all(
      jobs.slice(i, i + 24).map(async ([x, y]) => {
        const t = await archive.getZxy(z, x, y);
        if (t) fetched++;
        else empty++;
      }),
    );
  }
  console.log(`z${z}: ${jobs.length} tiles`);
}
console.log({ fetched, empty });
