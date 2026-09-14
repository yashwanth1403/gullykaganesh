"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Map as MLMap,
  Marker as MLMarker,
  GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type Pandal,
  HYDERABAD_CENTER,
  urgencyOf,
  URGENCY_COLOR,
  isStillUp,
  boundsOf,
  thumbUrl,
} from "@/lib/pandals";
import { loadBasemap } from "@/lib/basemap";

// Public by necessity — it ships in the client bundle. Restrict it by domain
// in the MapTiler dashboard; that, not secrecy, is what protects the quota.

const SRC = "pandals";
const KUMKUM = "#D6402C";
const TURMERIC = "#F2A93C";
const PAPER = "#FAF9F6";

type Props = {
  pandals: Pandal[];
  currentDay: number;
  selectedId: string | null;
  /** The viewer's position, once granted. Drawn as a dot; the map stays put. */
  userPos: { lat: number; lng: number } | null;
  /** Bumped by the "Near me" button — each change eases the map to `userPos`. */
  nearMeTick: number;
  onSelect: (id: string) => void;
  onDeselect: () => void;
};

const LEAF = "#2F6E4F";

/**
 * "You are here": a Banana Leaf dot with a soft halo. Green is reserved in
 * the palette for verified status, so it never collides with an idol pin.
 */
function buildUserDot() {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Your location");
  el.style.cssText = "position:relative;width:22px;height:22px;pointer-events:none;";
  el.innerHTML = `<span style="position:absolute;inset:0;border-radius:999px;background:${LEAF};opacity:0.18;animation:haloPulse 2.6s infinite;"></span><span style="position:absolute;inset:5px;border-radius:999px;background:${LEAF};box-shadow:0 0 0 2.5px ${PAPER},0 2px 5px rgba(36,18,8,0.3);"></span>`;
  return el;
}

/** Points for the clustered source. Immersed idols are simply not included. */
function toGeoJSON(list: Pandal[], currentDay: number) {
  return {
    type: "FeatureCollection" as const,
    features: list
      .filter((p) => isStillUp(p, currentDay))
      .map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          label: `${p.name}, ${p.area}`,
          // Omitted, not empty, when there is no photo: the cluster reducer
          // below uses coalesce, which skips null but not "".
          ...(p.photos[0] ? { photo: p.photos[0].url } : {}),
          initial: p.name.charAt(0),
          landmark: p.landmark ? 1 : 0,
          // Summed across a cluster, so a bubble knows how many of its
          // pandals are leaving imminently.
          urgent: urgencyOf(p, currentDay) === "later" ? 0 : 1,
        },
      })),
  };
}

/** A single pandal: its own photo, ringed in its urgency colour. */
function buildPin(
  label: string,
  photo: string | null,
  initial: string,
  color: string,
  landmark: boolean,
) {
  const d = landmark ? 52 : 40;
  const tail = landmark ? 9 : 7;

  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute("aria-label", label);
  root.style.cssText = `width:${d}px;height:${d + tail}px;padding:0;border:0;background:none;cursor:pointer;`;

  const scale = document.createElement("span");
  scale.className = "gk-scale";
  scale.style.cssText = `position:relative;display:block;width:100%;height:100%;transform-origin:50% 100%;transition:transform 200ms cubic-bezier(0.34,1.4,0.5,1);`;

  const halo = document.createElement("span");
  halo.className = "gk-halo";
  halo.style.cssText = `position:absolute;top:0;left:0;width:${d}px;height:${d}px;border-radius:999px;background:${color};opacity:0;pointer-events:none;`;

  const ring = document.createElement("span");
  // Solid colour behind the photo, so a slow image still reads as a pin.
  ring.style.cssText = `position:absolute;top:0;left:0;width:${d}px;height:${d}px;border-radius:999px;overflow:hidden;background:${color};border:3px solid ${color};box-shadow:0 0 0 2px ${PAPER},0 3px 7px rgba(36,18,8,0.32);`;

  if (photo) {
    const img = document.createElement("img");
    img.src = thumbUrl(photo, landmark ? 128 : 96);
    img.alt = "";
    img.decoding = "async";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    ring.appendChild(img);
  } else {
    // Nobody has photographed this one yet: its initial in the display face,
    // so an unphotographed pandal still looks like a place and not a bug.
    const glyph = document.createElement("span");
    glyph.textContent = initial;
    glyph.style.cssText = `position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-rozha),Georgia,serif;font-size:${landmark ? 26 : 20}px;line-height:1;color:${PAPER};`;
    ring.appendChild(glyph);
  }

  const tailEl = document.createElement("span");
  tailEl.style.cssText = `position:absolute;left:50%;top:${d - 2}px;transform:translateX(-50%);width:0;height:0;border-left:${tail - 2}px solid transparent;border-right:${tail - 2}px solid transparent;border-top:${tail}px solid ${color};filter:drop-shadow(0 2px 1px rgba(36,18,8,0.22));`;

  scale.append(halo, ring, tailEl);
  root.append(scale);
  return root;
}

/**
 * A cluster: still a real idol photo, with a count badge.
 *
 * A plain numbered circle would be the conventional treatment, but it would
 * strip the festival out of the map at exactly the zoom level most people
 * arrive at. The ring turns Kumkum when any pandal inside is leaving soon.
 */
function buildCluster(count: number, urgent: number, photo: string | null) {
  const d = count > 60 ? 64 : count > 20 ? 58 : 50;
  // Proportion, not presence: at this density almost every cluster contains
  // at least one urgent pandal, so "any" would paint the whole map red and
  // say nothing. Kumkum means most of this cluster is about to go.
  const color = urgent / Math.max(count, 1) >= 0.5 ? KUMKUM : TURMERIC;

  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute(
    "aria-label",
    `${count} mandapams here${urgent > 0 ? `, ${urgent} leaving today or tomorrow` : ""}. Zoom in`,
  );
  root.style.cssText = `width:${d}px;height:${d}px;padding:0;border:0;background:none;cursor:pointer;`;

  const scale = document.createElement("span");
  scale.className = "gk-scale";
  scale.style.cssText = `position:relative;display:block;width:100%;height:100%;transition:transform 200ms cubic-bezier(0.34,1.4,0.5,1);`;

  const ring = document.createElement("span");
  ring.style.cssText = `position:absolute;inset:0;border-radius:999px;overflow:hidden;background:${color};border:3px solid ${color};box-shadow:0 0 0 2px ${PAPER},0 4px 10px rgba(36,18,8,0.34);`;

  if (photo) {
    const img = document.createElement("img");
    img.src = thumbUrl(photo, 160);
    img.alt = "";
    img.decoding = "async";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
    // Darken so the count stays readable over any photo.
    const veil = document.createElement("span");
    veil.style.cssText = "position:absolute;inset:0;background:rgba(36,18,8,0.42);";
    ring.append(img, veil);
  }

  const badge = document.createElement("span");
  badge.textContent = String(count);
  badge.style.cssText = `position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-jet),monospace;font-weight:600;font-size:${
    count > 99 ? 14 : 16
  }px;color:${PAPER};text-shadow:0 1px 3px rgba(36,18,8,0.6);`;

  scale.append(ring, badge);
  root.append(scale);
  return root;
}

export default function MapView({
  pandals,
  currentDay,
  selectedId,
  userPos,
  nearMeTick,
  onSelect,
  onDeselect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Record<string, MLMarker>>({});
  const userMarkerRef = useRef<MLMarker | null>(null);
  // Map init is async; a position fix can beat it. Effects that need the
  // map key on this so they re-run once it exists.
  const [mapReady, setMapReady] = useState(false);
  // The branded curtain over the map until the first pins are placed —
  // "on" → "fading" (400 ms opacity) → gone. A timer backstops it so a slow
  // tile server can never leave the curtain up for good.
  const [curtain, setCurtain] = useState<"on" | "fading" | "off">("on");
  const revealedRef = useRef(false);
  const backstopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedRef = useRef<string | null>(selectedId);
  const cbRef = useRef({ onSelect, onDeselect });
  useEffect(() => {
    cbRef.current = { onSelect, onDeselect };
  }, [onSelect, onDeselect]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MLMap | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const { Map: MapCtor, Marker, NavigationControl, setWorkerUrl } =
        await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      // v6 is ESM-only and ships its worker as a separate module chunk that
      // Next does not emit for a dependency. Without this the Worker is
      // constructed against the page URL, dies on creation, and vector tiles
      // never parse — with no error surfaced.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const { style } = await loadBasemap(await import("maplibre-gl"));
      if (cancelled || !containerRef.current) return;

      const m = new MapCtor({
        container: containerRef.current,
        style,
        center: HYDERABAD_CENTER,
        zoom: 10.4,
        minZoom: 9,
        maxZoom: 18,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
      map = m;
      m.touchZoomRotate.disableRotation();
      mapRef.current = m;
      m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      m.on("click", () => cbRef.current.onDeselect());
      m.on("error", (e) => console.error("[map]", e.error?.message ?? e));

      ro = new ResizeObserver(() => m.resize());
      ro.observe(containerRef.current);

      const start = () => {
        if (cancelled || m.getSource(SRC)) return;

        m.addSource(SRC, {
          type: "geojson",
          data: toGeoJSON(pandals, currentDay),
          cluster: true,
          clusterRadius: 58,
          clusterMaxZoom: 15,
          clusterProperties: {
            urgent: ["+", ["get", "urgent"]],
            // First photo among the leaves, so a cluster shows a real idol
            // from inside it rather than a generic bubble.
            photo: [["coalesce", ["accumulated"], ["get", "photo"]], ["get", "photo"]],
          },
        });
        // Markers are DOM, but tiles only load for a source a layer consumes,
        // and querySourceFeatures reads those tiles. This layer exists purely
        // to make the source tile — it paints nothing.
        m.addLayer({
          id: "pandals-tiler",
          type: "circle",
          source: SRC,
          paint: { "circle-radius": 1, "circle-opacity": 0 },
        });

        m.on("move", sync);
        m.on("moveend", sync);
        m.on("sourcedata", (e) => {
          if (e.sourceId === SRC && e.isSourceLoaded) {
            sync();
            reveal();
          }
        });
        sync();
      };

      // Lift the curtain once: the pins created in the same tick as this
      // call are the ones that get the staggered drop.
      const reveal = () => {
        if (revealedRef.current || cancelled) return;
        revealedRef.current = true;
        setCurtain("fading");
        setTimeout(() => !cancelled && setCurtain("off"), 420);
      };
      backstopRef.current = setTimeout(reveal, 8000);

      /**
       * Rebuild only the markers currently on screen. This is the whole point
       * of clustering here: ~300 permanent DOM markers dropped the map to
       * single-digit FPS, where this keeps a few dozen alive at a time.
       */
      function sync() {
        if (cancelled || !m.getSource(SRC)) return;
        const feats = m.querySourceFeatures(SRC);
        const want = new Set<string>();

        for (const f of feats) {
          const props = f.properties as Record<string, unknown>;
          const geom = f.geometry;
          if (geom.type !== "Point") continue;
          const coords = geom.coordinates as [number, number];
          const isCluster = Boolean(props.cluster);
          const key = isCluster ? `c-${props.cluster_id}` : `p-${props.id}`;
          // querySourceFeatures returns the same feature once per tile.
          if (want.has(key)) continue;
          want.add(key);
          if (markersRef.current[key]) continue;

          let el: HTMLElement;
          if (isCluster) {
            const count = Number(props.point_count) || 0;
            const urgent = Number(props.urgent) || 0;
            const photo = typeof props.photo === "string" ? props.photo : null;
            el = buildCluster(count, urgent, photo);
            el.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const src = m.getSource(SRC) as GeoJSONSource;
              const zoom = await src.getClusterExpansionZoom(
                Number(props.cluster_id),
              );
              m.easeTo({ center: coords, zoom: zoom + 0.2, duration: 520 });
            });
          } else {
            const p = pandals.find((x) => x.id === props.id);
            if (!p) continue;
            el = buildPin(
              String(props.label),
              typeof props.photo === "string" ? props.photo : null,
              String(props.initial),
              URGENCY_COLOR[urgencyOf(p, currentDay)],
              Number(props.landmark) === 1,
            );
            el.addEventListener("click", (ev) => {
              ev.stopPropagation();
              cbRef.current.onSelect(String(props.id));
            });
            if (props.id === selectedRef.current) applyActive(el, true);
          }
          // Southern markers in front, so overlaps read as depth.
          el.style.zIndex = String(Math.round((90 - coords[1]) * 100));
          // First reveal only: drop in, one after another. MapLibre owns the
          // marker root's transform, and .gk-scale has its own, so the
          // animation lives on a wrapper between them.
          if (!revealedRef.current) {
            const drop = document.createElement("span");
            drop.className = "animate-drop";
            drop.style.cssText = "display:block;width:100%;height:100%;transform-origin:50% 100%;";
            drop.style.animationDelay = `${Math.min(want.size - 1, 14) * 45}ms`;
            while (el.firstChild) drop.appendChild(el.firstChild);
            el.appendChild(drop);
          }
          markersRef.current[key] = new Marker({
            element: el,
            anchor: isCluster ? "center" : "bottom",
          })
            .setLngLat(coords)
            .addTo(m);
        }

        for (const key of Object.keys(markersRef.current)) {
          if (!want.has(key)) {
            markersRef.current[key].remove();
            delete markersRef.current[key];
          }
        }
      }

      if (m.isStyleLoaded()) start();
      else m.once("load", start);
      setMapReady(true);

      // An empty map (nothing submitted yet) keeps the city-wide default view.
      const bounds = boundsOf(pandals);
      if (!bounds) return;
      const [w, s2, e, n] = bounds;
      const rail = window.matchMedia("(min-width: 768px)").matches;
      m.fitBounds(
        [
          [w, s2],
          [e, n],
        ],
        {
          padding: {
            top: rail ? 120 : 150,
            bottom: rail ? 40 : 250,
            left: rail ? 414 : 34,
            right: 34,
          },
          duration: 0,
          maxZoom: 12.4,
        },
      );
    })();

    return () => {
      cancelled = true;
      clearTimeout(backstopRef.current);
      ro?.disconnect();
      Object.values(markersRef.current).forEach((mk) => mk.remove());
      markersRef.current = {};
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Day changes re-feed the source; sync() then rebuilds the visible markers. */
  useEffect(() => {
    const src = mapRef.current?.getSource(SRC) as GeoJSONSource | undefined;
    if (!src) return;
    Object.values(markersRef.current).forEach((mk) => mk.remove());
    markersRef.current = {};
    src.setData(toGeoJSON(pandals, currentDay));
  }, [currentDay, pandals]);

  /* A position fix: place the dot. The map does not move on its own — the
     city view is the default, and "Near me" is the way in. */
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m || !userPos) return;
    let cancelled = false;
    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;
      if (!userMarkerRef.current) {
        userMarkerRef.current = new Marker({ element: buildUserDot(), anchor: "center" })
          .setLngLat([userPos.lng, userPos.lat])
          .addTo(m);
      } else {
        userMarkerRef.current.setLngLat([userPos.lng, userPos.lat]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userPos, mapReady]);

  /* "Near me": bring the map to the dot at a walking-distance zoom. Waits for
     the fix if the tap came before it arrived. */
  useEffect(() => {
    const m = mapRef.current;
    if (!nearMeTick || !mapReady || !m || !userPos) return;
    m.easeTo({ center: [userPos.lng, userPos.lat], zoom: 13.6, duration: 900 });
  }, [nearMeTick, userPos, mapReady]);

  /* Selection: lift the chosen pin, pulse its halo, ease the map to it. */
  useEffect(() => {
    selectedRef.current = selectedId;
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      if (!key.startsWith("p-")) return;
      applyActive(marker.getElement(), key === `p-${selectedId}`);
    });

    if (!selectedId || !mapRef.current) return;
    const p = pandals.find((x) => x.id === selectedId);
    if (!p) return;
    mapRef.current.easeTo({
      center: [p.lng, p.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14.2),
      offset: [0, -110],
      duration: 640,
    });
  }, [selectedId, pandals]);

  return (
    // `isolate` gives the map its own stacking context: without it the
    // per-marker z-index values compete with the masthead and sheet in the
    // page's context and paint straight over them.
    <div className="absolute inset-0 isolate z-0">
      <div ref={containerRef} className="h-full w-full" />
      {curtain !== "off" && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-paper pb-[236px] transition-opacity duration-[420ms] ease-out md:pb-0 md:pl-[380px] ${
            curtain === "fading" ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img src="/brand/ganesh-480.webp" alt="" width={132} height={142} className="animate-bob h-[142px] w-auto" />
            <p className="numeric mt-5 text-[11px] uppercase tracking-[0.1em] text-ink-dim">
              Bringing Bappa to the map
            </p>
            <div className="progress-bar relative mt-3 w-36 rounded-full bg-paper-warm" />
          </div>
        </div>
      )}
    </div>
  );
}

function applyActive(el: HTMLElement, active: boolean) {
  const scale = el.querySelector<HTMLElement>(".gk-scale");
  const halo = el.querySelector<HTMLElement>(".gk-halo");
  if (scale) scale.style.transform = active ? "scale(1.28)" : "scale(1)";
  if (halo) halo.style.animation = active ? "haloPulse 2.6s infinite" : "none";
  if (active) el.style.zIndex = "9999";
}
