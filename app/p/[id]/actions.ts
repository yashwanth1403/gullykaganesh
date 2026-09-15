"use server";

import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pandals, photos } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { deletePhotoObject, verifyOwnUploads } from "@/lib/r2-server";
import { MAX_PHOTOS, pandalInput } from "@/lib/validation";

/**
 * Same fields as a new submission, plus which existing photos to drop. New
 * photos are optional here — the ones already on the pandal count. The pin
 * is either one of the new photos (`pinIndex`) or one already on the pandal
 * (`pinPhotoId`); neither means "leave the flag as it is".
 */
const updateInput = pandalInput.omit({ photos: true }).extend({
  id: z.string().uuid(),
  photos: z.array(pandalInput.shape.photos.element).max(MAX_PHOTOS),
  removePhotoIds: z.array(z.string().uuid()).max(MAX_PHOTOS),
  pinPhotoId: z.string().uuid().optional(),
});

export type UpdateResult = { ok: true; id: string } | { ok: false; error: string };

export async function updatePandal(raw: unknown): Promise<UpdateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to edit a mandapam" };

  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const input = parsed.data;

  const [pandal] = await db
    .select({
      submittedBy: pandals.submittedBy,
      claimedBy: pandals.claimedBy,
      status: pandals.status,
      landmark: pandals.landmark,
    })
    .from(pandals)
    .where(eq(pandals.id, input.id))
    .limit(1);
  if (!pandal || pandal.status === "removed") return { ok: false, error: "That mandapam is gone" };
  if (!canEdit(user, pandal)) return { ok: false, error: "forbidden" };

  const bad = await verifyOwnUploads(user.id, input.photos);
  if (bad) return { ok: false, error: bad };

  let purge: string[] = [];
  try {
    purge = await db.transaction(async (tx) => {
      await tx
        .update(pandals)
        .set({
          name: input.name,
          gully: input.gully,
          area: input.area,
          instagramHandle: input.instagramHandle,
          heightFt: input.heightFt,
          establishedYear: input.establishedYear,
          ecoFriendly: input.ecoFriendly,
          theme: input.theme,
          visarjanDay: input.visarjanDay,
          location: { x: input.lng, y: input.lat },
          updatedAt: new Date(),
        })
        .where(eq(pandals.id, input.id));

      // The pandalId guard means a stray id can't remove another pandal's photo.
      const removed =
        input.removePhotoIds.length === 0
          ? []
          : await tx
              .update(photos)
              .set({ status: "removed" })
              .where(
                and(
                  inArray(photos.id, input.removePhotoIds),
                  eq(photos.pandalId, input.id),
                  eq(photos.status, "live"),
                ),
              )
              .returning({ r2Key: photos.r2Key, posterKey: photos.posterKey });

      // Clear before setting: the partial unique index allows one pin per
      // pandal, and the old one may not be among the removed photos.
      const movingPin = input.pinIndex !== undefined || input.pinPhotoId !== undefined;
      if (movingPin) {
        await tx
          .update(photos)
          .set({ isPin: false })
          .where(and(eq(photos.pandalId, input.id), eq(photos.isPin, true)));
      }
      if (input.pinPhotoId !== undefined && input.pinIndex === undefined) {
        await tx
          .update(photos)
          .set({ isPin: true })
          .where(
            and(eq(photos.id, input.pinPhotoId), eq(photos.pandalId, input.id), eq(photos.status, "live")),
          );
      }

      if (input.photos.length > 0) {
        await tx.insert(photos).values(
          input.photos.map((p, i) => ({
            pandalId: input.id,
            r2Key: p.key,
            kind: p.kind,
            posterKey: p.posterKey ?? null,
            durationS: p.durationS ?? null,
            width: p.width,
            height: p.height,
            uploadedBy: user.id,
            isPin: i === input.pinIndex,
          })),
        );
      }

      const [{ live }] = await tx
        .select({ live: count() })
        .from(photos)
        .where(and(eq(photos.pandalId, input.id), eq(photos.status, "live")));
      if (live === 0 && !pandal.landmark) throw new Error("no-photos");

      return removed.flatMap((r) => (r.posterKey ? [r.r2Key, r.posterKey] : [r.r2Key]));
    });
  } catch (err) {
    if (err instanceof Error && err.message === "no-photos") {
      return { ok: false, error: "Keep at least one photo." };
    }
    throw err;
  }

  // Outside the transaction: a slow or failed delete must not hold a lock or
  // undo a saved edit.
  await Promise.all(purge.map(deletePhotoObject));

  revalidatePath("/");
  return { ok: true, id: input.id };
}

export type ClaimResult = { ok: true } | { ok: false; error: "signin" | "claimed" | "invalid" };

/**
 * "I run this mandapam." First to say so wins — the `claimed_by is null` in
 * the WHERE is the whole race guard, so two taps at once can't both land.
 */
export async function claimPandal(pandalId: string): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (!z.string().uuid().safeParse(pandalId).success) return { ok: false, error: "invalid" };

  const won = await db
    .update(pandals)
    .set({ claimedBy: user.id, claimedAt: new Date() })
    .where(and(eq(pandals.id, pandalId), isNull(pandals.claimedBy), eq(pandals.status, "live")))
    .returning({ id: pandals.id });
  if (won.length === 0) return { ok: false, error: "claimed" };

  revalidatePath("/");
  return { ok: true };
}

/** Only the claimant can undo their own claim; admins revoke from /admin. */
export async function unclaimPandal(pandalId: string): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (!z.string().uuid().safeParse(pandalId).success) return { ok: false, error: "invalid" };

  await db
    .update(pandals)
    .set({ claimedBy: null, claimedAt: null })
    .where(and(eq(pandals.id, pandalId), eq(pandals.claimedBy, user.id)));

  revalidatePath("/");
  return { ok: true };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * The owner takes it down. A soft delete — the row stays for audit, the
 * status keeps it out of every query, and the photos are purged from R2 —
 * the same end state as an admin's "remove for good".
 */
export async function deletePandal(pandalId: string): Promise<DeleteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  if (!z.string().uuid().safeParse(pandalId).success) return { ok: false, error: "invalid" };

  const [pandal] = await db
    .select({ submittedBy: pandals.submittedBy, claimedBy: pandals.claimedBy, status: pandals.status })
    .from(pandals)
    .where(eq(pandals.id, pandalId))
    .limit(1);
  if (!pandal || pandal.status === "removed") return { ok: false, error: "gone" };
  if (!canEdit(user, pandal)) return { ok: false, error: "forbidden" };

  const purge = await db.transaction(async (tx) => {
    await tx.update(pandals).set({ status: "removed", updatedAt: new Date() }).where(eq(pandals.id, pandalId));
    const rows = await tx
      .update(photos)
      .set({ status: "removed" })
      .where(and(eq(photos.pandalId, pandalId), inArray(photos.status, ["live", "hidden"])))
      .returning({ r2Key: photos.r2Key, posterKey: photos.posterKey });
    return rows.flatMap((r) => (r.posterKey ? [r.r2Key, r.posterKey] : [r.r2Key]));
  });
  await Promise.all(purge.map(deletePhotoObject));

  revalidatePath("/");
  return { ok: true };
}
