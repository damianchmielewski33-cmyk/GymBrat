import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, bodyReports } from "@/db/schema";
import { withDbRetry } from "@/db/with-retry";
import { frontBodyReportPhoto } from "@/lib/body-report-photo-slots";
import { hasStartPhoto } from "@/lib/start-photo";
import { bodyReportPhotoMediaPath, startPhotoMediaPath } from "@/lib/user-photo-media";
import { calendarDateKey } from "@/lib/local-date";

export async function getTransformationPhotos(userId: string): Promise<{
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
}> {
  return withDbRetry(() => loadTransformationPhotos(userId), {
    attempts: 3,
    baseDelayMs: 250,
    label: "home-transformation",
  });
}

async function loadTransformationPhotos(userId: string): Promise<{
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
}> {
  const db = getDb();
  const [customStart, reports] = await Promise.all([
    hasStartPhoto(userId),
    db
      .select({ id: bodyReports.id, createdAt: bodyReports.createdAt })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId))
      .orderBy(asc(bodyReports.createdAt), asc(bodyReports.id)),
  ]);

  const customStartUrl = customStart ? startPhotoMediaPath() : null;

  if (reports.length === 0) {
    return {
      firstPhotoUrl: customStartUrl,
      latestPhotoUrl: customStartUrl,
      latestPhotoDate: null,
    };
  }

  const reportIds = reports.map((r) => r.id);
  // Meta only — pełne bloby idą przez /api/media (timeouty Turso na Renderze).
  const photos = await db
    .select({
      id: bodyReportPhotos.id,
      reportId: bodyReportPhotos.reportId,
      createdAt: bodyReportPhotos.createdAt,
    })
    .from(bodyReportPhotos)
    .where(
      and(
        reportIds.length === 1
          ? eq(bodyReportPhotos.reportId, reportIds[0]!)
          : inArray(bodyReportPhotos.reportId, reportIds),
        sql`(${bodyReportPhotos.objectKey} IS NOT NULL OR (${bodyReportPhotos.dataUrl} IS NOT NULL AND length(trim(${bodyReportPhotos.dataUrl})) > 0))`,
      ),
    )
    .orderBy(asc(bodyReportPhotos.createdAt), asc(bodyReportPhotos.id));

  if (photos.length === 0) {
    return {
      firstPhotoUrl: customStartUrl,
      latestPhotoUrl: customStartUrl,
      latestPhotoDate: null,
    };
  }

  const photosByReport = new Map<
    string,
    { id: string; dataUrl: string; createdAt: Date }[]
  >();
  for (const p of photos) {
    const arr = photosByReport.get(p.reportId) ?? [];
    arr.push({
      id: p.id,
      dataUrl: "meta",
      createdAt: p.createdAt,
    });
    photosByReport.set(p.reportId, arr);
  }

  let firstPhotoUrl: string | null = null;
  let latestPhotoUrl: string | null = null;
  let latestPhotoDate: string | null = null;
  for (const r of reports) {
    const reportPhotos = photosByReport.get(r.id) ?? [];
    const front = frontBodyReportPhoto(reportPhotos);
    if (!front) continue;
    const mediaSrc = bodyReportPhotoMediaPath(front.id);
    if (!firstPhotoUrl) firstPhotoUrl = mediaSrc;
    latestPhotoUrl = mediaSrc;
    latestPhotoDate = calendarDateKey(new Date(r.createdAt));
  }

  return {
    firstPhotoUrl: customStartUrl ?? firstPhotoUrl,
    latestPhotoUrl,
    latestPhotoDate,
  };
}

export async function getLatestDimensions(userId: string) {
  const db = getDb();
  const [r] = await db
    .select({
      weightKg: bodyReports.weightKg,
      waistCm: bodyReports.waistCm,
      armCm: bodyReports.armCm,
      abdomenCm: bodyReports.abdomenCm,
      chestCm: bodyReports.chestCm,
      thighCm: bodyReports.thighCm,
    })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
    .limit(1);

  return {
    weightKg: r?.weightKg ?? null,
    waistCm: r?.waistCm ?? null,
    armCm: r?.armCm ?? null,
    abdomenCm: r?.abdomenCm ?? null,
    chestCm: r?.chestCm ?? null,
    thighCm: r?.thighCm ?? null,
  };
}
