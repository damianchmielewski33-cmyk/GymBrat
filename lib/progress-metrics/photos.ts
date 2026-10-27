import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getBodyReports } from "@/lib/body-reports";
import { frontBodyReportPhoto } from "@/lib/body-report-photo-slots";
import { calendarDateKey } from "@/lib/local-date";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import type { ProgressHubData, ProgressPhotoItem } from "@/lib/progress-hub";
import { bodyReportPhotoMediaPath, startPhotoMediaPath } from "@/lib/user-photo-media";

/** Loads photo metadata only when the user opens the photo section. Image bytes stay behind authenticated media routes. */
export async function loadProgressPhotoMetrics(userId: string): Promise<ProgressHubData["photos"]> {
  const db = getDb();
  const [reports, settings] = await Promise.all([
    getBodyReports(userId, { photos: "meta" }),
    db.select({
      hasStartPhoto: sql<number>`CASE WHEN ${userSettings.startPhotoDataUrl} IS NOT NULL AND length(trim(${userSettings.startPhotoDataUrl})) > 0 THEN 1 ELSE 0 END`,
    }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1).then((rows) => rows[0] ?? null),
  ]);
  const items: ProgressPhotoItem[] = [];
  for (const report of [...reports].reverse()) {
    const photo = frontBodyReportPhoto(report.photos);
    if (!photo?.id || !report.createdAt) continue;
    items.push({
      id: photo.id,
      reportId: report.id,
      src: bodyReportPhotoMediaPath(photo.id),
      date: calendarDateKey(report.createdAt),
      weightKg: report.weightKg,
      waistCm: report.waistCm,
    });
  }
  const hasCustomStart = Number(settings?.hasStartPhoto ?? 0) === 1;
  const first = items[0] ?? null;
  const start = hasCustomStart
    ? { id: CUSTOM_START_PHOTO_ID, reportId: "", src: startPhotoMediaPath(), date: first?.date ?? calendarDateKey(), weightKg: first?.weightKg ?? null, waistCm: first?.waistCm ?? null }
    : first;
  const now = items.at(-1) ?? null;
  const waistReports = reports.filter((report) => report.waistCm != null);
  const firstWaist = waistReports.at(-1)?.waistCm ?? null;
  const lastWaist = waistReports[0]?.waistCm ?? null;
  return {
    items,
    start,
    now,
    hasCustomStart,
    weightDeltaKg: start?.weightKg != null && now?.weightKg != null ? Math.round((now.weightKg - start.weightKg) * 10) / 10 : null,
    waistDeltaCm: firstWaist != null && lastWaist != null ? Math.round((lastWaist - firstWaist) * 10) / 10 : start?.waistCm != null && now?.waistCm != null ? Math.round((now.waistCm - start.waistCm) * 10) / 10 : null,
  };
}
