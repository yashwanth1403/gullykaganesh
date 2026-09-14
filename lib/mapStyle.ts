import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { layers as protomapsLayers, namedFlavor, type Flavor } from "@protomaps/basemaps";

/**
 * A hand-written MapLibre style over MapTiler's OpenMapTiles vector source.
 *
 * Written rather than borrowed on purpose: an off-the-shelf light style would
 * put a generic grey-blue map under a festival palette. Here every surface is
 * painted from the Haldi & Kumkum tokens, so the basemap belongs to the page
 * instead of being tinted into submission with a CSS filter.
 *
 * Vector also fixes what raster could not: labels render at device resolution,
 * so the map stays crisp on a 2x/3x phone screen and at fractional zoom.
 */

const PAPER = "#FAF9F6";
const PAPER_WARM = "#F3EFE6";
const INK = "#241208";
const INK_DIM = "#6B5B4A";
const TURMERIC = "#F2A93C";
const KUMKUM = "#D6402C";
const LEAF = "#2F6E4F";

function withAlpha(hex: string, alpha: number) {
  const clean = hex.slice(1);
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Even the basemap stays inside the festival palette: we only vary opacity
// and emphasis instead of introducing unrelated stock-cartography hues.
const WATER = withAlpha(LEAF, 0.18);
const GREEN = withAlpha(LEAF, 0.12);
const BUILDING = PAPER_WARM;
const ROAD_FILL = PAPER;
// Highways get a turmeric cast so the ORR and NH44 read as structure at a
// glance; everything below them stays a quiet warm ink wash.
const ROAD_MAJOR_CASING = withAlpha(TURMERIC, 0.4);
const ROAD_CASING = withAlpha(INK, 0.16);
const ROAD_MINOR_CASING = withAlpha(INK, 0.1);
const BOUNDARY = withAlpha(KUMKUM, 0.18);

/**
 * The Protomaps basemap, painted from the same tokens. Protomaps tiles use
 * their own schema (not OpenMapTiles), so the layer list comes from their
 * generator and only the "flavor" — the palette — is ours. Sits over a
 * single .pmtiles file on our R2 bucket: no tile server, no per-request
 * billing, and the map data is frozen at the build date, which is fine for
 * an eleven-day festival.
 */
const HALDI_KUMKUM: Flavor = {
  ...namedFlavor("light"),
  background: PAPER,
  earth: PAPER,
  // Greens: leaf washed into paper, two strengths.
  park_a: withAlpha(LEAF, 0.1),
  park_b: withAlpha(LEAF, 0.16),
  wood_a: withAlpha(LEAF, 0.12),
  wood_b: withAlpha(LEAF, 0.18),
  scrub_a: withAlpha(LEAF, 0.08),
  scrub_b: withAlpha(LEAF, 0.12),
  zoo: withAlpha(LEAF, 0.1),
  // Institutional land stays quiet — one warm surface for all of it.
  hospital: PAPER_WARM,
  industrial: PAPER_WARM,
  school: PAPER_WARM,
  military: PAPER_WARM,
  pedestrian: PAPER_WARM,
  aerodrome: PAPER_WARM,
  runway: withAlpha(INK, 0.12),
  sand: PAPER_WARM,
  beach: PAPER_WARM,
  glacier: PAPER,
  water: WATER,
  buildings: BUILDING,
  pier: withAlpha(INK, 0.1),
  // Roads: paper fill on an ink wash; highways are a turmeric ribbon so the
  // ORR and NH44 read as structure at city zoom.
  highway: withAlpha(TURMERIC, 0.55),
  major: ROAD_FILL,
  minor_a: ROAD_FILL,
  minor_b: ROAD_FILL,
  minor_service: PAPER_WARM,
  link: ROAD_FILL,
  other: PAPER_WARM,
  highway_casing_early: ROAD_MAJOR_CASING,
  highway_casing_late: ROAD_MAJOR_CASING,
  major_casing_early: ROAD_CASING,
  major_casing_late: ROAD_CASING,
  minor_casing: ROAD_MINOR_CASING,
  minor_service_casing: ROAD_MINOR_CASING,
  link_casing: ROAD_CASING,
  bridges_highway: withAlpha(TURMERIC, 0.55),
  bridges_major: ROAD_FILL,
  bridges_minor: ROAD_FILL,
  bridges_link: ROAD_FILL,
  bridges_other: PAPER_WARM,
  bridges_highway_casing: ROAD_MAJOR_CASING,
  bridges_major_casing: ROAD_CASING,
  bridges_minor_casing: ROAD_MINOR_CASING,
  bridges_link_casing: ROAD_CASING,
  bridges_other_casing: ROAD_MINOR_CASING,
  tunnel_highway: PAPER_WARM,
  tunnel_major: PAPER_WARM,
  tunnel_minor: PAPER_WARM,
  tunnel_link: PAPER_WARM,
  tunnel_other: PAPER_WARM,
  tunnel_highway_casing: ROAD_MINOR_CASING,
  tunnel_major_casing: ROAD_MINOR_CASING,
  tunnel_minor_casing: ROAD_MINOR_CASING,
  tunnel_link_casing: ROAD_MINOR_CASING,
  tunnel_other_casing: ROAD_MINOR_CASING,
  railway: withAlpha(INK, 0.22),
  boundaries: BOUNDARY,
  // Type: ink on paper, like the rest of the page.
  city_label: INK,
  city_label_halo: PAPER,
  subplace_label: INK_DIM,
  subplace_label_halo: PAPER,
  state_label: withAlpha(INK, 0.35),
  state_label_halo: PAPER,
  country_label: withAlpha(INK, 0.45),
  roads_label_minor: INK_DIM,
  roads_label_minor_halo: PAPER,
  roads_label_major: INK_DIM,
  roads_label_major_halo: PAPER,
  ocean_label: LEAF,
  address_label: INK_DIM,
  address_label_halo: PAPER,
  landcover: {
    grassland: withAlpha(LEAF, 0.08),
    barren: PAPER_WARM,
    urban_area: PAPER_WARM,
    farmland: withAlpha(LEAF, 0.07),
    glacier: PAPER,
    scrub: withAlpha(LEAF, 0.08),
    forest: withAlpha(LEAF, 0.13),
  },
};

/**
 * Layers we don't want from the generator: POI pins and house numbers are
 * noise under our own pins, and one-way arrows and route shields are for
 * navigation apps.
 */
const DROP_LAYERS = new Set(["pois", "address_label", "roads_oneway", "roads_shields"]);

/**
 * @param pmtilesUrl  Public URL of the .pmtiles archive (https://…/x.pmtiles).
 * @param assetsBase  Public base that serves `fonts/` and `sprites/` (no trailing slash).
 */
export function protomapsStyle(pmtilesUrl: string, assetsBase: string): StyleSpecification {
  return {
    version: 8,
    name: "Haldi & Kumkum (Protomaps)",
    glyphs: `${assetsBase}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsBase}/sprites/v4/light`,
    sources: {
      omt: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: protomapsLayers("omt", HALDI_KUMKUM, { lang: "en" }).filter((l) => !DROP_LAYERS.has(l.id)),
  };
}

/** The parts of MapTiler's TileJSON the style needs, fetched once by lib/basemap.ts. */
export type TileJson = { tiles: string[]; minzoom?: number; maxzoom?: number };

/**
 * @param key        MapTiler Cloud key.
 * @param tilejson   Inlined TileJSON, so MapLibre doesn't fetch it again — every
 *                   request to MapTiler is metered. Omit to let MapLibre fetch it.
 * @param assetsBase Serve glyphs from our own bucket instead of MapTiler's
 *                   (saves 5–10 metered requests per new visitor). Omit to use theirs.
 */
export function maptilerStyle(key: string, tilejson?: TileJson, assetsBase?: string): StyleSpecification {
  return {
    version: 8,
    name: "Haldi & Kumkum",
    glyphs: assetsBase
      ? `${assetsBase}/fonts/{fontstack}/{range}.pbf`
      : `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    sources: {
      omt: {
        type: "vector",
        ...(tilejson
          ? { tiles: tilejson.tiles, minzoom: tilejson.minzoom ?? 0, maxzoom: tilejson.maxzoom ?? 14 }
          : { url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${key}` }),
        attribution:
          '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a> contributors',
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": PAPER } },

      {
        id: "landuse-residential",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["==", ["get", "class"], "residential"],
        paint: { "fill-color": PAPER_WARM, "fill-opacity": 0.55 },
      },
      {
        id: "landcover-green",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["wood", "grass", "scrub"]],
        ],
        paint: { "fill-color": GREEN, "fill-opacity": 0.7 },
      },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": GREEN, "fill-opacity": 0.72 },
      },

      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": WATER },
      },
      {
        id: "waterway",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: {
          "line-color": WATER,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 16, 3],
        },
      },

      {
        id: "building",
        type: "fill",
        source: "omt",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-color": BUILDING,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, 0.88],
        },
      },

      /* Roads: casing beneath, fill on top — the ribbon look of a paper map. */
      {
        id: "road-casing-major",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_MAJOR_CASING,
          "line-width": [
            "interpolate", ["linear"], ["zoom"], 8, 2.2, 12, 6.5, 16, 18,
          ],
        },
      },
      {
        id: "road-casing-primary",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "primary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_CASING,
          "line-width": [
            "interpolate", ["linear"], ["zoom"], 8, 1.2, 12, 4.5, 16, 14,
          ],
        },
      },
      {
        id: "road-casing-minor",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 10,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["secondary", "tertiary", "minor", "service"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_MINOR_CASING,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 13, 2, 16, 8],
        },
      },
      {
        id: "road-fill-minor",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 12.5,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["secondary", "tertiary", "minor", "service"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_FILL,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12.5,
            0.5,
            16,
            5.5,
          ],
        },
      },
      {
        id: "road-fill-major",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_FILL,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            0.6,
            12,
            3,
            16,
            12,
          ],
        },
      },
      {
        id: "rail",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["==", ["get", "class"], "rail"],
        paint: {
          "line-color": "rgba(36,18,8,0.16)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 1.6],
          "line-dasharray": [3, 2],
        },
      },

      {
        id: "boundary",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 6],
        paint: {
          "line-color": BOUNDARY,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 1.4],
          "line-dasharray": [4, 3],
        },
      },

      /* Labels last so nothing paints over them. */
      {
        id: "road-label",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "symbol-placement": "line",
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9, 17, 12],
          "text-letter-spacing": 0.02,
        },
        paint: {
          "text-color": INK_DIM,
          "text-halo-color": PAPER,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "place-suburb",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        minzoom: 11,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["suburb", "neighbourhood", "quarter"]],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
          "text-letter-spacing": 0.04,
          "text-max-width": 7,
        },
        paint: {
          "text-color": INK_DIM,
          "text-halo-color": PAPER,
          "text-halo-width": 1.6,
        },
      },
      {
        id: "place-town",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["town", "village"]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 14],
          "text-letter-spacing": 0.03,
        },
        paint: {
          "text-color": INK,
          "text-halo-color": PAPER,
          "text-halo-width": 1.8,
        },
      },
      {
        id: "place-city",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city"]]],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Medium"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 15],
          "text-letter-spacing": 0.08,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": LEAF,
          "text-halo-color": PAPER,
          "text-halo-width": 2.2,
          "text-opacity": 0.75,
        },
      },
    ],
  };
}

/**
 * Fallback when no MapTiler key is configured. Raster, 256px, no retina
 * variant — visibly softer, and dev-only under OSM's tile usage policy.
 */
export const osmRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "paper", type: "background", paint: { "background-color": PAPER } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};
