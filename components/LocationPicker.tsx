"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "./Icon";
import { HYDERABAD_CENTER } from "@/lib/pandals";
import { reverseGeocode, type Place } from "@/lib/geocode";
import { loadBasemap } from "@/lib/basemap";


type Props = {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  /** Called with the lane and colony under the pin, after it settles. */
  onPlace?: (p: Place) => void;
  /** The photo that will sit in this pin on the real map — shown here so the choice is seen, not guessed. */
  photo?: string | null;
};

/**
 * The pin stays fixed at the centre and the map moves under it. On a phone
 * that is far more precise than dragging a marker with a thumb, and it means
 * the thing you are aiming at is never hidden under your finger.
 */
export default function LocationPicker({ value, onChange, onPlace, photo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const cbRef = useRef({ onChange, onPlace });
  useEffect(() => {
    cbRef.current = { onChange, onPlace };
  }, [onChange, onPlace]);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MLMap | null = null;

    (async () => {
      const { Map: MapCtor, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const { style } = await loadBasemap(await import("maplibre-gl"));
      if (cancelled || !containerRef.current) return;

      const m = new MapCtor({
        container: containerRef.current,
        style,
        center: value ? [value.lng, value.lat] : HYDERABAD_CENTER,
        zoom: value ? 16 : 11,
        minZoom: 9,
        maxZoom: 19,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      map = m;
      mapRef.current = m;
      // One lookup per settled position. The pin moves with every pan, so
      // debounce past a thumb's worth of nudges and abort anything in flight.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let inflight: AbortController | undefined;
      m.on("moveend", () => {
        const c = m.getCenter();
        const lat = +c.lat.toFixed(6);
        const lng = +c.lng.toFixed(6);
        cbRef.current.onChange({ lat, lng });
        if (!cbRef.current.onPlace) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          inflight?.abort();
          inflight = new AbortController();
          try {
            const place = await reverseGeocode(lng, lat, inflight.signal);
            if (!cancelled) cbRef.current.onPlace?.(place);
          } catch {
            // Aborted or offline — the fields just stay as they are.
          }
        }, 450);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map owns its centre after mount; `value` only seeds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("Location isn't available on this device");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 17,
          duration: 600,
        });
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't get your location. Drag the map instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div>
      <div className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-xl border border-line shadow-[var(--shadow-elevated)]">
        <div ref={containerRef} className="h-full w-full" />
        {/* The fixed pin. Bottom of the tail is the exact point. Same ring,
            outline and tail as MapView's buildPin, so what you see here is
            what the map gets. Keyed on the photo so a new pick pops in. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full"
        >
          <div className="relative h-[47px] w-10">
            <span
              key={photo ?? ""}
              className="animate-pop absolute left-0 top-0 h-10 w-10 origin-bottom overflow-hidden rounded-full border-[3px] border-turmeric bg-turmeric shadow-[0_0_0_2px_#FAF9F6,0_3px_7px_rgba(36,18,8,0.32)]"
            >
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element -- local blob or R2 preview
                <img src={photo} alt="" className="block h-full w-full object-cover" />
              )}
            </span>
            <span className="absolute left-1/2 top-[38px] h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-turmeric" />
          </div>
        </div>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="numeric absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full border border-line bg-paper/92 py-1.5 pr-3 pl-2.5 text-[10px] uppercase tracking-[0.06em] text-ink shadow-[var(--shadow-elevated)] backdrop-blur transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:translate-y-px disabled:opacity-60"
        >
          <Icon name="navigate" size={12} />
          {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      <p className="numeric mt-2 text-[10.5px] text-ink-dim">
        {geoError ??
          (value
            ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag to adjust`
            : "Drag the map until the pin is on the mandapam")}
      </p>
    </div>
  );
}
