import "server-only";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { moryas, visits } from "@/db/schema";
import { FESTIVAL_DAYS, FESTIVAL_START, type Pandal } from "./pandals";
import { getLivePandals } from "./queries";

const DAY_MS = 86_400_000;

/** A pandal with the number that earned it a place on the list. */
export type Ranked = { pandal: Pandal; value: number };

export type Records = {
  /** Festival day the page was built on; 0 before the festival. */
  festivalDay: number;
  tallest: Ranked[];
  smallest: Ranked[];
  mostLoved: Ranked[];
  risingToday: Ranked[];
  mostVisitedToday: Ranked[];
  /** One winner per area, most loved first. */
  byArea: { area: string; pandal: Pandal }[];
  oldest: Ranked[];
  clay: Pandal[];
};

/**
 * Everything on /top, from one pass over the live set plus two "today"
 * queries that the cached page can't carry. Cheap at city scale — the whole
 * festival is a few thousand rows — so no denormalised "today" counters.
 */
export async function getRecords(): Promise<Records> {
  const all = await getLivePandals();
  const now = Date.now();
  const day = Math.floor((now - FESTIVAL_START.getTime()) / DAY_MS) + 1;
  const festivalDay = day >= 1 && day <= FESTIVAL_DAYS ? day : 0;
  const todayStart = new Date(FESTIVAL_START.getTime() + Math.max(0, day - 1) * DAY_MS);

  const byId = new Map(all.map((p) => [p.id, p]));
  const rank = (rows: { id: string; n: number }[]): Ranked[] =>
    rows.flatMap(({ id, n }) => {
      const pandal = byId.get(id);
      return pandal && n > 0 ? [{ pandal, value: n }] : [];
    });

  const [risingRows, visitedRows] = await Promise.all([
    db
      .select({ id: moryas.pandalId, n: count() })
      .from(moryas)
      .where(and(gt(moryas.createdAt, todayStart), sql`${moryas.weight} > 0`))
      .groupBy(moryas.pandalId)
      .orderBy(desc(count()))
      .limit(5),
    festivalDay
      ? db
          .select({ id: visits.pandalId, n: count() })
          .from(visits)
          .where(eq(visits.festivalDay, festivalDay))
          .groupBy(visits.pandalId)
          .orderBy(desc(count()))
          .limit(5)
      : Promise.resolve([]),
  ]);

  const withHeight = all.filter((p) => p.heightFt !== null);
  const tallest = [...withHeight]
    .sort((a, b) => b.heightFt! - a.heightFt!)
    .slice(0, 10)
    .map((p) => ({ pandal: p, value: p.heightFt! }));
  // The inverse award, and the on-brand one: no landmarks, no giants.
  const smallest = withHeight
    .filter((p) => !p.landmark)
    .sort((a, b) => a.heightFt! - b.heightFt!)
    .slice(0, 5)
    .map((p) => ({ pandal: p, value: p.heightFt! }));
  const mostLoved = [...all]
    .filter((p) => p.moryaCount > 0)
    .sort((a, b) => b.moryaCount - a.moryaCount)
    .slice(0, 10)
    .map((p) => ({ pandal: p, value: p.moryaCount }));

  const areaBest = new Map<string, Pandal>();
  for (const p of mostLoved.map((r) => r.pandal)) {
    const key = p.area.trim().toLowerCase();
    if (!areaBest.has(key)) areaBest.set(key, p);
  }
  const byArea = [...areaBest.values()].map((pandal) => ({ area: pandal.area, pandal }));

  const oldest = all
    .filter((p) => p.establishedYear !== null)
    .sort((a, b) => a.establishedYear! - b.establishedYear!)
    .slice(0, 5)
    .map((p) => ({ pandal: p, value: p.establishedYear! }));
  const clay = all.filter((p) => p.ecoFriendly).sort((a, b) => b.moryaCount - a.moryaCount);

  return {
    festivalDay,
    tallest,
    smallest,
    mostLoved,
    risingToday: rank(risingRows),
    mostVisitedToday: rank(visitedRows),
    byArea,
    oldest,
    clay,
  };
}
