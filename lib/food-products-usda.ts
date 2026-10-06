import type { FoodProduct } from "@/lib/food-products-types";
import { englishFoodQueryVariants } from "@/lib/food-query-i18n";
import { normalizeFoodQuery, scoreProductAgainstQuery } from "@/lib/food-products";

type UsdaNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaNutrient[];
  dataType?: string;
};

function usdaApiKey(): string {
  return (
    process.env.USDA_FDC_API_KEY?.trim() ||
    process.env.FDC_API_KEY?.trim() ||
    "DEMO_KEY"
  );
}

function nutrientValue(food: UsdaFood, ids: number[], nameHints: RegExp[]): number | null {
  for (const n of food.foodNutrients ?? []) {
    const id = n.nutrientId;
    const num = n.nutrientNumber != null ? Number(n.nutrientNumber) : NaN;
    if ((id != null && ids.includes(id)) || (Number.isFinite(num) && ids.includes(num))) {
      if (n.value != null && Number.isFinite(n.value)) return n.value;
    }
  }
  for (const n of food.foodNutrients ?? []) {
    const name = (n.nutrientName ?? "").toLowerCase();
    if (nameHints.some((re) => re.test(name)) && n.value != null && Number.isFinite(n.value)) {
      const unit = (n.unitName ?? "").toUpperCase();
      // Energy czasem w kJ
      if (/energy|calor/.test(name) && unit === "KJ") {
        return Math.round(n.value / 4.184);
      }
      return n.value;
    }
  }
  return null;
}

export function mapUsdaFoodToProduct(raw: UsdaFood): FoodProduct | null {
  const name = (raw.description ?? "").trim();
  if (!name) return null;

  const calories =
    nutrientValue(raw, [1008], [/energy.*kcal|calories/i]) ??
    nutrientValue(raw, [2047, 2048], [/energy/i]);
  const proteinG = nutrientValue(raw, [1003], [/^protein$/i]);
  const fatG = nutrientValue(raw, [1004], [/total lipid|total fat|^fat$/i]);
  const carbsG = nutrientValue(raw, [1005], [/carbohydrate/i]);

  if (
    (calories == null || !(calories > 0)) &&
    !(proteinG != null && proteinG > 0) &&
    !(fatG != null && fatG > 0) &&
    !(carbsG != null && carbsG > 0)
  ) {
    return null;
  }

  const kcal =
    calories != null && calories > 0
      ? Math.round(calories)
      : Math.round(
          4 * (proteinG ?? 0) + 4 * (carbsG ?? 0) + 9 * (fatG ?? 0),
        );

  const brand =
    raw.brandOwner?.trim() || raw.brandName?.trim() || undefined;
  const code = (raw.gtinUpc ?? "").replace(/\D/g, "");
  const id = `usda-${raw.fdcId ?? normalizeFoodQuery(name).slice(0, 40)}`;

  return {
    id,
    barcode: code.length >= 8 ? code : null,
    name: brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${name}`
      : name,
    brand,
    servingLabel: "100 g",
    calories: kcal,
    proteinG: Math.round((proteinG ?? 0) * 10) / 10,
    fatG: Math.round((fatG ?? 0) * 10) / 10,
    carbsG: Math.round((carbsG ?? 0) * 10) / 10,
    source: "usda",
    basisAmount: 100,
    basisUnit: "g",
  };
}

async function fetchUsdaSearch(query: string, pageSize: number): Promise<UsdaFood[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", usdaApiKey());
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { foods?: UsdaFood[] };
    return json.foods ?? [];
  } catch {
    return [];
  }
}

/** USDA FoodData Central — setki tysięcy produktów (Foundation + branded). */
export async function searchUsdaFoods(
  query: string,
  limit = 20,
): Promise<FoodProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const variants = [
    q,
    ...englishFoodQueryVariants(q),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const collected: FoodProduct[] = [];
  const seen = new Set<string>();

  await Promise.all(
    variants.slice(0, 3).map(async (v) => {
      const foods = await fetchUsdaSearch(v, Math.max(limit, 25));
      for (const f of foods) {
        const mapped = mapUsdaFoodToProduct(f);
        if (!mapped) continue;
        const key = `${mapped.barcode ?? ""}|${mapped.name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(mapped);
      }
    }),
  );

  return collected
    .map((p) => ({ p, score: scoreProductAgainstQuery(query, p) }))
    .filter((x) => x.score > 0 || englishFoodQueryVariants(query).length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Szybkie szukanie po EAN/UPC w USDA (gdy OFF nie zna kodu). */
export async function lookupUsdaByBarcode(barcode: string): Promise<FoodProduct | null> {
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8) return null;
  const foods = await fetchUsdaSearch(code, 8);
  for (const f of foods) {
    const gtin = (f.gtinUpc ?? "").replace(/\D/g, "");
    if (gtin === code || gtin.endsWith(code) || code.endsWith(gtin)) {
      const mapped = mapUsdaFoodToProduct(f);
      if (mapped) return mapped;
    }
  }
  // Czasem USDA zwraca wynik po samym query = kod
  for (const f of foods) {
    const mapped = mapUsdaFoodToProduct(f);
    if (mapped?.barcode === code) return mapped;
  }
  return null;
}
