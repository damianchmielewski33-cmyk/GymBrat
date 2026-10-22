import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  encryptSensitiveField,
  maybeDecryptSensitiveField,
} from "@/lib/app-field-crypto";

export async function hasStartPhoto(userId: string): Promise<boolean> {
  const db = getDb();
  // Bez pobierania bloba — tylko flaga (timeouty Turso na Renderze).
  const [row] = await db
    .select({
      has: sql<number>`CASE WHEN ${userSettings.startPhotoDataUrl} IS NOT NULL AND length(trim(${userSettings.startPhotoDataUrl})) > 0 THEN 1 ELSE 0 END`,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return Number(row?.has) === 1;
}

export async function loadStartPhotoDataUrl(
  userId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ startPhotoDataUrl: userSettings.startPhotoDataUrl })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return maybeDecryptSensitiveField(row?.startPhotoDataUrl ?? null);
}

export async function saveStartPhotoDataUrl(
  userId: string,
  dataUrl: string | null,
): Promise<void> {
  const db = getDb();
  const stored =
    dataUrl && dataUrl.trim()
      ? encryptSensitiveField(dataUrl.trim())
      : null;

  const [existing] = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userSettings)
      .set({
        startPhotoDataUrl: stored,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      startPhotoDataUrl: stored,
    });
  }
}
