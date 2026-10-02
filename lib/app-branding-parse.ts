/** ~600 KB data URL — ikony/logo, nie pełne zdjęcia. */
export const BRANDING_MAX_DATA_URL_CHARS = 800_000;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; dataUrl: string } | null {
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mimeType = m[1]!.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) return null;
  if (dataUrl.length > BRANDING_MAX_DATA_URL_CHARS) return null;
  return { mimeType, dataUrl: dataUrl.trim() };
}

/** Rozpakowuje data URL do bufora (serwowanie assetu). */
export function dataUrlToBuffer(
  dataUrl: string,
): { mimeType: string; body: Buffer } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return {
      mimeType: m[1]!.trim().toLowerCase(),
      body: Buffer.from(m[2]!.replace(/\s/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}
