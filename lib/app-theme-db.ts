import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseAppTheme, type AppTheme } from "@/lib/app-theme";

/** Dodaje kolumnę `app_theme`, gdy baza jej jeszcze nie ma (idempotentnie; migracja 0047 / ensure-schema). */
export async function ensureAppThemeColumn(): Promise<void> {
  try {
    await (getDb() as unknown as { $client: Client }).$client.execute(
      `ALTER TABLE "user_settings" ADD COLUMN "app_theme" text NOT NULL DEFAULT 'gold'`,
    );
  } catch {
    /* kolumna już istnieje albo brak uprawnień — dalszy błąd zgłosi właściwe zapytanie */
  }
}

async function selectTheme(userId: string): Promise<AppTheme> {
  const [s] = await getDb()
    .select({ appTheme: userSettings.appTheme })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return parseAppTheme(s?.appTheme);
}

/** Motyw zapisany na koncie; przy brakującej kolumnie naprawia schemat i próbuje ponownie, w ostateczności złoty. */
export async function readAppTheme(userId: string): Promise<AppTheme> {
  try {
    return await selectTheme(userId);
  } catch {
    await ensureAppThemeColumn();
    try {
      return await selectTheme(userId);
    } catch {
      return parseAppTheme(null);
    }
  }
}
