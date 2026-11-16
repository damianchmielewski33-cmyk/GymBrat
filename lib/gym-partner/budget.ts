import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";

/**
 * Miesięczne limity całej aplikacji dobrane do DARMOWYCH progów Google Maps Platform
 * (z zapasem). Wartości można zmienić zmiennymi środowiska, gdy właściciel przyjmie budżet.
 *  - list:    Nearby/Text Search (pola Pro)        — próg Google ok. 5000/mies.
 *  - details: Place Details (godziny, strona www)  — próg Google ok. 1000/mies.
 *  - map:     załadowania mapy (Maps JavaScript)   — próg Google ok. 10000/mies.
 */
export const BUDGET_KINDS = {
  list: { env: "GYM_PLACES_MONTHLY_LIST_LIMIT", fallback: 4500 },
  details: { env: "GYM_PLACES_MONTHLY_DETAILS_LIMIT", fallback: 900 },
  map: { env: "GYM_MAPS_MONTHLY_LOAD_LIMIT", fallback: 9000 },
} as const;
export type BudgetKind = keyof typeof BUDGET_KINDS;

export function monthlyLimit(kind: BudgetKind, env: Record<string, string | undefined> = process.env): number {
  const def = BUDGET_KINDS[kind];
  const n = Number(env[def.env]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def.fallback;
}

export function monthKey(kind: BudgetKind, now = new Date()): string {
  return `gym-${kind}:${now.toISOString().slice(0, 7)}`;
}

/**
 * Atomowo rezerwuje 1 jednostkę budżetu. `false` = limit miesięczny wyczerpany (albo błąd bazy —
 * przy płatnym API wolimy zablokować niż przekroczyć).
 */
export async function consumeBudget(kind: BudgetKind): Promise<boolean> {
  const limit = monthlyLimit(kind);
  if (limit <= 0) return false;
  try {
    await ensureCriticalSchema();
    const now = Date.now();
    const rows = await getDb().all<{ count: number }>(sql`
      INSERT INTO api_usage_counters (key, count, updated_at)
      VALUES (${monthKey(kind)}, 1, ${now})
      ON CONFLICT(key) DO UPDATE SET count = count + 1, updated_at = ${now}
      WHERE api_usage_counters.count < ${limit}
      RETURNING count`);
    return rows.length > 0;
  } catch {
    return false;
  }
}
