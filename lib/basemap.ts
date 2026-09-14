"use client";

import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { maptilerStyle, osmRasterStyle, protomapsStyle, type TileJson } from "./mapStyle";

/**
 * Which basemap to draw, decided once per map. Order of preference:
 *
 *  1. MapTiler Cloud, while the key answers. The free quota is per request,
 *     so it's preflighted with the one TileJSON fetch the style needs anyway
 *     (inlined, not refetched) and fonts come from our bucket, not theirs.
 *  2. Our own Protomaps archive on R2 (`NEXT_PUBLIC_PMTILES_URL`) — the
 *     day the key is over quota or MapTiler is down, this takes over and
 *     nobody sees a blank map.
 *  3. OSM raster — dev-only under OSM's tile policy, but better than blank.
 *
 * Decided up front because MapLibre can't swap styles cleanly once our own
 * sources are on the map.
 */
const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL;
const ASSETS_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

let protocolRegistered = false;

export type BasemapKind = "maptiler" | "protomaps" | "osm";

export async function loadBasemap(
  maplibre: typeof import("maplibre-gl"),
): Promise<{ style: StyleSpecification; kind: BasemapKind }> {
  if (MAPTILER_KEY) {
    const tilejson = await fetchTileJson(MAPTILER_KEY);
    if (tilejson) return { style: maptilerStyle(MAPTILER_KEY, tilejson, ASSETS_BASE), kind: "maptiler" };
    console.warn("[basemap] MapTiler key not answering (quota?), falling back to pmtiles");
  }
  if (PMTILES_URL && ASSETS_BASE) {
    if (!protocolRegistered) {
      const { Protocol } = await import("pmtiles");
      maplibre.addProtocol("pmtiles", new Protocol().tile);
      protocolRegistered = true;
    }
    if (await reachable(PMTILES_URL)) {
      return { style: protomapsStyle(PMTILES_URL, ASSETS_BASE), kind: "protomaps" };
    }
    console.warn("[basemap] pmtiles archive unreachable, falling back to OSM raster");
  }
  return { style: osmRasterStyle, kind: "osm" };
}

/** One metered request. Null on any non-200 — over quota comes back as 403. */
async function fetchTileJson(key: string): Promise<TileJson | null> {
  try {
    const res = await withTimeout(`https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`, {});
    if (!res.ok) return null;
    const json = (await res.json()) as TileJson;
    return Array.isArray(json.tiles) && json.tiles.length > 0 ? json : null;
  } catch {
    return null;
  }
}

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await withTimeout(url, { Range: "bytes=0-16383" });
    return res.status === 206;
  } catch {
    return false;
  }
}

function withTimeout(url: string, headers: Record<string, string>, ms = 4000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { headers, signal: ctrl.signal }).finally(() => clearTimeout(t));
}
