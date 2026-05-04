import "server-only";

import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AppSettingsRow = {
  aiGloballyDisabled: boolean;
};

async function ensureAppSettingsRow(): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db.select().from(appSettings).limit(1);
  if (rows.length > 0) return;
  await db.insert(appSettings).values({
    id: "singleton",
    aiGloballyDisabled: 0,
    updatedAt: new Date(),
  });
}

export async function getAppSettings(): Promise<AppSettingsRow> {
  await ensureAppSettingsRow();
  const db = getDb();
  const [row] = await db.select().from(appSettings).limit(1);
  return { aiGloballyDisabled: Boolean(row?.aiGloballyDisabled) };
}

export async function setAiGloballyDisabled(disabled: boolean): Promise<void> {
  await ensureAppSettingsRow();
  const db = getDb();
  await db
    .update(appSettings)
    .set({ aiGloballyDisabled: disabled ? 1 : 0, updatedAt: new Date() })
    .where(eq(appSettings.id, "singleton"));
}

