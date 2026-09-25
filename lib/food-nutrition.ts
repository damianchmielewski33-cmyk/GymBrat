import type { FoodNutritionDetails, FoodProduct } from "@/lib/food-products-types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** WW — wymienniki węglowodanowe (1 WW ≈ 10 g węgli). */
export function carbohydrateExchanges(carbsG: number): number {
  return round1(carbsG / 10);
}

/** WBT — wymienniki białkowo-tłuszczowe ((B·4 + T·9) / 100). */
export function proteinFatExchanges(proteinG: number, fatG: number): number {
  return round1((proteinG * 4 + fatG * 9) / 100);
}

export type IngredientTagKind = "healthy" | "safe" | "harmful";

const HARMFUL = [
  "sól",
  "sol ",
  "salt",
  "cukier",
  "sugar",
  "syrop glukozowy",
  "syrop glukozowo",
  "olej palmowy",
  "e621",
  "msg",
];

const HEALTHY = [
  "mleko",
  "woda",
  "jaj",
  "owies",
  "owsian",
  "pełnoziarnist",
  "warzyw",
  "owoc",
  "oliwa",
  "olej rzepakowy",
  "jogurt",
  "banan",
  "kiwi",
];

export function classifyIngredient(raw: string): IngredientTagKind {
  const s = raw.toLowerCase().trim();
  if (HARMFUL.some((k) => s.includes(k))) return "harmful";
  if (HEALTHY.some((k) => s.includes(k))) return "healthy";
  return "safe";
}

export function splitIngredients(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[,;•·\n]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && s.length < 80)
    .slice(0, 24);
}

/**
 * Prosta ocena 1–5 na podstawie soli / cukru / tłuszczu nasyconego (na 100 g).
 * Nie jest to „Fitatu score” — lokalna heurystyka GymBrat.
 */
export function gymbratNutritionScore(
  product: FoodProduct,
): { score: number; max: number } | null {
  const d = product.details;
  if (!d) return null;
  let score = 5;
  const salt = d.saltG ?? (d.sodiumMg != null ? d.sodiumMg / 400 : null);
  const sugar = d.sugarsG;
  const sat = d.saturatedFatG;
  if (salt != null) {
    if (salt > 1.5) score -= 1.5;
    else if (salt > 0.8) score -= 0.7;
  }
  if (sugar != null) {
    if (sugar > 15) score -= 1.2;
    else if (sugar > 8) score -= 0.5;
  }
  if (sat != null) {
    if (sat > 10) score -= 1.2;
    else if (sat > 5) score -= 0.5;
  }
  const clamped = Math.max(1, Math.min(5, Math.round(score * 10) / 10));
  return { score: clamped, max: 5 };
}

export function emptyDetails(): FoodNutritionDetails {
  return {
    saturatedFatG: null,
    monoFatG: null,
    polyFatG: null,
    omega3G: null,
    omega6G: null,
    sugarsG: null,
    fiberG: null,
    saltG: null,
    sodiumMg: null,
    cholesterolMg: null,
    caffeineMg: null,
    vitaminAUg: null,
    vitaminCMg: null,
    vitaminDUg: null,
    calciumMg: null,
    ironMg: null,
    ingredientsText: null,
  };
}

/** Skaluje szczegóły z bazy 100 g na wybraną ilość gramów. */
export function scaleDetails(
  details: FoodNutritionDetails | undefined,
  grams: number,
): FoodNutritionDetails | undefined {
  if (!details) return undefined;
  const f = grams / 100;
  const scale = (v: number | null): number | null =>
    v == null ? null : round1(v * f);
  return {
    saturatedFatG: scale(details.saturatedFatG),
    monoFatG: scale(details.monoFatG),
    polyFatG: scale(details.polyFatG),
    omega3G: scale(details.omega3G),
    omega6G: scale(details.omega6G),
    sugarsG: scale(details.sugarsG),
    fiberG: scale(details.fiberG),
    saltG: scale(details.saltG),
    sodiumMg: scale(details.sodiumMg),
    cholesterolMg: scale(details.cholesterolMg),
    caffeineMg: scale(details.caffeineMg),
    vitaminAUg: scale(details.vitaminAUg),
    vitaminCMg: scale(details.vitaminCMg),
    vitaminDUg: scale(details.vitaminDUg),
    calciumMg: scale(details.calciumMg),
    ironMg: scale(details.ironMg),
    ingredientsText: details.ingredientsText,
  };
}

export type NutritionRow = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  indent?: boolean;
  section?: boolean;
};

/** Wiersze tabeli jak w Fitatu — null → „b.d.”. */
export function buildNutritionRows(
  macros: { calories: number; proteinG: number; fatG: number; carbsG: number },
  details: FoodNutritionDetails | undefined,
): NutritionRow[] {
  const d = details ?? emptyDetails();
  const netCarbs =
    d.fiberG != null ? round1(Math.max(0, macros.carbsG - d.fiberG)) : null;

  return [
    { id: "kcal", label: "Wartość energetyczna (kcal)", value: macros.calories, unit: "kcal" },
    { id: "protein", label: "Białka (g)", value: macros.proteinG, unit: "g" },
    { id: "protein-animal", label: "zwierzęce", value: null, unit: "g", indent: true },
    { id: "protein-plant", label: "roślinne", value: null, unit: "g", indent: true },
    { id: "fat", label: "Tłuszcze (g)", value: macros.fatG, unit: "g" },
    { id: "sat", label: "nasycone", value: d.saturatedFatG, unit: "g", indent: true },
    { id: "mono", label: "jednonienasycone", value: d.monoFatG, unit: "g", indent: true },
    { id: "poly", label: "wielonienasycone", value: d.polyFatG, unit: "g", indent: true },
    { id: "o3", label: "Kwas omega 3", value: d.omega3G, unit: "g", indent: true },
    { id: "o6", label: "Kwas omega 6", value: d.omega6G, unit: "g", indent: true },
    { id: "carbs", label: "Węglowodany (g)", value: macros.carbsG, unit: "g" },
    { id: "net", label: "Węglowodany netto", value: netCarbs, unit: "g", indent: true },
    { id: "sugars", label: "Cukry", value: d.sugarsG, unit: "g", indent: true },
    { id: "fiber", label: "Błonnik (g)", value: d.fiberG, unit: "g" },
    { id: "salt", label: "Sól (g)", value: d.saltG, unit: "g" },
    { id: "chol", label: "Cholesterol (mg)", value: d.cholesterolMg, unit: "mg" },
    { id: "caff", label: "Kofeina (mg)", value: d.caffeineMg, unit: "mg" },
    { id: "vit-sec", label: "Witaminy", value: null, unit: "", section: true },
    { id: "vita", label: "Witamina A (µg)", value: d.vitaminAUg, unit: "µg" },
    { id: "vitc", label: "Witamina C (mg)", value: d.vitaminCMg, unit: "mg" },
    { id: "vitd", label: "Witamina D (µg)", value: d.vitaminDUg, unit: "µg" },
    { id: "min-sec", label: "Minerały", value: null, unit: "", section: true },
    { id: "ca", label: "Wapń (mg)", value: d.calciumMg, unit: "mg" },
    { id: "fe", label: "Żelazo (mg)", value: d.ironMg, unit: "mg" },
  ];
}

export function formatNutrientValue(value: number | null, unit: string): string {
  if (value == null) return "b.d.";
  const n = Number.isInteger(value) ? String(value) : String(round1(value)).replace(".", ",");
  return unit ? `${n} ${unit}` : n;
}
