import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { pandals, photos, profiles } from "@/db/schema";
import { photoUrl } from "./r2";
import type { Pandal, PandalPhoto, VisarjanDay } from "./pandals";

/**
 * Every live pandal, with its live photos, shaped for the client.
 *
 * Deliberately not a bounding-box query: the map clusters client-side from a
 * single GeoJSON source, and clustering needs the whole set to be correct.
 * One festival's worth of Hyderabad pandals is a few thousand rows of ~150
 * bytes — a bbox endpoint becomes worth it only past that. Immersed pandals
 * are filtered on the client, where the festival day is known.
 */
/** Row → wire shape. A video's `url` is its poster; the file itself rides along in `video`. */
export function toPandalPhoto(p: {
  id: string;
  r2Key: string;
  likeCount: number;
  kind: "photo" | "video";
  posterKey: string | null;
  durationS: number | null;
}): PandalPhoto {
  if (p.kind === "video" && p.posterKey) {
    return {
      id: p.id,
      url: photoUrl(p.posterKey),
      likeCount: p.likeCount,
      video: { url: photoUrl(p.r2Key), durationS: p.durationS ?? 0 },
    };
  }
  return { id: p.id, url: photoUrl(p.r2Key), likeCount: p.likeCount };
}

export async function getLivePandals(): Promise<Pandal[]> {
  const claimant = alias(profiles, "claimant");
  const rows = await db
    .select({
      id: pandals.id,
      name: pandals.name,
      gully: pandals.gully,
      area: pandals.area,
      organisation: pandals.organisation,
      instagramHandle: pandals.instagramHandle,
      location: pandals.location,
      heightFt: pandals.heightFt,
      heightVerified: pandals.heightVerified,
      establishedYear: pandals.establishedYear,
      ecoFriendly: pandals.ecoFriendly,
      theme: pandals.theme,
      visarjanDay: pandals.visarjanDay,
      moryaCount: pandals.moryaCount,
      visitCount: pandals.visitCount,
      verified: pandals.verified,
      landmark: pandals.landmark,
      addedBy: profiles.displayName,
      claimedBy: claimant.displayName,
    })
    .from(pandals)
    .leftJoin(profiles, eq(pandals.submittedBy, profiles.id))
    .leftJoin(claimant, eq(pandals.claimedBy, claimant.id))
    .where(eq(pandals.status, "live"))
    .orderBy(asc(pandals.createdAt));

  if (rows.length === 0) return [];

  // Most-liked first so the cover picks itself; oldest breaks ties so a
  // pandal with no hearts yet keeps the order the uploader chose.
  const photoRows = await db
    .select({
      id: photos.id,
      pandalId: photos.pandalId,
      r2Key: photos.r2Key,
      likeCount: photos.likeCount,
      kind: photos.kind,
      posterKey: photos.posterKey,
      durationS: photos.durationS,
    })
    .from(photos)
    .where(
      and(
        eq(photos.status, "live"),
        inArray(photos.pandalId, rows.map((r) => r.id)),
      ),
    )
    .orderBy(desc(photos.isPin), desc(photos.likeCount), asc(photos.createdAt));

  const byPandal = new Map<string, PandalPhoto[]>();
  for (const p of photoRows) {
    const list = byPandal.get(p.pandalId) ?? [];
    list.push(toPandalPhoto(p));
    byPandal.set(p.pandalId, list);
  }

  return rows.map(({ location, ...r }) => ({
    ...r,
    lng: location.x,
    lat: location.y,
    visarjanDay: r.visarjanDay as VisarjanDay,
    photos: byPandal.get(r.id) ?? [],
  }));
}

/** What the manage page needs to decide who is looking and what they may do. */
export type ManagedPandal = {
  id: string;
  name: string;
  gully: string;
  area: string;
  organisation: string | null;
  instagramHandle: string | null;
  lat: number;
  lng: number;
  heightFt: number | null;
  heightVerified: boolean;
  establishedYear: number | null;
  ecoFriendly: boolean;
  theme: string | null;
  visarjanDay: VisarjanDay;
  landmark: boolean;
  status: "live" | "hidden" | "removed";
  submittedBy: string | null;
  claimedBy: string | null;
  /** Display name of the claimant, for "Claimed by …" when it isn't you. */
  claimedByName: string | null;
  photos: PandalPhoto[];
  /** The photo flagged for the map pin, if the uploader chose one. */
  pinPhotoId: string | null;
};

/**
 * One pandal regardless of status — the owner of a hidden one still needs to
 * reach it. Callers decide what a `removed` row means (a 404, usually).
 */
export async function getPandalForManage(id: string): Promise<ManagedPandal | null> {
  const claimant = alias(profiles, "claimant");
  const [row] = await db
    .select({
      id: pandals.id,
      name: pandals.name,
      gully: pandals.gully,
      area: pandals.area,
      organisation: pandals.organisation,
      instagramHandle: pandals.instagramHandle,
      location: pandals.location,
      heightFt: pandals.heightFt,
      heightVerified: pandals.heightVerified,
      establishedYear: pandals.establishedYear,
      ecoFriendly: pandals.ecoFriendly,
      theme: pandals.theme,
      visarjanDay: pandals.visarjanDay,
      landmark: pandals.landmark,
      status: pandals.status,
      submittedBy: pandals.submittedBy,
      claimedBy: pandals.claimedBy,
      claimedByName: claimant.displayName,
    })
    .from(pandals)
    .leftJoin(claimant, eq(pandals.claimedBy, claimant.id))
    .where(eq(pandals.id, id))
    .limit(1);
  if (!row) return null;

  const photoRows = await db
    .select({
      id: photos.id,
      r2Key: photos.r2Key,
      likeCount: photos.likeCount,
      isPin: photos.isPin,
      kind: photos.kind,
      posterKey: photos.posterKey,
      durationS: photos.durationS,
    })
    .from(photos)
    .where(and(eq(photos.pandalId, id), eq(photos.status, "live")))
    .orderBy(asc(photos.createdAt));

  const { location, ...rest } = row;
  return {
    ...rest,
    lng: location.x,
    lat: location.y,
    visarjanDay: row.visarjanDay as VisarjanDay,
    photos: photoRows.map(toPandalPhoto),
    pinPhotoId: photoRows.find((p) => p.isPin)?.id ?? null,
  };
}
