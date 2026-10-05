import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, bodyReports } from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";

export async function getBodyReportPhotoDataUrlForUser(
  photoId: string,
  userId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ dataUrl: bodyReportPhotos.dataUrl })
    .from(bodyReportPhotos)
    .innerJoin(bodyReports, eq(bodyReportPhotos.reportId, bodyReports.id))
    .where(
      and(eq(bodyReportPhotos.id, photoId), eq(bodyReports.userId, userId)),
    )
    .limit(1);
  if (!row?.dataUrl) return null;
  const plain = maybeDecryptSensitiveField(row.dataUrl);
  if (!plain?.startsWith("data:image/")) return null;
  return plain;
}
