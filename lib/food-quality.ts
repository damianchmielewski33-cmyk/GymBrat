import type { FoodProduct } from "@/lib/food-products-types";

/** Ocena jakościowa produktu: Nutri-Score (2023, produkty ogólne) liczony z danych na 100 g. */

export type NutriGrade = "A" | "B" | "C" | "D" | "E";

export type SaltLevel = "low" | "medium" | "high";

export type FoodQuality = {
  grade: NutriGrade;
  /** Licznik 0–100 (100 = najzdrowszy). */
  score: number;
  /** Czy wynik pochodzi z własnego wyliczenia czy z oceny Open Food Facts. */
  source: "computed" | "openfoodfacts";
  /** Brakowało części danych (np. cukry) — wynik przybliżony. */
  approximate: boolean;
  /** Pozytywy i negatywy do krótkiego opisu. */
  reasons: string[];
  novaGroup: 1 | 2 | 3 | 4 | null;
};

/** WHO: maks. ok. 5 g soli dziennie. */
export const SALT_DAILY_LIMIT_G = 5;

const KJ_PER_KCAL = 4.184;

function pointsFor(value: number, thresholds: readonly number[]): number {
  let p = 0;
  for (const t of thresholds) {
    if (value > t) p += 1;
  }
  return p;
}

const ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350] as const;
const SUGARS_G = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51] as const;
const SAT_FAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SALT_G = Array.from({ length: 20 }, (_, i) => Math.round((0.2 + i * 0.2) * 10) / 10);
const FIBER_G = [3.0, 4.1, 5.2, 6.3, 7.4] as const;
const PROTEIN_G = [2.4, 4.8, 7.2, 9.6, 12, 14, 17] as const;

export function gradeFromNutriScore(points: number): NutriGrade {
  if (points <= 0) return "A";
  if (points <= 2) return "B";
  if (points <= 10) return "C";
  if (points <= 18) return "D";
  return "E";
}

function scoreFromPoints(points: number): number {
  // Zakres punktów Nutri-Score: -15 (najlepiej) … 40 (najgorzej).
  const s = Math.round((100 * (40 - points)) / 55);
  return Math.min(100, Math.max(0, s));
}

const GRADE_SCORE: Record<NutriGrade, number> = { A: 90, B: 72, C: 50, D: 30, E: 10 };

function parseGrade(raw: string | undefined | null): NutriGrade | null {
  const g = (raw ?? "").trim().toUpperCase();
  return g === "A" || g === "B" || g === "C" || g === "D" || g === "E" ? g : null;
}

function parseNova(raw: unknown): 1 | 2 | 3 | 4 | null {
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

export { parseGrade as parseNutriGrade, parseNova as parseNovaGroup };

/**
 * Liczy ocenę z danych na 100 g. Zwraca null, gdy brak podstaw
 * (żaden z: cukry, tłuszcze nasycone, sól).
 */
export function computeFoodQuality(product: FoodProduct): FoodQuality | null {
  const d = product.details;
  const basis = product.basisAmount && product.basisAmount > 0 ? product.basisAmount : 100;
  const k = 100 / basis;
  const kcal100 = product.calories * k;
  const protein100 = product.proteinG * k;

  const sugars = d?.sugarsG ?? null;
  const sat = d?.saturatedFatG ?? null;
  const salt = d?.saltG ?? null;
  const fiber = d?.fiberG ?? null;

  const offGrade = parseGrade(product.nutriscoreGrade);
  const novaGroup = parseNova(product.novaGroup);

  const known = [sugars, sat, salt].filter((v) => v != null).length;
  if (known === 0) {
    if (!offGrade) return null;
    return {
      grade: offGrade,
      score: GRADE_SCORE[offGrade],
      source: "openfoodfacts",
      approximate: true,
      reasons: [],
      novaGroup,
    };
  }

  const negEnergy = pointsFor(kcal100 * KJ_PER_KCAL, ENERGY_KJ);
  const negSugars = pointsFor((sugars ?? 0) * k, SUGARS_G);
  const negSat = pointsFor((sat ?? 0) * k, SAT_FAT_G);
  const negSalt = pointsFor((salt ?? 0) * k, SALT_G);
  const negative = negEnergy + negSugars + negSat + negSalt;

  const posFiber = pointsFor((fiber ?? 0) * k, FIBER_G);
  const posProtein = pointsFor(protein100, PROTEIN_G);
  // Białko nie rekompensuje bardzo wysokiej liczby punktów ujemnych.
  const positive = posFiber + (negative >= 11 ? 0 : posProtein);

  const points = negative - positive;
  const computedGrade = gradeFromNutriScore(points);
  const grade = offGrade ?? computedGrade;
  const computedScore = scoreFromPoints(points);
  const score = offGrade && offGrade !== computedGrade ? GRADE_SCORE[offGrade] : computedScore;

  const reasons: string[] = [];
  if (negSugars >= 6) reasons.push("dużo cukrów");
  if (negSat >= 6) reasons.push("dużo tłuszczów nasyconych");
  if (negSalt >= 6) reasons.push("dużo soli");
  if (negEnergy >= 7) reasons.push("wysoka kaloryczność");
  if (posFiber >= 3) reasons.push("dużo błonnika");
  if (posProtein >= 5) reasons.push("dużo białka");

  return {
    grade,
    score,
    source: offGrade ? "openfoodfacts" : "computed",
    approximate: known < 3 || fiber == null,
    reasons,
    novaGroup,
  };
}

export type SaltInfo = {
  /** Sól w podanej porcji (g). */
  portionG: number;
  /** % dziennego limitu WHO (5 g). */
  dailyPct: number;
  /** Poziom soli na 100 g (progi: ≤0,3 niska, >1,5 wysoka). */
  level: SaltLevel;
  per100G: number;
};

/** Sól w porcji — null, gdy brak danych o soli/sodzie. */
export function computeSaltInfo(product: FoodProduct, effectiveGrams: number | null): SaltInfo | null {
  const per100 = product.details?.saltG;
  if (per100 == null || effectiveGrams == null || !Number.isFinite(effectiveGrams)) return null;
  const portionG = Math.round(((per100 * effectiveGrams) / 100) * 100) / 100;
  const level: SaltLevel = per100 <= 0.3 ? "low" : per100 > 1.5 ? "high" : "medium";
  return {
    portionG,
    dailyPct: Math.round((portionG / SALT_DAILY_LIMIT_G) * 100),
    level,
    per100G: per100,
  };
}

export const NOVA_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Nieprzetworzony",
  2: "Składnik kulinarny",
  3: "Przetworzony",
  4: "Wysoko przetworzony",
};
