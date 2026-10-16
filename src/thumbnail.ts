import exifr from "exifr";

const SIZE = 120;
const cache = new WeakMap<File, Promise<string | undefined>>();

/**
 * Small object URL for a picture: the JPEG thumbnail embedded in the EXIF
 * data (fast, no decoding), else the picture scaled down.
 */
export function thumbnail(file: File): Promise<string | undefined> {
  let url = cache.get(file);
  if (!url) {
    url = create(file).catch(() => undefined);
    cache.set(file, url);
  }
  return url;
}

async function create(file: File): Promise<string | undefined> {
  if (file.type === "image/svg+xml") return URL.createObjectURL(file);
  const embedded = await exifr.thumbnail(file).catch(() => undefined);
  if (embedded) return URL.createObjectURL(new Blob([embedded as BlobPart]));
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg" });
  return URL.createObjectURL(blob);
}
