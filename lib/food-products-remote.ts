import type { FoodProduct } from "@/lib/food-products-types";
import {
  scoreProductAgainstQuery,
  searchOpenFoodFacts,
} from "@/lib/food-products";
import { searchUsdaFoods } from "@/lib/food-products-usda";

/**
 * Zdalne źródła: Open Food Facts (miliony EAN PL/świat) + USDA FoodData Central.
 * Lokalna baza GymBrat jest dokładana w `searchFoodProductsAction`.
 */
export async function searchRemoteFoodProducts(
  query: string,
  limit = 40,
): Promise<FoodProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

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
    // USDA po tłumaczeniu PL→EN może mieć score 0 na polskiej nazwie — zostaw z bazowym 1
    const score = scoreProductAgainstQuery(q, p) || (p.source === "usda" ? 2 : 0);
    if (score <= 0) continue;
    merged.push({ p, score });
  }
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit).map((x) => x.p);
}
