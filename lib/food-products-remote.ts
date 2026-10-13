import type { FoodProduct } from "@/lib/food-products-types";
import {
  compareFoodSearchHits,
  normalizeFoodQuery,
  scoreProductAgainstQuery,
  searchOpenFoodFacts,
} from "@/lib/food-products";
import { searchUsdaFoods } from "@/lib/food-products-usda";

/**
 * Zdalne źródła: Open Food Facts (miliony EAN PL/świat) + USDA FoodData Central.
 * Lokalna baza GymBrat jest dokładana w `searchFoodProductsAction`.
 * Krótkie zapytania (&lt; 3 znaki) — bez remote (Fitatu: najpierw lokalne podpowiedzi).
 */
export async function searchRemoteFoodProducts(
  query: string,
  limit = 40,
): Promise<FoodProduct[]> {
  const q = query.trim();
  if (normalizeFoodQuery(q).length < 3) return [];

  const [off, usda] = await Promise.all([
    searchOpenFoodFacts(q, Math.max(24, Math.ceil(limit * 0.75))).catch(
      () => [] as FoodProduct[],
    ),
    searchUsdaFoods(q, Math.max(16, Math.ceil(limit * 0.5))).catch(
      () => [] as FoodProduct[],
    ),
  ]);

  const seen = new Set<string>();
  const merged: Array<{ p: FoodProduct; score: number }> = [];
  for (const p of [...off, ...usda]) {
    const key = `${(p.barcode ?? "").toLowerCase()}|${p.name.toLowerCase()}|${p.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const score = scoreProductAgainstQuery(q, p);
    if (score <= 0) continue;
    merged.push({ p, score });
  }
  merged.sort(compareFoodSearchHits);
  return merged.slice(0, limit).map((x) => x.p);
}
