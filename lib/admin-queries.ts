import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { pandals, photos, profiles, reports } from "@/db/schema";
import { REPORT_REASONS } from "./report-reasons";
import { photoUrl } from "./r2";

export type ContentStatus = "live" | "hidden" | "removed";

/**
 * One row in the moderation queue: a pandal or a single photo, with
 * everything an admin needs to decide without leaving the page.
 */
export type ReportTarget = {
  kind: "pandal" | "photo";
  /** pandalId or photoId, whichever `kind` says. */
  id: string;
  /** Always the pandal, so the card can deep-link to it. */
  pandalId: string;
  title: string;
  subtitle: string;
  thumb: string | null;
  status: ContentStatus;
  addedBy: string | null;
  claimedBy: string | null;
  /** Human labels with a count each, most common first. */
  reasons: { label: string; count: number }[];
  reporters: string[];
  /** Newest open report, or the row's own update time for a hidden target. */
  at: string;
};

async function pandalSummaries(ids: string[]) {
  if (ids.length === 0) return new Map<string, Awaited<ReturnType<typeof loadPandals>>[number]>();
  const rows = await loadPandals(ids);
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadPandals(ids: string[]) {
  const claimant = alias(profiles, "claimant");
  const rows = await db
    .select({
      id: pandals.id,
      name: pandals.name,
      gully: pandals.gully,
      area: pandals.area,
      status: pandals.status,
      updatedAt: pandals.updatedAt,
      addedBy: profiles.displayName,
      claimedBy: claimant.displayName,
    })
    .from(pandals)
    .leftJoin(profiles, eq(pandals.submittedBy, profiles.id))
    .leftJoin(claimant, eq(pandals.claimedBy, claimant.id))
    .where(inArray(pandals.id, ids));

  // Cover photo per pandal: the oldest live one, same rule as the map.
  const covers = await db
    .select({ pandalId: photos.pandalId, r2Key: photos.r2Key, posterKey: photos.posterKey })
    .from(photos)
    .where(and(inArray(photos.pandalId, ids), eq(photos.status, "live")))
    .orderBy(asc(photos.createdAt));
  const cover = new Map<string, string>();
  for (const c of covers) if (!cover.has(c.pandalId)) cover.set(c.pandalId, photoUrl(c.posterKey ?? c.r2Key));

  return rows.map((r) => ({ ...r, thumb: cover.get(r.id) ?? null }));
}

async function loadPhotos(ids: string[]) {
  if (ids.length === 0) return new Map<string, { id: string; pandalId: string; r2Key: string; posterKey: string | null; status: ContentStatus; createdAt: Date }>();
  const rows = await db
    .select({
      id: photos.id,
      pandalId: photos.pandalId,
      r2Key: photos.r2Key,
      posterKey: photos.posterKey,
      status: photos.status,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(inArray(photos.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

function tally(reasons: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      label: (REPORT_REASONS as Record<string, string>)[key] ?? key,
      count,
    }));
}

/**
 * The queue: every target with an open report, grouped, newest first; then
 * anything hidden that has no open report (auto-hides that were already
 * dismissed, or hand-hidden rows) so it can be brought back.
 */
export async function getModerationQueue(): Promise<{ open: ReportTarget[]; hidden: ReportTarget[] }> {
  const openReports = await db
    .select({
      pandalId: reports.pandalId,
      photoId: reports.photoId,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reporter: profiles.displayName,
    })
    .from(reports)
    .leftJoin(profiles, eq(reports.reporterId, profiles.id))
    .where(isNull(reports.resolvedAt))
    .orderBy(desc(reports.createdAt));

  const hiddenPandals = await db
    .select({ id: pandals.id })
    .from(pandals)
    .where(eq(pandals.status, "hidden"))
    .orderBy(desc(pandals.updatedAt))
    .limit(50);
  const hiddenPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.status, "hidden"))
    .orderBy(desc(photos.createdAt))
    .limit(50);

  const photoIds = new Set<string>();
  for (const r of openReports) if (r.photoId) photoIds.add(r.photoId);
  for (const p of hiddenPhotos) photoIds.add(p.id);
  const photoMap = await loadPhotos([...photoIds]);

  const pandalIds = new Set<string>();
  for (const r of openReports) if (r.pandalId) pandalIds.add(r.pandalId);
  for (const p of hiddenPandals) pandalIds.add(p.id);
  for (const p of photoMap.values()) pandalIds.add(p.pandalId);
  const pandalMap = await pandalSummaries([...pandalIds]);

  // Group open reports by target.
  type Group = { reasons: string[]; reporters: string[]; at: Date };
  const groups = new Map<string, Group>();
  for (const r of openReports) {
    const key = r.photoId ? `photo:${r.photoId}` : `pandal:${r.pandalId}`;
    const g = groups.get(key) ?? { reasons: [], reporters: [], at: r.createdAt };
    g.reasons.push(r.reason);
    if (r.reporter && !g.reporters.includes(r.reporter)) g.reporters.push(r.reporter);
    if (r.createdAt > g.at) g.at = r.createdAt;
    groups.set(key, g);
  }

  function target(key: string, g: Group | null): ReportTarget | null {
    const [kind, id] = key.split(":") as ["pandal" | "photo", string];
    if (kind === "photo") {
      const ph = photoMap.get(id);
      const pd = ph && pandalMap.get(ph.pandalId);
      if (!ph || !pd) return null;
      return {
        kind, id, pandalId: pd.id,
        title: `Photo on ${pd.name}`,
        subtitle: `${pd.gully}, ${pd.area}`,
        thumb: photoUrl(ph.posterKey ?? ph.r2Key),
        status: ph.status,
        addedBy: pd.addedBy,
        claimedBy: pd.claimedBy,
        reasons: tally(g?.reasons ?? []),
        reporters: g?.reporters ?? [],
        at: (g?.at ?? ph.createdAt).toISOString(),
      };
    }
    const pd = pandalMap.get(id);
    if (!pd) return null;
    return {
      kind, id, pandalId: pd.id,
      title: pd.name,
      subtitle: `${pd.gully}, ${pd.area}`,
      thumb: pd.thumb,
      status: pd.status,
      addedBy: pd.addedBy,
      claimedBy: pd.claimedBy,
      reasons: tally(g?.reasons ?? []),
      reporters: g?.reporters ?? [],
      at: (g?.at ?? pd.updatedAt).toISOString(),
    };
  }

  const open: ReportTarget[] = [];
  for (const [key, g] of groups) {
    const t = target(key, g);
    if (t) open.push(t);
  }
  open.sort((a, b) => b.at.localeCompare(a.at));

  const hidden: ReportTarget[] = [];
  for (const p of hiddenPandals) {
    const key = `pandal:${p.id}`;
    if (groups.has(key)) continue;
    const t = target(key, null);
    if (t) hidden.push(t);
  }
  for (const p of hiddenPhotos) {
    const key = `photo:${p.id}`;
    if (groups.has(key)) continue;
    const t = target(key, null);
    if (t) hidden.push(t);
  }
  hidden.sort((a, b) => b.at.localeCompare(a.at));

  return { open, hidden };
}
