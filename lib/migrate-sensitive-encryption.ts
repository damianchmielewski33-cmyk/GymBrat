import { and, eq, isNotNull, like, notLike } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, userSettings, users, workouts } from "@/db/schema";
import {
  ENCRYPTED_FIELD_PREFIX,
  encryptSensitiveField,
  hasAppEncryptionKey,
} from "@/lib/app-field-crypto";

/**
 * Jednorazowa migracja plaintext → zaszyfrowane (przy starcie procesu).
 * Idempotentna: pomija rekordy już z prefiksem `gbenc:v1:`.
 */
export async function migrateSensitiveFieldsAtStartup(): Promise<void> {
  if (!hasAppEncryptionKey()) return;

  const db = getDb();

  // Wyczyść pozostałości tokenów Fitatu (integracja usunięta).
  await db
    .update(users)
    .set({ fitatuAccessToken: null })
    .where(isNotNull(users.fitatuAccessToken));

  const photoRows = await db
    .select({ id: bodyReportPhotos.id, dataUrl: bodyReportPhotos.dataUrl })
    .from(bodyReportPhotos)
    .where(notLike(bodyReportPhotos.dataUrl, `${ENCRYPTED_FIELD_PREFIX}%`));

  for (const p of photoRows) {
    await db
      .update(bodyReportPhotos)
      .set({ dataUrl: encryptSensitiveField(p.dataUrl) })
      .where(eq(bodyReportPhotos.id, p.id));
  }

  const startPhotoRows = await db
    .select({
      userId: userSettings.userId,
      startPhotoDataUrl: userSettings.startPhotoDataUrl,
    })
    .from(userSettings)
    .where(
      and(
        isNotNull(userSettings.startPhotoDataUrl),
        notLike(userSettings.startPhotoDataUrl, `${ENCRYPTED_FIELD_PREFIX}%`),
      ),
    );

  for (const row of startPhotoRows) {
    const plain = row.startPhotoDataUrl?.trim();
    if (!plain) continue;
    await db
      .update(userSettings)
      .set({
        startPhotoDataUrl: encryptSensitiveField(plain),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, row.userId));
  }

  const cardioRows = await db
    .select({ id: workouts.id, exercises: workouts.exercises })
    .from(workouts)
    .where(like(workouts.exercises, "%devicePhotoDataUrl%"));

  for (const row of cardioRows) {
    try {
      const parsed = JSON.parse(row.exercises) as Record<string, unknown>;
      if (parsed.kind !== "cardio_log") continue;
      const raw = parsed.devicePhotoDataUrl;
      if (typeof raw !== "string" || !raw.trim()) continue;
      if (raw.startsWith(ENCRYPTED_FIELD_PREFIX)) continue;
      if (!raw.startsWith("data:image/")) continue;
      parsed.devicePhotoDataUrl = encryptSensitiveField(raw);
      await db
        .update(workouts)
        .set({ exercises: JSON.stringify(parsed) })
        .where(eq(workouts.id, row.id));
    } catch {
      /* skip corrupt row */
    }
  }
}
