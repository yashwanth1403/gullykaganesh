/**
 * Shrinks a phone photo to a web-sized JPEG before upload. Camera originals
 * are 3–8 MB; at 1600px on the long edge they are ~250 KB and still fill a
 * phone screen. `imageOrientation: "from-image"` bakes in EXIF rotation so a
 * portrait shot does not upload sideways.
 */
export type ResizedPhoto = { blob: Blob; thumb: Blob; width: number; height: number; previewUrl: string };

const MAX_EDGE = 1600;
/** Long edge of the thumb: a 160px pin at 2× is the biggest thing that uses it. */
const THUMB_EDGE = 320;

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Could not encode photo");
  return { blob, width, height };
}

export async function resizeImage(file: File): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const [full, thumb] = await Promise.all([encode(bitmap, MAX_EDGE, 0.82), encode(bitmap, THUMB_EDGE, 0.7)]);
  bitmap.close();
  return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, previewUrl: URL.createObjectURL(full.blob) };
}

/** The thumb of an already web-sized JPEG — a video's poster frame. */
export async function thumbOf(jpeg: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(jpeg);
  const { blob } = await encode(bitmap, THUMB_EDGE, 0.7);
  bitmap.close();
  return blob;
}
