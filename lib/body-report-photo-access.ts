import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, bodyReports } from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import { thumbKeyFor } from "@/lib/image-thumbnail";
import { getObjectText } from "@/lib/object-storage";

export async function getBodyReportPhotoDataUrlForUser(
  photoId: string,
  userId: string,
  opts?: { thumb?: boolean },
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({
      dataUrl: bodyReportPhotos.dataUrl,
      objectKey: bodyReportPhotos.objectKey,
    })
    .from(bodyReportPhotos)
    .innerJoin(bodyReports, eq(bodyReportPhotos.reportId, bodyReports.id))
    .where(
      and(eq(bodyReportPhotos.id, photoId), eq(bodyReports.userId, userId)),
    )
    .limit(1);
  if (!row) return null;
  let stored: string | null = row.dataUrl || null;
  if (row.objectKey) {
    // Z39: autoryzacja wyżej (właściciel raportu); obiekt pobierany po stronie serwera.
    // Miniatura (Z88b), z powrotem do oryginału, gdy jej brak (zdjęcia sprzed zmiany).
    stored = opts?.thumb ? await getObjectText(thumbKeyFor(row.objectKey)).catch(() => null) : null;
    stored ??= await getObjectText(row.objectKey);
  }
  if (!stored) return null;
  const plain = maybeDecryptSensitiveField(stored);
  if (!plain?.startsWith("data:image/")) return null;
  return plain;
}
