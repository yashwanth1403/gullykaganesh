import { NextResponse, type NextRequest } from "next/server";
import { parseGoogle, type GoogleResult } from "@/lib/geocode-google";
import { HYDERABAD_BOUNDS } from "@/lib/validation";

/**
 * Reverse geocode for the add form: Google when `GOOGLE_MAPS_API_KEY` is
 * set, OSM Nominatim otherwise.
 *
 * Server-side either way. The Google key must not ship to the browser, and
 * Nominatim's usage policy needs an identifying User-Agent and at most one
 * request a second — neither is enforceable from a browser. Volume is tiny
 * (one call per settled pin on the submit form), but it is cached anyway so
 * a burst of submissions on Chaturthi evening cannot get the app blocked.
 *
 * Google knows Hyderabad's lanes ("Road No. 12", "Street No. 3") where OSM
 * mostly has unnamed ways, which is the whole reason to pay for it: `gully`
 * is the field people otherwise leave blank. Its `sublocality_level_1` is
 * the locality people say (Banjara Hills, KPHB Colony); `locality` is just
 * "Hyderabad" and is never used as an area.
 *
 * Nominatim, probed against real points: `suburb` is the locality; roads
 * are mostly unnamed, so `gully` is best-effort and often null.
 */

type Place = { gully: string | null; area: string | null };

const cache = new Map<string, Place>();
const CACHE_MAX = 1000;

// Serialise upstream calls with a 1s floor between them.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + 1000 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

const WARD = /^ward\s+\d+\s+/i;
/** OSM names here are occasionally all-lowercase ("rci road"). */
const titleCase = (s: string) =>
  s.replace(/\b[a-z]+\b/g, (w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));

async function lookupGoogle(lat: number, lng: number, key: string): Promise<Place> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.search = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key,
    language: "en",
    region: "in",
    result_type: "street_address|route|sublocality|neighborhood",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`google http ${res.status}`);
  const body = (await res.json()) as { status: string; results?: GoogleResult[]; error_message?: string };
  // ZERO_RESULTS is a real answer and gets cached; anything else is a key,
  // billing or quota problem — thrown so it is neither cached nor silent.
  if (body.status === "ZERO_RESULTS") return { gully: null, area: null };
  if (body.status !== "OK") throw new Error(`google ${body.status}: ${body.error_message ?? ""}`);
  return parseGoogle(body.results ?? []);
}

async function lookupNominatim(lat: number, lng: number): Promise<Place> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "17",
    addressdetails: "1",
    "accept-language": "en",
  }).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "GullyKaGanesh/1.0 (https://gullykaganesh.in)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`nominatim http ${res.status}`);
  const { address: a = {} } = (await res.json()) as { address?: Record<string, string> };
  const area = (a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? "").replace(WARD, "").trim();
  const road = a.road?.trim();
  return { gully: road ? titleCase(road) : null, area: area ? titleCase(area) : null };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const { west, south, east, north } = HYDERABAD_BOUNDS;
  if (!(lat >= south && lat <= north && lng >= west && lng <= east)) {
    return NextResponse.json({ gully: null, area: null }, { status: 400 });
  }

  // ~11 m grid: neighbouring nudges of the pin share one lookup.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  let place = cache.get(key);
  if (!place) {
    const google = process.env.GOOGLE_MAPS_API_KEY;
    try {
      // Only Nominatim needs the 1 req/s throttle; Google is rate-limited by quota.
      place = google ? await lookupGoogle(lat, lng, google) : await throttled(() => lookupNominatim(lat, lng));
    } catch (err) {
      // An upstream failure is not an answer: don't cache it anywhere, so the
      // same pin works the moment the key, billing or network is fixed.
      console.error("[geocode]", err instanceof Error ? err.message : err);
      return NextResponse.json({ gully: null, area: null }, { headers: { "Cache-Control": "no-store" } });
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, place);
  }
  return NextResponse.json(place, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
