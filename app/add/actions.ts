"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pandals, photos } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { presignPhotoUpload, verifyUploadedPhoto } from "@/lib/r2-server";
import { MAX_PHOTOS, pandalInput } from "@/lib/validation";

export type UploadSlot = { key: string; url: string };

/**
 * One presigned PUT per photo the user picked. Keys are namespaced by user
 * so nothing a client sends can name someone else's object.
 */
export async function requestUploadUrls(count: number): Promise<UploadSlot[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to add photos");
  const n = Math.min(Math.max(Math.floor(count), 1), MAX_PHOTOS);
  return Promise.all(
    Array.from({ length: n }, async () => {
      const key = `pandals/${user.id}/${randomUUID()}.jpg`;
      return { key, url: await presignPhotoUpload(key) };
    }),
  );
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export async function createPandal(raw: unknown): Promise<CreateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to add a mandapam" };

  const parsed = pandalInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const input = parsed.data;

  // Every key must be under this user's prefix and actually uploaded.
  const prefix = `pandals/${user.id}/`;
  for (const p of input.photos) {
    if (!p.key.startsWith(prefix)) return { ok: false, error: "Bad photo reference" };
    if (!(await verifyUploadedPhoto(p.key))) {
      return { ok: false, error: "A photo didn't finish uploading. Try again." };
    }
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(pandals)
      .values({
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
        submittedBy: user.id,
      })
      .returning({ id: pandals.id });
    await tx.insert(photos).values(
      input.photos.map((p, i) => ({
        pandalId: row.id,
        r2Key: p.key,
        width: p.width,
        height: p.height,
        uploadedBy: user.id,
        isPin: i === input.pinIndex,
      })),
    );
    return row.id;
  });

  revalidatePath("/");
  return { ok: true, id };
}
