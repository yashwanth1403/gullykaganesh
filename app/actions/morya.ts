"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { moryas, pandals, photoLikes, profiles, visits } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Taps per user per hour. Generous for a real person, tight for a script. */
const HOURLY_LIMIT = 60;
/** Accounts younger than this can tap, but their tap has weight 0. */
const MIN_ACCOUNT_AGE_MS = 10 * 60_000;

const input = z.object({ pandalId: z.string().uuid() });

export type MoryaResult =
  | { ok: true; said: boolean; count: number }
  | { ok: false; error: "signin" | "invalid" | "limit" };

/**
 * Toggle the viewer's "Morya" on a pandal. Deliberately does not call
 * `revalidatePath("/")` — the map page is ISR at 60s and a tap must not
 * regenerate it; the fresh count comes back in the result instead.
 */
export async function toggleMorya(raw: unknown): Promise<MoryaResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { pandalId } = parsed.data;

  return db.transaction(async (tx): Promise<MoryaResult> => {
    const [target] = await tx
      .select({ id: pandals.id })
      .from(pandals)
      .where(and(eq(pandals.id, pandalId), eq(pandals.status, "live")))
      .limit(1);
    if (!target) return { ok: false, error: "invalid" };

    const mine = and(eq(moryas.pandalId, pandalId), eq(moryas.userId, user.id));
    const [existing] = await tx.select({ w: moryas.weight }).from(moryas).where(mine).limit(1);

    let said: boolean;
    if (existing) {
      await tx.delete(moryas).where(mine);
      said = false;
    } else {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(moryas)
        .where(
          and(eq(moryas.userId, user.id), gt(moryas.createdAt, sql`now() - interval '1 hour'`)),
        );
      if (n >= HOURLY_LIMIT) return { ok: false, error: "limit" };

      const [profile] = await tx
        .select({ createdAt: profiles.createdAt })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);
      const ageMs = Date.now() - (profile?.createdAt.getTime() ?? 0);
      const weight = ageMs >= MIN_ACCOUNT_AGE_MS ? 1 : 0;

      await tx.insert(moryas).values({ pandalId, userId: user.id, weight }).onConflictDoNothing();
      said = true;
    }

    // The trigger has already resynced the count within this transaction.
    const [{ moryaCount }] = await tx
      .select({ moryaCount: pandals.moryaCount })
      .from(pandals)
      .where(eq(pandals.id, pandalId));
    return { ok: true, said, count: moryaCount };
  });
}

/** Everything this viewer has tapped, for painting buttons as already-pressed. */
export type MyMarks = {
  /** Pandal ids with a Morya. */
  moryas: string[];
  /** Pandal ids checked in at, any day — "you've done darshan here". */
  visits: string[];
  /** Photo ids with a heart. */
  likes: string[];
};

const NO_MARKS: MyMarks = { moryas: [], visits: [], likes: [] };

/** Empty when signed out. One round-trip; the three tables are all tiny per user. */
export async function getMyMarks(): Promise<MyMarks> {
  const user = await getCurrentUser();
  if (!user) return NO_MARKS;
  const [m, v, l] = await Promise.all([
    db.select({ id: moryas.pandalId }).from(moryas).where(eq(moryas.userId, user.id)),
    db.selectDistinct({ id: visits.pandalId }).from(visits).where(eq(visits.userId, user.id)),
    db.select({ id: photoLikes.photoId }).from(photoLikes).where(eq(photoLikes.userId, user.id)),
  ]);
  return { moryas: m.map((r) => r.id), visits: v.map((r) => r.id), likes: l.map((r) => r.id) };
}
