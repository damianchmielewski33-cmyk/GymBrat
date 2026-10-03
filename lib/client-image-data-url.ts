/** Kompresja zdjęcia do data URL (JPEG) pod limity API. */

async function fileToResizedDataUrl(
  file: File,
  opts: { maxSide: number; quality: number },
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const max = Math.max(width, height);
  const scale = max > opts.maxSide ? opts.maxSide / max : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Brak canvas context");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", opts.quality);
}

/** Kompresja pod limit zapisu (~1.2M znaków). */
export async function fileToCompressedImageDataUrl(file: File): Promise<string> {
  const attempts = [
    { maxSide: 960, quality: 0.72 },
    { maxSide: 720, quality: 0.62 },
    { maxSide: 560, quality: 0.55 },
  ];
  let last = "";
  for (const opts of attempts) {
    last = await fileToResizedDataUrl(file, opts);
    if (last.length <= 1_200_000) return last;
  }
  return last;
}
