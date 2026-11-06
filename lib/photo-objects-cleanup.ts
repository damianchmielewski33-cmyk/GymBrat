import "server-only";

import { eq, isNotNull, and } from "drizzle-orm";
import type { Database } from "@/db";
import { bodyReportPhotos, bodyReports } from "@/db/schema";
import { deleteObject, isObjectStorageEnabled } from "@/lib/object-storage";

/** Z39: klucze obiektów zdjęć użytkownika (zbierać PRZED usunięciem wierszy). */
export async function listUserPhotoObjectKeys(
  db: Database,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ key: bodyReportPhotos.objectKey })
    .from(bodyReportPhotos)
    .innerJoin(bodyReports, eq(bodyReportPhotos.reportId, bodyReports.id))
    .where(
      and(eq(bodyReports.userId, userId), isNotNull(bodyReportPhotos.objectKey)),
    );
  return rows.map((r) => r.key).filter((k): k is string => !!k);
}

/** Best effort — błąd pojedynczego obiektu nie przerywa usuwania konta/retencji. */
export async function deleteObjectKeys(keys: string[]): Promise<void> {
  if (!keys.length || !isObjectStorageEnabled()) return;
  await Promise.all(keys.flatMap((k) => [k, `${k}.thumb`]).map((k) => deleteObject(k).catch(() => {})));
}
