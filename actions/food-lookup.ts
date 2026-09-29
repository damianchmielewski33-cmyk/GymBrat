"use server";

import { auth } from "@/auth";
import {
  findLocalProductByBarcode,
  lookupBarcodeRemote,
  searchLocalProducts,
  searchOpenFoodFacts,
  scoreProductAgainstQuery,
} from "@/lib/food-products";
import { listRecentFoodProductsFromLogs } from "@/lib/meal-logs";
import type { FoodProduct } from "@/lib/food-products-types";

export type FoodLookupResult =
  | { ok: true; product: FoodProduct }
  | { ok: false; error: string };

export type FoodSearchResult =
  | { ok: true; products: FoodProduct[]; fromRecents?: boolean }
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

/** Ostatnio dodane produkty z historii dziennika. */
export async function listRecentFoodProductsAction(
  limit = 24,
): Promise<FoodSearchResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: true, products: searchLocalProducts("", limit), fromRecents: false };
  }
  try {
    const recent = await listRecentFoodProductsFromLogs(session.user.id, limit);
    if (recent.length > 0) {
      return { ok: true, products: recent, fromRecents: true };
    }
  } catch {
    /* fallback */
  }
  return { ok: true, products: searchLocalProducts("", limit), fromRecents: false };
}

export async function searchFoodProductsAction(query: string): Promise<FoodSearchResult> {
  const q = query.trim();
  if (!q) {
    return listRecentFoodProductsAction(24);
  }

  // Sam kod — traktuj jak skan
  if (/^\d{8,14}$/.test(q.replace(/\s/g, ""))) {
    const byCode = await lookupFoodByBarcodeAction(q);
    if (byCode.ok) return { ok: true, products: [byCode.product] };
  }

  const local = searchLocalProducts(q, 20);
  let remote: FoodProduct[] = [];
  try {
    remote = await searchOpenFoodFacts(q, 16);
  } catch {
    /* opcjonalne */
  }

  const seen = new Set<string>();
  const merged: Array<{ p: FoodProduct; score: number }> = [];
  for (const p of [...local, ...remote]) {
    const key = `${(p.barcode ?? "").toLowerCase()}|${p.name.toLowerCase()}|${(p.brand ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const score = scoreProductAgainstQuery(q, p);
    if (score <= 0 && !local.includes(p)) continue;
    merged.push({ p, score: score || 1 });
  }
  merged.sort((a, b) => b.score - a.score);
  return { ok: true, products: merged.slice(0, 28).map((x) => x.p) };
}
