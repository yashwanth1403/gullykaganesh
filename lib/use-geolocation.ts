"use client";

import { useCallback, useEffect, useState } from "react";
import { HYDERABAD_BOUNDS } from "./validation";

export type LatLng = { lat: number; lng: number };

/**
 * Where the browser stands on giving us a position. `prompt` means it will
 * ask the moment we request — which is exactly when we want to explain
 * ourselves first, in our own sheet, before the system dialog appears.
 */
export type LocationStatus = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

export type Geolocation = {
  pos: LatLng | null;
  status: LocationStatus;
  /** True while a fix is being requested. */
  locating: boolean;
  /** Request a fix. Triggers the system permission dialog if it hasn't been answered. */
  locate: () => void;
};

/**
 * One position fix. Requested silently on mount only when permission is
 * already granted — a cold "Allow location?" from the browser before the map
 * has even drawn is the surest way to get a "Block". Otherwise the page asks
 * in its own words first and calls `locate()` on a yes.
 *
 * `pos` stays null if the person declines, the device can't, or the fix is
 * outside Hyderabad — someone opening the link from Bengaluru should see the
 * city, not their own street.
 */
export function useGeolocation(): Geolocation {
  const [pos, setPos] = useState<LatLng | null>(null);
  // What can be known without asking. Not rendered, so the server/client
  // difference is harmless.
  const [status, setStatus] = useState<LocationStatus>(() => {
    if (typeof navigator === "undefined") return "unknown";
    if (!("geolocation" in navigator)) return "unsupported";
    // Safari < 16 has no Permissions API; treat that as "will prompt" so
    // the page's own sheet still runs first.
    if (!("permissions" in navigator)) return "prompt";
    return "unknown";
  });
  const [locating, setLocating] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        const { west, south, east, north } = HYDERABAD_BOUNDS;
        if (lat >= south && lat <= north && lng >= west && lng <= east) setPos({ lat, lng });
        setStatus("granted");
        setLocating(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator) || !("permissions" in navigator)) return;
    let result: PermissionStatus | null = null;
    const sync = () => {
      if (!result) return;
      setStatus(result.state);
      if (result.state === "granted") request();
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((r) => {
        result = r;
        sync();
        r.addEventListener("change", sync);
      })
      .catch(() => setStatus("prompt"));
    return () => result?.removeEventListener("change", sync);
  }, [request]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    request();
  }, [request]);

  return { pos, status, locating, locate };
}
