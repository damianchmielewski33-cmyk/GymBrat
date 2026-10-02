/** Max długość data URL po kompresji (~1.2 MB pliku base64). */
export const BRANDING_MAX_DATA_URL_CHARS = 1_600_000;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function normalizeMime(raw: string): string {
  const m = raw.trim().toLowerCase().split(";")[0]!.trim();
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  if (m === "image/x-png") return "image/png";
  return m;
}

/**
 * Akceptuje data URL z FileReader:
 * - `data:image/png;base64,...`
 * - `data:image/svg+xml;charset=utf-8,...` (bez base64)
 * Zawsze zwraca znormalizowany `data:<mime>;base64,...`.
 */
export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; dataUrl: string } | null {
  const raw = dataUrl.trim();
  const m = /^data:([^,]+),([\s\S]*)$/i.exec(raw);
  if (!m) return null;

  const meta = m[1]!.trim();
  const payload = m[2]!;
  const parts = meta.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const mimeType = normalizeMime(parts[0]!);
  if (!ALLOWED_MIME.has(mimeType)) return null;

  const isBase64 = parts.some((p) => p.toLowerCase() === "base64");
  let base64: string;

  if (isBase64) {
    base64 = payload.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64) || base64.length < 8) return null;
  } else {
    // SVG / tekstowy data URL z FileReader
    if (mimeType !== "image/svg+xml") return null;
    try {
      const decoded = decodeURIComponent(payload);
      base64 = Buffer.from(decoded, "utf8").toString("base64");
    } catch {
      try {
        base64 = Buffer.from(payload, "utf8").toString("base64");
      } catch {
        return null;
      }
    }
  }

  const normalized = `data:${mimeType};base64,${base64}`;
  if (normalized.length > BRANDING_MAX_DATA_URL_CHARS) return null;
  return { mimeType, dataUrl: normalized };
}

/** Rozpakowuje data URL do bufora (serwowanie assetu). */
export function dataUrlToBuffer(
  dataUrl: string,
): { mimeType: string; body: Buffer } | null {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const m = /^data:[^;]+;base64,(.+)$/i.exec(parsed.dataUrl);
  if (!m) return null;
  try {
    return {
      mimeType: parsed.mimeType,
      body: Buffer.from(m[1]!.replace(/\s/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}
