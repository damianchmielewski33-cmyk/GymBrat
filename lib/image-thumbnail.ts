import "server-only";

import sharp from "sharp";

/** Klucz miniatury obok obiektu zdjęcia w magazynie. */
export const thumbKeyFor = (objectKey: string): string => `${objectKey}.thumb`;

/** Miniatura (WebP, dłuższy bok ≤ `maxPx`) jako data URL; `null`, gdy wejście nie jest poprawnym obrazem. */
export async function makeThumbnailDataUrl(dataUrl: string, maxPx = 480): Promise<string | null> {
  const m = /^data:image\/(?:jpeg|png|webp);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    const buf = await sharp(Buffer.from(m[1]!, "base64"), { failOn: "none" })
      .rotate()
      .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
