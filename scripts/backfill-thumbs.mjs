/**
 * Cuts the 320px `.thumb.jpg` beside every JPEG already in the bucket —
 * photos and video posters uploaded before the client started making
 * thumbs itself. Idempotent: an object that already has a thumb is skipped,
 * so it is safe to run again after deploying.
 *
 *   set -a; . ./.env.local; set +a; node scripts/backfill-thumbs.mjs
 */
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const env = (n) => {
  if (!process.env[n]) throw new Error(`${n} is not set`);
  return process.env[n];
};
const Bucket = env("R2_BUCKET");
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
});

// Same numbers as lib/resize-image.ts, so old and new thumbs match.
const THUMB_EDGE = 320;
const QUALITY = 70;

const keys = new Set();
let ContinuationToken;
do {
  const page = await r2.send(new ListObjectsV2Command({ Bucket, Prefix: "pandals/", ContinuationToken }));
  for (const o of page.Contents ?? []) keys.add(o.Key);
  ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (ContinuationToken);

const todo = [...keys].filter((k) => k.endsWith(".jpg") && !k.endsWith(".thumb.jpg") && !keys.has(k.replace(/\.jpg$/, ".thumb.jpg")));
console.log(`${keys.size} objects, ${todo.length} thumbs to cut`);

let done = 0;
let failed = 0;
// A few at a time: each is a download + encode + upload.
const workers = Array.from({ length: 6 }, async () => {
  for (;;) {
    const key = todo.shift();
    if (!key) return;
    try {
      const obj = await r2.send(new GetObjectCommand({ Bucket, Key: key }));
      const src = Buffer.from(await obj.Body.transformToByteArray());
      const thumb = await sharp(src)
        .rotate()
        .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toBuffer();
      await r2.send(
        new PutObjectCommand({ Bucket, Key: key.replace(/\.jpg$/, ".thumb.jpg"), Body: thumb, ContentType: "image/jpeg" }),
      );
      done++;
      if (done % 25 === 0) console.log(`${done}/${done + todo.length + failed}`);
    } catch (err) {
      failed++;
      console.error("failed:", key, err?.message ?? err);
    }
  }
});
await Promise.all(workers);
console.log(`done: ${done} cut, ${failed} failed`);
