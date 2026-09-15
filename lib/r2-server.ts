import "server-only";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MAX_VIDEO_BYTES,
  PHOTO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPES,
  type VideoContentType,
} from "./validation";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let client: S3Client | undefined;
function r2() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

/** Largest photo we accept. The client resizes to well under this. */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export type UploadContentType = typeof PHOTO_CONTENT_TYPE | VideoContentType;

/**
 * A short-lived URL the browser can PUT one object to, of exactly the
 * content type signed here — a different type is a signature mismatch and
 * R2 refuses it. The key is ours, not the client's, so a user can only ever
 * write under their own prefix.
 */
export async function presignUpload(key: string, contentType: UploadContentType): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2(), cmd, { expiresIn: 600 });
}

/**
 * Confirms an upload actually landed, is the kind of thing it claims to be,
 * and is of sane size before a row points at it. A presigned URL cannot
 * enforce a size cap, so this is the check.
 */
export async function verifyUpload(key: string, kind: "photo" | "video"): Promise<boolean> {
  try {
    const head = await r2().send(
      new HeadObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }),
    );
    const size = head.ContentLength ?? Infinity;
    if (kind === "photo") return head.ContentType === PHOTO_CONTENT_TYPE && size <= MAX_PHOTO_BYTES;
    return (
      (VIDEO_CONTENT_TYPES as readonly string[]).includes(head.ContentType ?? "") &&
      size <= MAX_VIDEO_BYTES
    );
  } catch {
    return false;
  }
}

/**
 * Every key must sit under this user's prefix and actually have been
 * uploaded as what it claims to be — a video's poster included. Returns the
 * message to show, or null when everything checks out.
 */
export async function verifyOwnUploads(
  userId: string,
  media: { key: string; kind: "photo" | "video"; posterKey?: string }[],
): Promise<string | null> {
  const prefix = `pandals/${userId}/`;
  for (const m of media) {
    const keys: [string, "photo" | "video"][] = [[m.key, m.kind]];
    if (m.kind === "video" && m.posterKey) keys.push([m.posterKey, "photo"]);
    for (const [key, kind] of keys) {
      if (!key.startsWith(prefix)) return "Bad photo reference";
      if (!(await verifyUpload(key, kind))) return "A photo didn't finish uploading. Try again.";
    }
  }
  return null;
}

/**
 * Purges a photo the moment its row goes `removed`. Best-effort: the row is
 * already gone from every query, so a failed delete only costs storage. The
 * caller logs and moves on rather than failing the user's edit.
 */
export async function deletePhotoObject(key: string): Promise<void> {
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }));
  } catch (err) {
    console.error("[r2] delete failed for", key, err);
  }
}
