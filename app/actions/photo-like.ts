"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { photoLikes, photos } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Hearts per user per hour. Same shape as the Morya limit. */
const HOURLY_LIMIT = 120;

const input = z.object({ photoId: z.string().uuid() });

export type PhotoLikeResult =
  | { ok: true; liked: boolean; count: number }
  | { ok: false; error: "signin" | "invalid" | "limit" };

/**
 * Toggle a heart on one photo. The most-liked live photo becomes the
 * pandal's cover the next time the map page regenerates — no separate
 * "set cover" step, which is the point.
 */
export async function togglePhotoLike(raw: unknown): Promise<PhotoLikeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { photoId } = parsed.data;

  return db.transaction(async (tx): Promise<PhotoLikeResult> => {
    const [target] = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.status, "live")))
      .limit(1);
    if (!target) return { ok: false, error: "invalid" };

    const mine = and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, user.id));
    const [existing] = await tx.select({ id: photoLikes.photoId }).from(photoLikes).where(mine).limit(1);

    let liked: boolean;
    if (existing) {
      await tx.delete(photoLikes).where(mine);
      liked = false;
    } else {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(photoLikes)
        .where(
          and(eq(photoLikes.userId, user.id), gt(photoLikes.createdAt, sql`now() - interval '1 hour'`)),
        );
      if (n >= HOURLY_LIMIT) return { ok: false, error: "limit" };
      await tx.insert(photoLikes).values({ photoId, userId: user.id }).onConflictDoNothing();
      liked = true;
    }

    const [{ likeCount }] = await tx
      .select({ likeCount: photos.likeCount })
      .from(photos)
      .where(eq(photos.id, photoId));
    return { ok: true, liked, count: likeCount };
  });
}
