"use server";

import { and, countDistinct, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pandals, photos, reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  PHOTO_REPORT_REASONS,
  REPORT_REASONS,
  type PhotoReportReason,
  type ReportReason,
} from "@/lib/report-reasons";

/** Distinct reporters at which a target hides itself, pending review. */
const AUTO_HIDE_AT = 3;

const reasonEnum = z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]);
const photoReasonEnum = z.enum(
  Object.keys(PHOTO_REPORT_REASONS) as [PhotoReportReason, ...PhotoReportReason[]],
);

export type ReportResult = { ok: true; hidden: boolean } | { ok: false; error: "signin" | "invalid" };

/**
 * Postgres unique-violation: this user already has an open report here.
 * drizzle-orm 0.45 wraps driver errors in DrizzleQueryError, so the code
 * lives on `cause`; the bare check stays for a driver that doesn't wrap.
 */
function isDuplicate(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

/**
 * Records a report against a pandal or a single photo and hides the target
 * once enough distinct people have said so. A repeat report from the same
 * person hits the partial unique index and is treated as already counted —
 * there's nothing useful to tell them.
 */
async function fileReport(
  target: { pandalId: string } | { photoId: string },
  reason: string,
  reporterId: string,
): Promise<boolean> {
  const isPandal = "pandalId" in target;
  const where = isPandal
    ? and(eq(reports.pandalId, target.pandalId), isNull(reports.resolvedAt))
    : and(eq(reports.photoId, target.photoId), isNull(reports.resolvedAt));

  try {
    return await db.transaction(async (tx) => {
      await tx.insert(reports).values({ ...target, reporterId, reason });
      const [{ n }] = await tx
        .select({ n: countDistinct(reports.reporterId) })
        .from(reports)
        .where(where);
      if (n < AUTO_HIDE_AT) return false;
      if (isPandal) {
        await tx
          .update(pandals)
          .set({ status: "hidden" })
          .where(and(eq(pandals.id, target.pandalId), eq(pandals.status, "live")));
      } else {
        await tx
          .update(photos)
          .set({ status: "hidden" })
          .where(and(eq(photos.id, target.photoId), eq(photos.status, "live")));
      }
      return true;
    });
  } catch (err) {
    if (isDuplicate(err)) return false;
    throw err;
  }
}

export async function reportPandal(raw: unknown): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = z.object({ pandalId: z.string().uuid(), reason: reasonEnum }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const hidden = await fileReport({ pandalId: parsed.data.pandalId }, parsed.data.reason, user.id);
  if (hidden) revalidatePath("/");
  return { ok: true, hidden };
}

export async function reportPhoto(raw: unknown): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const parsed = z.object({ photoId: z.string().uuid(), reason: photoReasonEnum }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const hidden = await fileReport({ photoId: parsed.data.photoId }, parsed.data.reason, user.id);
  if (hidden) revalidatePath("/");
  return { ok: true, hidden };
}
