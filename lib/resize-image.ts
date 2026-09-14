/**
 * Shrinks a phone photo to a web-sized JPEG before upload. Camera originals
 * are 3–8 MB; at 1600px on the long edge they are ~250 KB and still fill a
 * phone screen. `imageOrientation: "from-image"` bakes in EXIF rotation so a
 * portrait shot does not upload sideways.
 */
export type ResizedPhoto = { blob: Blob; width: number; height: number; previewUrl: string };

const MAX_EDGE = 1600;

export async function resizeImage(file: File): Promise<ResizedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("Could not encode photo");
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}
