import { eq, isNotNull, notLike } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, users } from "@/db/schema";
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
}
