"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pandals, photos } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { thumbKey } from "@/lib/r2";
import { presignUpload, verifyOwnUploads, type UploadContentType } from "@/lib/r2-server";
import { MAX_PHOTOS, PHOTO_CONTENT_TYPE, VIDEO_CONTENT_TYPES, pandalInput } from "@/lib/validation";

/** A JPEG slot also carries the PUT for its 320px thumb. */
export type UploadSlot = { key: string; url: string; thumb?: { key: string; url: string } };

const EXT: Record<UploadContentType, string> = {
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * One presigned PUT per object the user is about to send — a photo, a video,
 * or a video's poster frame — each signed for exactly the type it will be.
 * Every JPEG gets a second URL for the thumb the client cuts beside it.
 * Keys are namespaced by user so nothing a client sends can name someone
 * else's object.
 */
export async function requestUploadUrls(types: string[]): Promise<UploadSlot[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to add photos");
  // A video and its poster are two objects, so twice the slot count.
  const wanted = types.slice(0, MAX_PHOTOS * 2);
  return Promise.all(
    wanted.map(async (t) => {
      const type = ([PHOTO_CONTENT_TYPE, ...VIDEO_CONTENT_TYPES] as string[]).includes(t)
        ? (t as UploadContentType)
        : PHOTO_CONTENT_TYPE;
      const key = `pandals/${user.id}/${randomUUID()}.${EXT[type]}`;
      const slot: UploadSlot = { key, url: await presignUpload(key, type) };
      if (type === PHOTO_CONTENT_TYPE) {
        const tk = thumbKey(key);
        slot.thumb = { key: tk, url: await presignUpload(tk, type) };
      }
      return slot;
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

  const bad = await verifyOwnUploads(user.id, input.photos);
  if (bad) return { ok: false, error: bad };

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
        description: input.description,
        annadhanamDate: input.annadhanamDate,
        visarjanDay: input.visarjanDay,
        location: { x: input.lng, y: input.lat },
        submittedBy: user.id,
      })
      .returning({ id: pandals.id });
    await tx.insert(photos).values(
      input.photos.map((p, i) => ({
        pandalId: row.id,
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
    return row.id;
  });

  revalidatePath("/");
  return { ok: true, id };
}
