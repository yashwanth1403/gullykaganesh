/**
 * Public URL for an object in the R2 bucket.
 *
 * Safe to import from client code — it only reads the public base URL. The
 * S3 client that signs uploads lives in lib/r2-server.ts.
 */
const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");

export function photoUrl(key: string): string {
  if (!BASE) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not set");
  return `${BASE}/${key}`;
}
