export type BarcodeProduct = {
  barcode: string;
  name: string;
  brand?: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  per100g: boolean;
};

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | undefined>;
};

/**
 * Lookup Open Food Facts (publiczne API, bez klucza).
 */
export async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeProduct | null> {
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GymBrat/1.0 (diet tracker; contact@gymbrat.app)" },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;

  const n = json.product.nutriments ?? {};
  const kcal =
    Number(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? n.energy_kcal_100g ?? 0) || 0;
  const proteinG = Number(n.proteins_100g ?? n.proteins ?? 0) || 0;
  const fatG = Number(n.fat_100g ?? n.fat ?? 0) || 0;
  const carbsG = Number(n.carbohydrates_100g ?? n.carbohydrates ?? 0) || 0;
  const name =
    (json.product.product_name ?? "").trim() ||
    `Produkt ${code}`;

  return {
    barcode: code,
    name,
    brand: json.product.brands?.trim() || undefined,
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    per100g: true,
  };
}
