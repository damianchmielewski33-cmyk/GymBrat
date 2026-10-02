/**
 * Przygotowuje plik logo/ikony do uploadu:
 * - SVG bez zmian (data URL),
 * - bitmapy → max bok 1024 px, WebP/JPEG ~0.85 (mniejsze body JSON).
 */
export async function prepareBrandingUploadDataUrl(file: File): Promise<string> {
  const type = (file.type || "").toLowerCase();
  if (type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return readAsDataUrl(file);
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dataUrl = await rasterToDataUrl(bitmap, bitmap.width, bitmap.height);
      bitmap.close?.();
      return dataUrl;
    } catch {
      /* fall through */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return await rasterToDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Nie udało się odczytać pliku."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Nie udało się odczytać pliku."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nieobsługiwany format obrazu."));
    img.src = src;
  });
}

async function rasterToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<string> {
  const maxSide = 1024;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak canvas.");
  ctx.drawImage(source, 0, 0, tw, th);

  const webp = canvas.toDataURL("image/webp", 0.85);
  if (webp.startsWith("data:image/webp") && webp.length < 1_400_000) return webp;

  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  if (jpeg.length < 1_400_000) return jpeg;

  const png = canvas.toDataURL("image/png");
  if (png.length > 1_500_000) {
    throw new Error("Plik jest za duży nawet po kompresji — użyj mniejszego logo.");
  }
  return png;
}
