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

/** Walidacja kroku kreatora raportu: komunikat błędu albo `null`, gdy krok jest poprawny. */
export function validateReportStep(
  s: number,
  v: {
    weightKg: string; waistCm: string; thighCm: string; chestCm: string; armCm: string;
    dayEnergy: number | null; trainingEnergy: number | null; digestionScore: number | null; sleepQuality: number | null;
    cardioCompliance: string; dietCompliance: string; trainingCompliance: string; complianceNotes: string;
    slotPhotos: Record<PhotoSlot, string | null>; photosConsent: boolean;
  },
): string | null {
  const { weightKg, waistCm, thighCm, chestCm, armCm, dayEnergy, trainingEnergy, digestionScore, sleepQuality, cardioCompliance, dietCompliance, trainingCompliance, complianceNotes, slotPhotos, photosConsent } = v;
    if (s === 1) {
      const w = parseDecimal(weightKg);
      if (w == null || w <= 0) {
        return "Podaj wagę, to pole jest wymagane.";
      }
      const waist = parseDecimal(waistCm);
      const thigh = parseDecimal(thighCm);
      const chest = parseDecimal(chestCm);
      const arm = parseDecimal(armCm);
      if (waist == null || waist <= 0) {
        return "Podaj obwód pasa (cm).";
      }
      if (thigh == null || thigh <= 0) {
        return "Podaj obwód uda (cm).";
      }
      if (chest == null || chest <= 0) {
        return "Podaj obwód klatki (cm).";
      }
      if (arm == null || arm <= 0) {
        return "Podaj obwód ramienia (cm).";
      }
      return null;
    }
    if (s === 2) {
      if (
        dayEnergy == null ||
        trainingEnergy == null ||
        digestionScore == null ||
        sleepQuality == null
      ) {
        return "Kliknij kreski, wszystkie cztery skale wymagane.";
      }
      return null;
    }
    if (s === 3) {
      if (!cardioCompliance || !dietCompliance || !trainingCompliance) {
        return "Odpowiedz TAK lub NIE przy cardio, diecie i treningach.";
      }
      const anyNie =
        cardioCompliance === "nie" ||
        dietCompliance === "nie" ||
        trainingCompliance === "nie";
      if (anyNie && !complianceNotes.trim()) {
        return "Napisz, czego nie udało się zrealizować i w jakim zakresie.";
      }
      return null;
    }
    if (s === 4) {
      // Zdjęcia są opcjonalne; jeśli któreś dodano, potrzebna świadoma zgoda (art. 9 RODO).
      const hasAnyPhoto = PHOTO_SLOTS.some((slot) => Boolean(slotPhotos[slot.key]));
      if (hasAnyPhoto && !photosConsent) {
        return "Zaznacz zgodę na zapis zdjęć sylwetki albo usuń dodane zdjęcia.";
      }
      return null;
    }
    return null;
}
