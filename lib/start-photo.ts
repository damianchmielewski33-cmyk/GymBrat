import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  encryptSensitiveField,
  maybeDecryptSensitiveField,
} from "@/lib/app-field-crypto";

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
