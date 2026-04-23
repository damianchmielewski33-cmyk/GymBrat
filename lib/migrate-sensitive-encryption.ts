import { and, eq, isNotNull, notLike } from "drizzle-orm";
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

  const tokenRows = await db
    .select({ id: users.id, fitatuAccessToken: users.fitatuAccessToken })
    .from(users)
    .where(
      and(
        isNotNull(users.fitatuAccessToken),
        notLike(users.fitatuAccessToken, `${ENCRYPTED_FIELD_PREFIX}%`),
      ),
    );

  for (const r of tokenRows) {
    const plain = r.fitatuAccessToken;
    if (!plain) continue;
    await db
      .update(users)
      .set({ fitatuAccessToken: encryptSensitiveField(plain) })
      .where(eq(users.id, r.id));
  }

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
