export const MAX_PHOTOS = 3;
export const MAX_VIDEO_MB = 30;

/** Downscale a photo to a small JPEG data URL so it can travel with the report. */
export async function compressPhoto(file: File, maxSide = 900, quality = 0.65): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
