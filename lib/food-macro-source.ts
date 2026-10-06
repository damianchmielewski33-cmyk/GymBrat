import type { FoodProduct } from "@/lib/food-products-types";

export type FoodMacroSourceKind =
  | "retail_estimate"
  | "local"
  | "openfoodfacts"
  | "usda";

export function getFoodMacroSourceKind(product: FoodProduct): FoodMacroSourceKind {
  if (product.source === "openfoodfacts") return "openfoodfacts";
  if (product.source === "usda") return "usda";
  if (product.id.startsWith("retail-")) return "retail_estimate";
  return "local";
}

/** Krótka etykieta źródła makro (lista / porcja). */
export function getFoodMacroSourceLabel(product: FoodProduct): string {
  switch (getFoodMacroSourceKind(product)) {
    case "openfoodfacts":
      return "Open Food Facts · na 100 g";
    case "usda":
      return "USDA · na 100 g";
    case "retail_estimate":
      return "Szacunek · sprawdź etykietę";
    default:
      return "Baza GymBrat";
  }
}

export function getFoodMacroSourceHint(product: FoodProduct): string | null {
  if (getFoodMacroSourceKind(product) !== "retail_estimate") return null;
  return "Makro orientacyjne (sieć / QSR). Przed zapisem porównaj z etykietą lub stroną producenta.";
}
