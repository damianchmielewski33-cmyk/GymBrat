import type { FoodAmountUnit, FoodProduct } from "@/lib/food-products-types";

export type FoodPortionMacros = {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Efektywne gramy użyte do skalowania (dla etykiety). */
  effectiveGrams: number | null;
  label: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Parsuje „150 g”, „250 ml”, „1 szt. (58 g)” z etykiety porcji. */
export function parseServingHint(servingLabel: string): {
  amount: number;
  unit: FoodAmountUnit;
  gramsPerPiece?: number;
} | null {
  const s = servingLabel.trim().toLowerCase();
  const pcs = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:szt|sztuk|sztuki|pc|pcs|egg)?\.?\s*(?:\((\d+(?:[.,]\d+)?)\s*g\))?/i,
  );
  if (/\bszt|\bpc\b|jajk|porcj/i.test(s) && pcs) {
    const amount = Number(String(pcs[1]).replace(",", "."));
    const gpp = pcs[2] ? Number(String(pcs[2]).replace(",", ".")) : undefined;
    if (Number.isFinite(amount) && amount > 0) {
      return {
        amount,
        unit: "pcs",
        gramsPerPiece: gpp != null && Number.isFinite(gpp) ? gpp : undefined,
      };
    }
  }
  const ml = s.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  if (ml) {
    const amount = Number(String(ml[1]).replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) return { amount, unit: "ml" };
  }
  const g = s.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (g) {
    const amount = Number(String(g[1]).replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) return { amount, unit: "g" };
  }
  return null;
}

export function resolveProductBasis(product: FoodProduct): {
  amount: number;
  unit: FoodAmountUnit;
  gramsPerPiece?: number;
} {
  if (product.basisAmount != null && product.basisAmount > 0) {
    return {
      amount: product.basisAmount,
      unit: product.basisUnit ?? "g",
      gramsPerPiece: product.gramsPerPiece,
    };
  }
  const hint = parseServingHint(product.servingLabel);
  if (hint) {
    return {
      amount: hint.amount,
      unit: hint.unit,
      gramsPerPiece: product.gramsPerPiece ?? hint.gramsPerPiece,
    };
  }
  return { amount: 100, unit: "g", gramsPerPiece: product.gramsPerPiece };
}

function toGrams(
  amount: number,
  unit: FoodAmountUnit,
  gramsPerPiece?: number,
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "g" || unit === "ml") return amount;
  if (unit === "pcs") {
    const gpp = gramsPerPiece != null && gramsPerPiece > 0 ? gramsPerPiece : null;
    return gpp != null ? amount * gpp : null;
  }
  return null;
}

/**
 * Przelicza makro produktu na wybraną ilość (g / ml / szt.).
 * Preferuje skalowanie przez gramy (jak Fitatu).
 */
export function scaleFoodMacros(
  product: FoodProduct,
  amount: number,
  unit: FoodAmountUnit,
): FoodPortionMacros {
  const basis = resolveProductBasis(product);
  const gpp = product.gramsPerPiece ?? basis.gramsPerPiece;

  const targetG = toGrams(amount, unit, gpp);
  const basisG = toGrams(basis.amount, basis.unit, gpp);

  let scale: number;
  if (targetG != null && basisG != null && basisG > 0) {
    scale = targetG / basisG;
  } else if (unit === basis.unit && basis.amount > 0) {
    scale = amount / basis.amount;
  } else if (unit === "pcs" && basis.unit === "pcs" && basis.amount > 0) {
    scale = amount / basis.amount;
  } else {
    scale = 1;
  }

  const label =
    unit === "pcs"
      ? `${round1(amount)} szt.${gpp ? ` (~${round1(amount * gpp)} g)` : ""}`
      : `${round1(amount)} ${unit}`;

  return {
    calories: Math.round(product.calories * scale),
    proteinG: round1(product.proteinG * scale),
    fatG: round1(product.fatG * scale),
    carbsG: round1(product.carbsG * scale),
    effectiveGrams: targetG != null ? round1(targetG) : null,
    label,
  };
}

export function defaultPortionForProduct(product: FoodProduct): {
  amount: number;
  unit: FoodAmountUnit;
} {
  const basis = resolveProductBasis(product);
  // Fitatu-style: po skanie OFF zwykle baza 100 g — domyślnie 100 g.
  if (product.source === "openfoodfacts" && (basis.unit === "g" || basis.unit === "ml")) {
    return { amount: 100, unit: basis.unit };
  }
  return { amount: basis.amount, unit: basis.unit };
}
