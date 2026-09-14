import "server-only";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PHOTO_CONTENT_TYPE } from "./validation";

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

/** Largest upload we accept. The client resizes to well under this. */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

/**
 * A short-lived URL the browser can PUT one JPEG to. The key is ours, not
 * the client's, so a user can only ever write under their own prefix.
 */
export async function presignPhotoUpload(key: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: key,
    ContentType: PHOTO_CONTENT_TYPE,
  });
  return getSignedUrl(r2(), cmd, { expiresIn: 600 });
}

/**
 * Confirms an upload actually landed and is a JPEG of sane size before a
 * photo row points at it. A presigned URL cannot enforce a size cap, so
 * this is the check.
 */
export async function verifyUploadedPhoto(key: string): Promise<boolean> {
  try {
    const head = await r2().send(
      new HeadObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }),
    );
    return (
      head.ContentType === PHOTO_CONTENT_TYPE &&
      (head.ContentLength ?? Infinity) <= MAX_PHOTO_BYTES
    );
  } catch {
    return false;
  }
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
