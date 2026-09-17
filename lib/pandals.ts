/**
 * Client-side shape of a pandal, as served by lib/queries.ts.
 *
 * This is the wire format, not the Postgres row: `location` has been split
 * into `lat`/`lng`, R2 keys have become public URLs, and the submitter's
 * profile has collapsed to a display name. Everything here is safe to ship
 * to the browser.
 */

import { thumbKey } from "./r2";

/** Immersion day within the festival, 1 (Chaturthi) through 16. */
export type VisarjanDay = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export const VISARJAN_DAYS: VisarjanDay[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

export type Pandal = {
  id: string;
  name: string;
  /** The lane itself — the "gully" the project is named for. */
  gully: string;
  area: string;
  /** The committee or youth association running it, if given. */
  organisation: string | null;
  /** Without the leading "@". */
  instagramHandle: string | null;
  lat: number;
  lng: number;
  heightFt: number | null;
  /** An admin has checked the height claim. Unverified heights show as "claimed". */
  heightVerified: boolean;
  /** Year the committee first put up a Ganesh; null when unknown. */
  establishedYear: number | null;
  /** Clay / natural idol. */
  ecoFriendly: boolean;
  /** This year's theme, if any. */
  theme: string | null;
  /** Free text from whoever added or runs it; null when nothing was written. */
  description: string | null;
  /** "YYYY-MM-DD" of the annadhanam (free meal), null when none is planned. */
  annadhanamDate: string | null;
  visarjanDay: VisarjanDay;
  /**
   * "Ganpati Bappa Morya" taps and geofenced "darshan done" check-ins. The
   * aggregates only — whether *this* viewer tapped is fetched separately,
   * because this type ships in the cached page.
   */
  moryaCount: number;
  visitCount: number;
  /** Display name of the submitter; null for seeded landmarks. */
  addedBy: string | null;
  /** Display name of whoever claimed to run it; null until someone does. */
  claimedBy: string | null;
  verified: boolean;
  /** City-famous pandals, pre-seeded. Everything else is user-submitted. */
  landmark: boolean;
  /** When it was put on the map, epoch ms. Drives the "new today" filter. */
  addedAt: number;
  /** Live photos, most-liked first (ties: oldest). The first is the cover. Can be empty. */
  photos: PandalPhoto[];
};

/**
 * A photo or video as shipped to the client. `url` is always a still image —
 * the photo itself, or a video's poster frame — so pins, thumbnails and
 * cards never touch video bytes. `video` is present only for videos and is
 * what the lightbox plays.
 */
export type PandalPhoto = {
  id: string;
  url: string;
  likeCount: number;
  video?: { url: string; durationS: number };
};

/** Ganesh Chaturthi 2026. Day 1 of the festival. */
export const FESTIVAL_START = new Date("2026-09-14T00:00:00+05:30");
export const FESTIVAL_DAYS = 16;

/** Approximate centre of the pin cloud — Hyderabad, not a random guess. */
export const HYDERABAD_CENTER: [number, number] = [78.4600, 17.4180];

/** Days until this pandal is immersed, given the current festival day. */
export function daysUntilVisarjan(p: Pandal, currentDay: number): number {
  return p.visarjanDay - currentDay;
}

/**
 * Urgency drives the entire colour system: what is leaving soonest is what
 * you should go see first. This is the one piece of genuinely useful
 * information a generic map app would not surface.
 */
export type Urgency = "today" | "soon" | "later";

export function urgencyOf(p: Pandal, currentDay: number): Urgency {
  const left = daysUntilVisarjan(p, currentDay);
  if (left <= 0) return "today";
  if (left <= 2) return "soon";
  return "later";
}

/**
 * Turmeric is the default idol pin — the palette assigns it to pins directly,
 * and it keeps the map reading gold rather than forest-green. Urgency then
 * escalates to Kumkum for what's leaving first. Banana Leaf stays reserved
 * for verified status, not for pins.
 */
export const URGENCY_COLOR: Record<Urgency, string> = {
  today: "#D6402C", // Kumkum — go today or miss it
  soon:  "#D6402C", // Kumkum — same urgency tier
  later: "#F2A93C", // Turmeric — the ordinary idol pin
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  today: "Immersed today",
  soon:  "Leaving soon",
  later: "Here all week",
};

/**
 * Pins carry two tiers, not three. The exact day count lives in the list and
 * the detail view, where there is room to read it; on the map, a third colour
 * only competed with the two that matter.
 */
export const LEGEND: { color: string; label: string; tiers: Urgency[] }[] = [
  { color: "#D6402C", label: "Leaving today or tomorrow", tiers: ["today", "soon"] },
  { color: "#F2A93C", label: "Here all week", tiers: ["later"] },
];

/** Once an idol is immersed it is gone — the map thins out as the festival runs. */
export function isStillUp(p: Pandal, currentDay: number): boolean {
  return p.visarjanDay >= currentDay;
}

/** Bounding box of the pin cloud, as [west, south, east, north]; null when empty. */
export function boundsOf(list: Pandal[]): [number, number, number, number] | null {
  if (list.length === 0) return null;
  const lats = list.map((p) => p.lat);
  const lngs = list.map((p) => p.lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * The small variant of a photo, for map pins and thumbnails. It is a real
 * object in R2 (`thumbKey`), cut when the photo was uploaded, so a 40px pin
 * never downloads the full-size copy and nothing is resized on the fly.
 */
export function thumbUrl(src: string): string {
  return thumbKey(src);
}

/** The calendar date this idol goes into the water. */
export function visarjanDate(p: Pandal): string {
  const d = new Date(FESTIVAL_START.getTime() + (p.visarjanDay - 1) * 86_400_000);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Today's IST calendar day as "YYYY-MM-DD", the format annadhanamDate is stored in. */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** "Sat 20 Sept" for a stored "YYYY-MM-DD"; the date is an IST calendar day. */
export function annadhanamLabel(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Haversine, in km. Good enough at city scale. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
