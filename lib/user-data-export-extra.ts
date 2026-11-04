import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptionOrders } from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import { buildUserDataPurgeSteps } from "@/lib/account-purge";

/**
 * Z26 (RODO art. 20): eksport uzupełniający — wszystkie tabele zależne od konta, wyprowadzone z tych
 * samych metadanych schematu co usuwanie konta (`buildUserDataPurgeSteps`), więc nowa tabela z `user_id`
 * trafia do eksportu automatycznie. Sekcje „główne” (plany, treningi, raport ciała…) eksportuje
 * `buildUserDataExport`; tu zostaje reszta + zamówienia.
 */

/** Tabele już eksportowane w sekcjach głównych (`user-data-export.ts`). */
export const EXPORT_MAIN_TABLES: ReadonlySet<string> = new Set([
  "user_settings",
  "workout_plans",
  "workouts",
  "meal_logs",
  "body_reports",
  "body_report_photos",
  "daily_checkins",
  "weight_logs",
  "training_sessions",
]);

/** Tabele z sekretami lub kodami jednorazowymi — nie są „danymi użytkownika”, a ich ujawnienie szkodzi. */
export const EXPORT_SECRET_TABLES: ReadonlySet<string> = new Set([
  "push_subscriptions",
  "email_verification_codes",
  "admin_two_factor",
]);

export function extraExportTables(userId = "x"): string[] {
  const names = new Set<string>();
  for (const step of buildUserDataPurgeSteps(userId)) {
    if (EXPORT_MAIN_TABLES.has(step.table) || EXPORT_SECRET_TABLES.has(step.table)) continue;
    names.add(step.table);
  }
  return [...names].sort();
}

function decryptRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" ? (maybeDecryptSensitiveField(v) ?? v) : v;
  }
  return out;
}

export type ExtraExport = {
  orders: Record<string, unknown>[];
  /** Pozostałe tabele powiązane z kontem: nazwa tabeli → wiersze. */
  tables: Record<string, Record<string, unknown>[]>;
};

export async function buildExtraExport(db: Database, userId: string): Promise<ExtraExport> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const seen = new Map<string, Set<string>>();

  for (const step of buildUserDataPurgeSteps(userId)) {
    if (EXPORT_MAIN_TABLES.has(step.table) || EXPORT_SECRET_TABLES.has(step.table)) continue;
    const rows = (await db.all(
      sql`SELECT * FROM ${sql.identifier(step.table)} WHERE ${step.where}`,
    )) as Record<string, unknown>[];
    const bucket = (tables[step.table] ??= []);
    const keys = seen.get(step.table) ?? new Set<string>();
    seen.set(step.table, keys);
    for (const row of rows) {
      const key = JSON.stringify(row);
      if (keys.has(key)) continue;
      keys.add(key);
      bucket.push(decryptRow(row));
    }
  }
  for (const name of Object.keys(tables)) if (tables[name]!.length === 0) delete tables[name];

  const orders = await db
    .select()
    .from(subscriptionOrders)
    .where(eq(subscriptionOrders.userId, userId));

  return {
    orders: orders.map((o) => ({
      ...o,
      createdAt: o.createdAt?.toISOString?.() ?? null,
      paidAt: o.paidAt?.toISOString?.() ?? null,
      receiptIssuedAt: o.receiptIssuedAt?.toISOString?.() ?? null,
      termsAcceptedAt: o.termsAcceptedAt?.toISOString?.() ?? null,
      immediateServiceConsentAt: o.immediateServiceConsentAt?.toISOString?.() ?? null,
    })),
    tables,
  };
}
