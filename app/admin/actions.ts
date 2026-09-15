"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pandals, photos, reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { deletePhotoObject } from "@/lib/r2-server";

/**
 * Every action here throws rather than returning an error: nothing on the
 * admin page is reachable by a non-admin, so a failure is a bug or an
 * attack, not a state the UI needs to explain.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new Error("forbidden");
  return user;
}

const uuid = z.string().uuid();
const status = z.enum(["live", "hidden", "removed"]);
const target = z.union([z.object({ pandalId: uuid }), z.object({ photoId: uuid })]);
type Target = z.infer<typeof target>;

/** Closes every open report on the target, so it leaves the queue. */
async function resolve(t: Target) {
  await db
    .update(reports)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        "pandalId" in t ? eq(reports.pandalId, t.pandalId) : eq(reports.photoId, t.photoId),
        isNull(reports.resolvedAt),
      ),
    );
}

/** Marks the photos `removed` in one statement and hands back the keys to purge. */
async function removePhotoRows(where: ReturnType<typeof eq>) {
  const rows = await db
    .update(photos)
    .set({ status: "removed" })
    .where(where)
    .returning({ r2Key: photos.r2Key, posterKey: photos.posterKey });
  return rows.flatMap((r) => (r.posterKey ? [r.r2Key, r.posterKey] : [r.r2Key]));
}

export async function setPandalStatus(rawId: unknown, rawStatus: unknown) {
  await requireAdmin();
  const id = uuid.parse(rawId);
  const next = status.parse(rawStatus);

  let purge: string[] = [];
  await db.update(pandals).set({ status: next }).where(eq(pandals.id, id));
  if (next === "removed") purge = await removePhotoRows(eq(photos.pandalId, id));
  await resolve({ pandalId: id });

  await Promise.all(purge.map(deletePhotoObject));
  revalidatePath("/");
}

export async function setPhotoStatus(rawId: unknown, rawStatus: unknown) {
  await requireAdmin();
  const id = uuid.parse(rawId);
  const next = status.parse(rawStatus);

  let purge: string[] = [];
  if (next === "removed") purge = await removePhotoRows(eq(photos.id, id));
  else await db.update(photos).set({ status: next }).where(eq(photos.id, id));
  await resolve({ photoId: id });

  await Promise.all(purge.map(deletePhotoObject));
  revalidatePath("/");
}

/** "Nothing wrong here": clear the reports and leave the target as it is. */
export async function dismissReports(raw: unknown) {
  await requireAdmin();
  await resolve(target.parse(raw));
}

export async function revokeClaim(rawId: unknown) {
  await requireAdmin();
  const id = uuid.parse(rawId);
  await db.update(pandals).set({ claimedBy: null, claimedAt: null }).where(eq(pandals.id, id));
  revalidatePath("/");
}

/**
 * "We've seen it; the height is right." Lives here rather than in the edit
 * flow because the claimant is exactly who shouldn't be able to verify their
 * own number. Shown on the manage page to admins only.
 */
export async function setHeightVerified(rawId: unknown, rawVerified: unknown) {
  await requireAdmin();
  const id = uuid.parse(rawId);
  const verified = z.boolean().parse(rawVerified);
  await db.update(pandals).set({ heightVerified: verified }).where(eq(pandals.id, id));
  revalidatePath("/");
  revalidatePath("/top");
}
