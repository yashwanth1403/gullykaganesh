"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pandals, visits } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { FESTIVAL_DAYS, FESTIVAL_START } from "@/lib/pandals";

/**
 * How close the phone must be to the pin. Wide enough for a queue that
 * snakes down the road and for a mis-dropped pin; tight enough that you
 * cannot check in from home.
 */
const FENCE_M = 300;

const input = z.object({
  pandalId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type CheckInResult =
  | { ok: true; count: number; distanceM: number }
  | { ok: false; error: "signin" | "invalid" | "far" | "done" | "outside"; distanceM?: number };

/** The festival day for a moment in time, or null outside the festival. */
function festivalDayAt(now: number): number | null {
  const day = Math.floor((now - FESTIVAL_START.getTime()) / 86_400_000) + 1;
  return day >= 1 && day <= FESTIVAL_DAYS ? day : null;
}

/**
 * "Darshan done." The distance is measured here, from the coordinates the
 * phone sent — spoofable with effort, but it turns a free tap into a chore,
 * which is all a leaderboard needs. One per user per pandal per day.
 */
export async function checkIn(raw: unknown): Promise<CheckInResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { pandalId, lat, lng } = parsed.data;

  const festivalDay = festivalDayAt(Date.now());
  if (festivalDay === null) return { ok: false, error: "outside" };

  // Geography, not geometry, so the distance comes back in metres.
  const here = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  const [target] = await db
    .select({ distanceM: sql<number>`round(ST_Distance(${pandals.location}::geography, ${here}))::int` })
    .from(pandals)
    .where(and(eq(pandals.id, pandalId), eq(pandals.status, "live")))
    .limit(1);
  if (!target) return { ok: false, error: "invalid" };
  if (target.distanceM > FENCE_M) return { ok: false, error: "far", distanceM: target.distanceM };

  const inserted = await db
    .insert(visits)
    .values({ pandalId, userId: user.id, festivalDay, distanceM: target.distanceM })
    .onConflictDoNothing()
    .returning({ pandalId: visits.pandalId });
  if (inserted.length === 0) return { ok: false, error: "done", distanceM: target.distanceM };

  const [{ visitCount }] = await db
    .select({ visitCount: pandals.visitCount })
    .from(pandals)
    .where(eq(pandals.id, pandalId));
  return { ok: true, count: visitCount, distanceM: target.distanceM };
}
