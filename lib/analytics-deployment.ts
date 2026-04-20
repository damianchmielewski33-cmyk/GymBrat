import { eq, isNull, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Rozdziela zapis analityki (odsłony, log aktywności) między produkcję, preview i dev.
 * Na Vercelu ustawiane jest VERCEL_ENV; nadpisz ANALYTICS_DEPLOYMENT_ENV tylko w razie potrzeby.
 */
export function getAnalyticsDeployment(): string {
  const override = process.env.ANALYTICS_DEPLOYMENT_ENV?.trim();
  if (override) return override;
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview" || v === "development") return v;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/** Bez tagu = wpisy sprzed migracji; na produkcji zwykle wyłączone (`includeUntagged: false`). */
export function analyticsDeploymentPredicate(
  col: SQLiteColumn,
  includeUntagged: boolean,
): SQL {
  const env = getAnalyticsDeployment();
  if (includeUntagged) {
    return or(eq(col, env), isNull(col))!;
  }
  return eq(col, env);
}
