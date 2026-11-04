"use client";


export type BodyReportFieldHints = {
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  thighCm?: number | null;
  armCm?: number | null;
  dayEnergy?: number | null;
  trainingEnergy?: number | null;
  digestionScore?: number | null;
  sleepQuality?: number | null;
  cardioCompliance?: string | null;
  dietCompliance?: string | null;
  trainingCompliance?: string | null;
};

export function formatHintNumber(n: number | null | undefined, digits = 1): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const rounded = Number(n.toFixed(digits));
  return String(rounded).replace(".", ",");
}

export type PhotoSlot = "front" | "side" | "back";

export const PHOTO_SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: "front", label: "PRZÓD" },
  { key: "side", label: "BOK" },
  { key: "back", label: "TYŁ" },
];

export const TOTAL_STEPS = 5;

export const DRAFT_KEY = "gymbrat:body-report-draft:v1";

export type DraftPayload = {
  step: number;
  weightKg: string;
  waistCm: string;
  chestCm: string;
  thighCm: string;
  armCm: string;
  dayEnergy: number | null;
  trainingEnergy: number | null;
  digestionScore: number | null;
  sleepQuality: number | null;
  cardioCompliance: "" | "tak" | "nie";
  dietCompliance: "" | "tak" | "nie";
  trainingCompliance: "" | "tak" | "nie";
  complianceNotes: string;
  additionalInfo: string;
  /** Zdjęcia w draftcie pomijamy (za duże na sessionStorage). */
};

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
  if (!ctx) throw new Error("Brak canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", opts.quality);
}

/** Kompresja pod limit API (~1.5M znaków na zdjęcie). */
export async function fileToReportPhotoDataUrl(file: File): Promise<string> {
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

export function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t || t === "." || t === ",") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}
