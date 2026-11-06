import { getBodyReports } from "@/lib/body-reports";
import { computeWeightTrendKgPerWeek } from "@/lib/analytics/weight-trend";
import { resolveProgressStart } from "@/lib/progress-metrics/start";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { frontBodyReportPhoto } from "@/lib/body-report-photo-slots";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import { bodyReportPhotoMediaPath, startPhotoMediaPath } from "@/lib/user-photo-media";
import { safeRound1 } from "@/lib/progress-hub-helpers";
import type { ProgressMeasureKey, ProgressMeasureRow, ProgressPhotoItem, ProgressWeightPoint } from "@/lib/progress-hub-types";

/** Sekcja sylwetki Postępów (Z88a). */
/** Waga, tempo, pomiary i zdjęcia startowe/obecne. */
export function buildBodySection(args: {
  bodyReports: Awaited<ReturnType<typeof getBodyReports>>;
  logRows: Array<{ recordedAt: Date | number | string; weightKg: number | string }>;
  startPhotoDataUrl: string | null | undefined;
  goals: ReturnType<typeof parseFitnessGoalsJson>;
  today: string;
}) {
  const { bodyReports, logRows, startPhotoDataUrl, goals, today } = args;
  const weightByDay = new Map<string, number>();
  for (const r of [...bodyReports].reverse()) {
    if (r.weightKg != null && r.weightKg > 0 && r.createdAt) {
      const created =
        r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
      if (!Number.isNaN(created.getTime())) {
        weightByDay.set(calendarDateKey(created), safeRound1(r.weightKg));
      }
    }
  }

  for (const w of logRows) {
    const recorded = new Date(w.recordedAt);
    if (Number.isNaN(recorded.getTime())) continue;
    const key = calendarDateKey(recorded);
    if (!weightByDay.has(key) && Number(w.weightKg) > 0) {
      weightByDay.set(key, safeRound1(Number(w.weightKg)));
    }
  }

  const weights: ProgressWeightPoint[] = [...weightByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, kg]) => ({ date, kg }));

  const currentKg = weights.length ? weights[weights.length - 1]!.kg : null;
  const prevKg = weights.length >= 2 ? weights[weights.length - 2]!.kg : null;
  const deltaVsPrevKg =
    currentKg != null && prevKg != null ? safeRound1(currentKg - prevKg) : null;
  const lastReportDate = weights.length
    ? weights[weights.length - 1]!.date
    : null;
  const reportCount = weights.length;
  let lastAvgKg: number | null = null;
  if (weights.length) {
    const from = Math.max(0, weights.length - 3);
    const slice = weights.slice(from);
    lastAvgKg = safeRound1(
      slice.reduce((s, p) => s + p.kg, 0) / slice.length,
    );
  }

  let kgPerWeekLast6: number | null = null;
  if (weights.length >= 2) {
    const from = addCalendarDays(today, -42);
    const slice = weights.filter((p) => p.date >= from);
    kgPerWeekLast6 = computeWeightTrendKgPerWeek(slice);
  }

  // --- Photos (meta only here; full reveal stays in loadProgressPhotoMetrics) ---
  const photoItems: ProgressPhotoItem[] = [];
  for (const r of [...bodyReports].reverse()) {
    if (!r.createdAt) continue;
    const created =
      r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const date = calendarDateKey(created);
    const front = frontBodyReportPhoto(r.photos);
    if (!front?.id) continue;
    photoItems.push({
      id: front.id,
      reportId: r.id,
      src: bodyReportPhotoMediaPath(front.id),
      date,
      weightKg: r.weightKg,
      waistCm: r.waistCm,
    });
  }
  const hasCustomStartPhoto = Boolean(
    startPhotoDataUrl?.trim(),
  );
  const firstReportPhoto = photoItems[0] ?? null;
  const progressStart = resolveProgressStart({
    weights,
    hasCustomStartPhoto,
    customStartPhoto: hasCustomStartPhoto
      ? {
          date: firstReportPhoto?.date ?? today,
          weightKg: firstReportPhoto?.weightKg ?? null,
          waistCm: firstReportPhoto?.waistCm ?? null,
        }
      : null,
    firstReportWithPhoto: firstReportPhoto
      ? {
          date: firstReportPhoto.date,
          weightKg: firstReportPhoto.weightKg,
          waistCm: firstReportPhoto.waistCm,
        }
      : null,
  });
  const startKg = progressStart.weightKg;
  const startDate = progressStart.date;
  const deltaFromStartKg =
    startKg != null && currentKg != null
      ? safeRound1(currentKg - startKg)
      : null;

  let kgPerWeekFromStart: number | null = null;
  let weeksFromStart: number | null = null;
  if (weights.length >= 2 && startKg != null && currentKg != null && startDate) {
    const b = weights[weights.length - 1]!;
    const days = Math.max(
      1,
      (new Date(`${b.date}T12:00:00`).getTime() -
        new Date(`${startDate}T12:00:00`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    weeksFromStart = safeRound1(days / 7);
    kgPerWeekFromStart = safeRound1(((currentKg - startKg) / days) * 7);
  }

  const measureDefs: Array<{
    key: ProgressMeasureKey;
    label: string;
    pick: (r: (typeof bodyReports)[number]) => number | null;
    lowerIsBetter: boolean;
  }> = [
    { key: "waist", label: "Pas", pick: (r) => r.waistCm, lowerIsBetter: true },
    { key: "thigh", label: "Udo", pick: (r) => r.thighCm, lowerIsBetter: true },
    {
      key: "chest",
      label: "Klatka",
      pick: (r) => r.chestCm,
      lowerIsBetter: false,
    },
    { key: "arm", label: "Ramię", pick: (r) => r.armCm, lowerIsBetter: false },
  ];

  const chronologicalReports = [...bodyReports].reverse();
  const measures: ProgressMeasureRow[] = measureDefs.map((def) => {
    const series: number[] = [];
    for (const r of chronologicalReports) {
      const v = def.pick(r);
      if (v != null && Number.isFinite(v) && v > 0) series.push(safeRound1(v));
    }
    const currentCm = series.length ? series[series.length - 1]! : null;
    const startCm = series.length ? series[0]! : null;
    const deltaFromStartCm =
      currentCm != null && startCm != null
        ? safeRound1(currentCm - startCm)
        : null;
    return {
      key: def.key,
      label: def.label,
      currentCm,
      deltaFromStartCm,
      spark: series.slice(-12),
      lowerIsBetter: def.lowerIsBetter,
    };
  });

  const targetWeightKg =
    typeof goals.targetWeightKg === "number" &&
    Number.isFinite(goals.targetWeightKg) &&
    goals.targetWeightKg > 0
      ? safeRound1(goals.targetWeightKg)
      : null;

  const startPhoto: ProgressPhotoItem | null = hasCustomStartPhoto
    ? {
        id: CUSTOM_START_PHOTO_ID,
        reportId: "",
        src: startPhotoMediaPath(),
        date: progressStart.date ?? today,
        weightKg: progressStart.weightKg,
        waistCm: progressStart.waistCm,
      }
    : firstReportPhoto;
  const nowPhoto = photoItems.length ? photoItems[photoItems.length - 1]! : null;
  const weightDeltaKg =
    progressStart.weightKg != null && currentKg != null
      ? safeRound1(currentKg - progressStart.weightKg)
      : startPhoto?.weightKg != null && nowPhoto?.weightKg != null
        ? safeRound1(nowPhoto.weightKg - startPhoto.weightKg)
        : null;
  const waistReports = bodyReports.filter((r) => r.waistCm != null);
  const firstWaist =
    progressStart.waistCm ??
    (waistReports.length
      ? waistReports[waistReports.length - 1]!.waistCm
      : null);
  const lastWaist = waistReports[0]?.waistCm ?? null;
  const waistDeltaCm =
    firstWaist != null && lastWaist != null
      ? safeRound1(lastWaist - firstWaist)
      : startPhoto?.waistCm != null && nowPhoto?.waistCm != null
        ? safeRound1(nowPhoto.waistCm - startPhoto.waistCm)
        : null;
  return {
    weights, currentKg, deltaVsPrevKg, lastReportDate, reportCount, lastAvgKg, kgPerWeekLast6,
    photoItems, hasCustomStartPhoto, startKg, startDate, deltaFromStartKg, kgPerWeekFromStart,
    weeksFromStart, measures, targetWeightKg, startPhoto, nowPhoto, weightDeltaKg, waistDeltaCm,
  };
}
