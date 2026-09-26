"use server";

import { findLocalProductByBarcode, lookupBarcodeRemote, searchLocalProducts, searchOpenFoodFacts } from "@/lib/food-products";
import type { FoodProduct } from "@/lib/food-products-types";

export type FoodLookupResult =
  | { ok: true; product: FoodProduct }
  | { ok: false; error: string };

export type FoodSearchResult =
  | { ok: true; products: FoodProduct[] }
  | { ok: false; error: string };

export async function lookupFoodByBarcodeAction(barcode: string): Promise<FoodLookupResult> {
  const code = barcode.replace(/\D/g, "").trim();
  if (code.length < 8) {
    return { ok: false, error: "Kod kreskowy jest za krótki — wpisz pełny EAN (8–13 cyfr)." };
  }

  const local = findLocalProductByBarcode(code);
  if (local) return { ok: true, product: local };

  try {
    const remote = await lookupBarcodeRemote(code);
    if (remote) return { ok: true, product: remote };
  } catch {
    /* sieć / OFF */
  }

  return {
    ok: false,
    error: "Nie znaleziono produktu dla tego kodu. Spróbuj wyszukać po nazwie.",
  };
}

export async function searchFoodProductsAction(query: string): Promise<FoodSearchResult> {
  const q = query.trim();
  if (!q) {
    return { ok: true, products: searchLocalProducts("", 24) };
  }

  // Sam kod — traktuj jak skan
  if (/^\d{8,14}$/.test(q.replace(/\s/g, ""))) {
    const byCode = await lookupFoodByBarcodeAction(q);
    if (byCode.ok) return { ok: true, products: [byCode.product] };
  }

  const local = searchLocalProducts(q, 16);
  let remote: FoodProduct[] = [];
  try {
    remote = await searchOpenFoodFacts(q, 10);
  } catch {
    /* opcjonalne */
  }

  const seen = new Set<string>();
  const merged: FoodProduct[] = [];
  for (const p of [...local, ...remote]) {
    const key = `${(p.barcode ?? "").toLowerCase()}|${p.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  return { ok: true, products: merged.slice(0, 24) };
}
