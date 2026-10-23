/**
 * Krok ciężaru per ćwiczenie / sprzęt — wspólny dla dokładek i deloadu.
 *
 * - `stepKg`    — standardowa dokładka (najmniejszy „normalny” skok).
 * - `minStepKg` — najmniejszy skok, jaki da się załadować (mikro-talerze
 *   na sztandze; hantle, maszyny i kettlebelle nie schodzą poniżej `stepKg`).
 *
 * Jawna wartość ćwiczenia (`weightStepKg`) ma pierwszeństwo przed
 * heurystyką po nazwie.
 */

export type WeightStep = {
  stepKg: number;
  minStepKg: number;
};

export const DEFAULT_STEP_KG = 2.5;
export const DEFAULT_MIN_STEP_KG = 1.25;

export const DEFAULT_WEIGHT_STEP: WeightStep = {
  stepKg: DEFAULT_STEP_KG,
  minStepKg: DEFAULT_MIN_STEP_KG,
};

const MIN_EXPLICIT_STEP = 0.25;
const MAX_EXPLICIT_STEP = 20;

function norm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

const KETTLEBELL_RE = /kettlebell|kettle|kula|kettlebel/;
const DUMBBELL_RE = /hantl|dumbbell|\bdb\b/;
const MACHINE_RE =
  /maszyn|machine|wyciag|cable|pulley|smith|pec.?deck|leg.?press|hack.?squat|lat.?pulldown|sciagani|suwnic/;

export function sanitizeExplicitStepKg(
  v: number | null | undefined,
): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (v < MIN_EXPLICIT_STEP || v > MAX_EXPLICIT_STEP) return null;
  return Math.round(v * 100) / 100;
}

/**
 * Krok ciężaru: jawny > heurystyka sprzętu po nazwie > domyślny (sztanga/talerze).
 */
export function resolveWeightStep(args: {
  name?: string | null;
  explicitStepKg?: number | null;
}): WeightStep {
  const explicit = sanitizeExplicitStepKg(args.explicitStepKg);
  if (explicit != null) return { stepKg: explicit, minStepKg: explicit };

  const n = norm(args.name ?? "");
  if (!n) return DEFAULT_WEIGHT_STEP;

  if (KETTLEBELL_RE.test(n)) return { stepKg: 4, minStepKg: 4 };
  if (DUMBBELL_RE.test(n)) return { stepKg: 2, minStepKg: 2 };
  if (MACHINE_RE.test(n)) return { stepKg: 2.5, minStepKg: 2.5 };
  return DEFAULT_WEIGHT_STEP;
}

/** Zaokrąglenie do 2 miejsc (kroki 1,25 / 0,25 nie mogą zniknąć). */
export function round2(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return Math.round(kg * 100) / 100;
}

/**
 * Ciężar „utrzymaj”: czyści szum zmiennoprzecinkowy, zostawia kroki do 0,25 kg.
 */
export function roundHoldKg(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg * 4) / 4;
}
