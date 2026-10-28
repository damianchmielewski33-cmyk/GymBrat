import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userSettings, weightLogs } from "@/db/schema";
import { getBodyReports } from "@/lib/body-reports";
import { frontBodyReportPhoto } from "@/lib/body-report-photo-slots";
import { computeWeightTrendKgPerWeek } from "@/lib/analytics/weight-trend";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { resolveProgressStart } from "@/lib/progress-metrics/start";
import type { ProgressHubData, ProgressMeasureKey, ProgressMeasureRow, ProgressWeightPoint } from "@/lib/progress-hub";

function round1(value: number) { return Math.round(value * 10) / 10; }

/** Body tab loader. It reads only body reports, weight logs, and the user's target weight. */
export async function loadProgressBodyMetrics(userId: string): Promise<ProgressHubData["body"]> {
  await ensureCriticalSchema();
  const db = getDb();
  const [reports, logs, settings] = await Promise.all([
    getBodyReports(userId, { photos: "meta" }),
    db.select({ recordedAt: weightLogs.recordedAt, weightKg: weightLogs.weightKg })
      .from(weightLogs).where(eq(weightLogs.userId, userId)).orderBy(asc(weightLogs.recordedAt)).limit(300),
    db.select({
      fitnessGoalsJson: userSettings.fitnessGoalsJson,
      hasStartPhoto: sql<number>`CASE WHEN ${userSettings.startPhotoDataUrl} IS NOT NULL AND length(trim(${userSettings.startPhotoDataUrl})) > 0 THEN 1 ELSE 0 END`,
    })
      .from(userSettings).where(eq(userSettings.userId, userId)).limit(1).then((rows) => rows[0] ?? null),
  ]);
  const byDay = new Map<string, number>();
  for (const report of [...reports].reverse()) {
    if (report.weightKg == null || report.weightKg <= 0) continue;
    byDay.set(calendarDateKey(report.createdAt), round1(report.weightKg));
  }
  for (const row of logs) {
    const date = calendarDateKey(new Date(row.recordedAt));
    if (!byDay.has(date) && Number(row.weightKg) > 0) byDay.set(date, round1(Number(row.weightKg)));
  }
  const weights: ProgressWeightPoint[] = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, kg]) => ({ date, kg }));
  const firstWithPhoto = [...reports]
    .reverse()
    .find((r) => Boolean(frontBodyReportPhoto(r.photos)?.id));
  const progressStart = resolveProgressStart({
    weights,
    hasCustomStartPhoto: Number(settings?.hasStartPhoto ?? 0) === 1,
    customStartPhoto:
      Number(settings?.hasStartPhoto ?? 0) === 1
        ? {
            date: firstWithPhoto
              ? calendarDateKey(firstWithPhoto.createdAt)
              : weights[0]?.date ?? calendarDateKey(),
            weightKg: firstWithPhoto?.weightKg ?? null,
            waistCm: firstWithPhoto?.waistCm ?? null,
          }
        : null,
    firstReportWithPhoto: firstWithPhoto
      ? {
          date: calendarDateKey(firstWithPhoto.createdAt),
          weightKg: firstWithPhoto.weightKg,
          waistCm: firstWithPhoto.waistCm,
        }
      : null,
  });
  const startKg = progressStart.weightKg;
  const currentKg = weights.at(-1)?.kg ?? null;
  const prevKg = weights.at(-2)?.kg ?? null;
  const deltaFromStartKg = startKg != null && currentKg != null ? round1(currentKg - startKg) : null;
  const startDate = progressStart.date ?? weights[0]?.date ?? null;
  const days =
    weights.length > 1 && startDate
      ? Math.max(
          1,
          (Date.parse(`${weights.at(-1)!.date}T12:00:00Z`) -
            Date.parse(`${startDate}T12:00:00Z`)) /
            86_400_000,
        )
      : 0;
  const lastSixWeeks = weights.filter((point) => point.date >= addCalendarDays(calendarDateKey(), -42));
  const recent = weights.slice(-3);
  const goals = parseFitnessGoalsJson(settings?.fitnessGoalsJson);
  const measureDefs: { key: ProgressMeasureKey; label: string; pick: (row: (typeof reports)[number]) => number | null; lowerIsBetter: boolean }[] = [
    { key: "waist", label: "Pas", pick: (row) => row.waistCm, lowerIsBetter: true },
    { key: "thigh", label: "Udo", pick: (row) => row.thighCm, lowerIsBetter: true },
    { key: "chest", label: "Klatka", pick: (row) => row.chestCm, lowerIsBetter: false },
    { key: "arm", label: "Ramię", pick: (row) => row.armCm, lowerIsBetter: false },
  ];
  const measures: ProgressMeasureRow[] = measureDefs.map((def) => {
    const values = [...reports].reverse().map(def.pick).filter((value): value is number => value != null && Number.isFinite(value) && value > 0).map(round1);
    const currentCm = values.at(-1) ?? null;
    const firstCm = values[0] ?? null;
    return { key: def.key, label: def.label, currentCm, deltaFromStartCm: currentCm != null && firstCm != null ? round1(currentCm - firstCm) : null, spark: values.slice(-12), lowerIsBetter: def.lowerIsBetter };
  });
  return {
    weights,
    tempo: {
      currentKg,
      startKg,
      kgPerWeekLast6: computeWeightTrendKgPerWeek(lastSixWeeks),
      kgPerWeekFromStart: days > 0 && startKg != null && currentKg != null ? round1(((currentKg - startKg) / days) * 7) : null,
      deltaVsPrevKg: currentKg != null && prevKg != null ? round1(currentKg - prevKg) : null,
      weeksFromStart: days > 0 ? round1(days / 7) : null,
      deltaFromStartKg,
      lastReportDate: weights.at(-1)?.date ?? null,
      startDate,
      reportCount: weights.length,
      lastAvgKg: recent.length ? round1(recent.reduce((sum, point) => sum + point.kg, 0) / recent.length) : null,
    },
    measures,
    targetWeightKg: goals.targetWeightKg != null ? round1(goals.targetWeightKg) : null,
  };
}
