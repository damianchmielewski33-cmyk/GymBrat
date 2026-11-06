import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { withDbRetry } from "@/db/with-retry";
import { weightLogs, workouts } from "@/db/schema";
import { type AnalyticsCardioSample, type AnalyticsStrengthSession, type MuscleSetContribution } from "@/lib/analytics";
import { computeAchievements } from "@/lib/achievements";
import { extractCardioExtrasFromSessionJson, parseCardioLog } from "@/lib/cardio-utils";
import { emptyProgressDietTrainingBlock, loadProgressDietTrainingBlock } from "@/lib/diet-training-weeks";
import { safeNormalizeExercises, safeParseCompletedSession } from "@/lib/workout-history";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { buildProgressIntensitySummary, summarizeSessionIntensity, type SessionIntensity } from "@/lib/intensity-analysis";
import { countableCardioMinutes, isCompletedStrengthSession, isStandaloneCardioLog, parseWorkoutSessionJson } from "@/lib/workout-cardio-attribution";
import type { ProgressTabId } from "@/lib/progress-tabs";
import { DAY_LABELS, mondayOfWeek, safeRound1, totalRepsFromExercises, volumeFromExercises, weekShortLabel } from "@/lib/progress-hub-helpers";
import type { ProgressHubData, ProgressVolumeSession, ProgressWeekDay } from "@/lib/progress-hub-types";
import { loadProgressHubRows } from "@/lib/progress-hub-queries";
import { foldExercisesIntoAggregates, buildStrengthViews, type ExAgg } from "@/lib/progress-hub-exercises";
import { createWeekBuckets, buildWeekSection } from "@/lib/progress-hub-week";
import { buildBodySection } from "@/lib/progress-hub-body";
import { buildGoalBars } from "@/lib/progress-hub-goals";
import { buildIntelligenceSection } from "@/lib/progress-hub-intelligence";

export type { ProgressExerciseRow, ProgressExerciseStatus, ProgressGoalBar, ProgressHubData, ProgressMaxItem, ProgressMeasureKey, ProgressMeasureRow, ProgressMetricKind, ProgressPhotoItem, ProgressPlanGroup, ProgressTempo, ProgressVolumeSession, ProgressWeekBar, ProgressWeekDay, ProgressWeekSummary, ProgressWeightPoint, VolumeTrendKind } from "@/lib/progress-hub-types";

export async function getProgressHubData(userId: string, scope: ProgressTabId | "all" = "all"): Promise<ProgressHubData> {
  await ensureCriticalSchema();
  return withDbRetry(
    () => loadProgressHubData(userId, scope),
    { attempts: 3, baseDelayMs: 280, label: `progress-${scope}` },
  );
}

async function loadProgressHubData(userId: string, scope: ProgressTabId | "all"): Promise<ProgressHubData> {
  const db = getDb();
  const wantsOverview = scope === "przeglad" || scope === "all";
  const wantsStrength = scope === "sila" || scope === "all";
  const wantsBody = scope === "sylwetka" || wantsOverview;
  const wantsWeek = scope === "tydzien" || scope === "all";
  const wantsIntelligence = scope !== "sylwetka";
  const today = calendarDateKey();
  const monday = mondayOfWeek(today);
  const sunday = addCalendarDays(monday, 6);
  const from180 = addCalendarDays(today, -180);


  const [settingsRow, planRows, workoutRows, bodyReports, userRow, checkinRows] =
    await loadProgressHubRows({ userId, today, from180, wantsStrength, wantsBody, wantsIntelligence, scope });

  const goals = parseFitnessGoalsJson(settingsRow?.fitnessGoalsJson ?? null);
  const weeklyTarget = goals.weeklySessionsTarget ?? 5;
  const cardioGoal = settingsRow?.weeklyCardioGoalMinutes ?? 150;

  // --- Strength aggregates ---

  const analyticsStrengthSessions: AnalyticsStrengthSession[] = [];
  const analyticsStrengthDates: string[] = [];
  const analyticsCardioSamples: AnalyticsCardioSample[] = [];
  const muscleContributions: MuscleSetContribution[] = [];
  const strengthDaySet = new Set<string>();

  const byExercise = new Map<string, ExAgg>();
  const volumeSessions: ProgressVolumeSession[] = [];
  const intensitySessions: SessionIntensity[] = [];
  const intensityByWeek = new Map<string, SessionIntensity[]>();
  let totalTonnageKg = 0;
  let totalStrengthSessions = 0;
  let firstWorkoutDate: string | null = null;
  const weeksWithGuided = new Set<string>();

  const { weekBuckets, weekFull, weekPartial } = createWeekBuckets(monday);


  const thisWeekDays: ProgressWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addCalendarDays(monday, i);
    thisWeekDays.push({
      date,
      label: DAY_LABELS[i]!,
      strength: false,
      cardio: false,
    });
  }
  const dayByDate = new Map(thisWeekDays.map((d) => [d.date, d]));

  let tonnageThisWeek = 0;
  let workoutsThisWeek = 0;

  const prevMonday = addCalendarDays(monday, -7);
  const daysIntoWeek = Math.max(
    0,
    Math.min(
      6,
      Math.round(
        (new Date(`${today}T12:00:00`).getTime() -
          new Date(`${monday}T12:00:00`).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    ),
  );
  const prevSameEnd = addCalendarDays(prevMonday, daysIntoWeek);

  // Process oldest→newest for first dates / volume trends within exercise
  const chronological = [...workoutRows].reverse();

  for (const row of chronological) {
    const session = parseWorkoutSessionJson(row.exercises);
    const parsed = safeParseCompletedSession(row.exercises);
    const cardioMin = countableCardioMinutes(session, row.cardioMinutes ?? 0);
    const strength = isCompletedStrengthSession(session);
    const weekMon = mondayOfWeek(row.date);
    const bucket = weekBuckets.get(weekMon);
    if (bucket) {
      bucket.cardioMinutes += cardioMin;
    }
    const fullAgg = weekFull.get(weekMon);
    const partialAgg = weekPartial.get(weekMon);
    const partialEnd = addCalendarDays(weekMon, daysIntoWeek);
    if (fullAgg && cardioMin > 0) {
      fullAgg.cardioMinutes += cardioMin;
    }
    if (partialAgg && cardioMin > 0 && row.date <= partialEnd) {
      partialAgg.cardioMinutes += cardioMin;
    }
    const day = dayByDate.get(row.date);
    if (day) {
      if (strength) day.strength = true;
      if (
        cardioMin > 0 ||
        isStandaloneCardioLog(session, row.cardioMinutes ?? 0)
      ) {
        day.cardio = true;
      }
    }

    // Cardio samples dla Analityki 2.0 (standalone + addon przy sile)
    if (
      cardioMin > 0 ||
      isStandaloneCardioLog(session, row.cardioMinutes ?? 0)
    ) {
      let rawJson: unknown = null;
      try {
        rawJson = JSON.parse(row.exercises);
      } catch {
        rawJson = null;
      }
      const extras = extractCardioExtrasFromSessionJson(
        rawJson,
        cardioMin,
        userRow?.age ?? null,
      );
      const log = parseCardioLog(rawJson);
      const title =
        log?.title ??
        (typeof (rawJson as { title?: unknown } | null)?.title === "string"
          ? (rawJson as { title: string }).title
          : null);
      analyticsCardioSamples.push({
        id: row.id,
        date: row.date,
        minutes: cardioMin,
        avgHr: extras.avgHr,
        maxHr: extras.maxHr,
        calories: extras.calories,
        distanceKm: extras.distanceKm,
        cardioType: extras.cardioType,
        effortScore: extras.effortScore,
        heartRateZone: extras.heartRateZone,
        title,
      });
    }

    if (!strength) continue;

    const ex = safeNormalizeExercises(
      parsed?.exercises ?? session?.exercises,
    );
    const vol = volumeFromExercises(ex);
    const sessionReps = totalRepsFromExercises(ex);
    if (vol <= 0 && sessionReps <= 0) continue;

    totalStrengthSessions += 1;
    totalTonnageKg += vol;
    if (!firstWorkoutDate) firstWorkoutDate = row.date;
    weeksWithGuided.add(weekMon);
    if (bucket) {
      bucket.workouts += 1;
      bucket.tonnageKg += vol;
    }
    if (fullAgg) {
      fullAgg.workouts += 1;
      fullAgg.tonnageKg += vol;
    }
    if (partialAgg && row.date <= partialEnd) {
      partialAgg.workouts += 1;
      partialAgg.tonnageKg += vol;
    }
    if (row.date >= monday && row.date <= sunday) {
      workoutsThisWeek += 1;
      tonnageThisWeek += vol;
    }

    const titleRaw = parsed?.title ?? session?.title;
    const title =
      typeof titleRaw === "string" && titleRaw.trim()
        ? titleRaw.trim()
        : "Trening";

    volumeSessions.push({
      id: row.id,
      date: row.date,
      title,
      volumeKg: vol,
      trend: "flat",
    });
    const sessionIntensity = summarizeSessionIntensity(ex);
    intensitySessions.push(sessionIntensity);
    analyticsStrengthSessions.push({
      id: row.id,
      date: row.date,
      tonnageKg: vol,
      hardSetPct:
        sessionIntensity.scoredSets > 0
          ? safeRound1(
              (sessionIntensity.hardSets / sessionIntensity.scoredSets) * 100,
            )
          : null,
      avgRpe: sessionIntensity.avgRpe,
      avgRir: sessionIntensity.avgRir,
      setCount: sessionIntensity.scoredSets,
    });
    analyticsStrengthDates.push(row.date);
    strengthDaySet.add(row.date);
    const weekIntensity = intensityByWeek.get(weekMon) ?? [];
    weekIntensity.push(sessionIntensity);
    intensityByWeek.set(weekMon, weekIntensity);
    if (fullAgg) {
      if (sessionIntensity.avgRpe != null) fullAgg.rpe.push(sessionIntensity.avgRpe);
      if (sessionIntensity.avgRir != null) fullAgg.rir.push(sessionIntensity.avgRir);
    }
    if (partialAgg && row.date <= partialEnd) {
      if (sessionIntensity.avgRpe != null) partialAgg.rpe.push(sessionIntensity.avgRpe);
      if (sessionIntensity.avgRir != null) partialAgg.rir.push(sessionIntensity.avgRir);
    }

    foldExercisesIntoAggregates({ ex, date: row.date, byExercise, muscleContributions });
  }

  const { last6, volumeCounts, volumeComparedCount, maxes, planGroups } = buildStrengthViews({ volumeSessions, byExercise, planRows, today });

  const lifetimeTotals = wantsOverview ? (await db
    .select({
      tonnageKg: sql<number>`coalesce(sum(${workouts.tonnageKg}), 0)`,
      sessions: sql<number>`count(case when ${workouts.tonnageKg} > 0 or (${workouts.tonnageKg} = 0 and ${workouts.cardioMinutes} = 0) then 1 end)`,
      firstDate: sql<string | null>`min(case when ${workouts.tonnageKg} > 0 or (${workouts.tonnageKg} = 0 and ${workouts.cardioMinutes} = 0) then ${workouts.date} end)`,
      pending: sql<number>`count(case when ${workouts.tonnageKg} is null then 1 end)`,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId)))[0] : null;
  // Keep the bounded-window values until the one-time legacy backfill has run.
  if (Number(lifetimeTotals?.pending ?? 0) === 0) {
    totalTonnageKg = Number(lifetimeTotals?.tonnageKg ?? 0);
    totalStrengthSessions = Number(lifetimeTotals?.sessions ?? 0);
    firstWorkoutDate = lifetimeTotals?.firstDate ?? firstWorkoutDate;
  }

  // --- Body / tempo ---
  const logRows = wantsBody ? await db
    .select({
      recordedAt: weightLogs.recordedAt,
      weightKg: weightLogs.weightKg,
    })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(asc(weightLogs.recordedAt))
    .limit(300) : [];

  const {
    weights, currentKg, deltaVsPrevKg, lastReportDate, reportCount, lastAvgKg, kgPerWeekLast6,
    photoItems, hasCustomStartPhoto, startKg, startDate, deltaFromStartKg, kgPerWeekFromStart,
    weeksFromStart, measures, targetWeightKg, startPhoto, nowPhoto, weightDeltaKg, waistDeltaCm,
  } = buildBodySection({ bodyReports, logRows, startPhotoDataUrl: settingsRow?.startPhotoDataUrl, goals, today });

  const { streakWeeks, last8, prevWeekTonnageKg, compareWeeks, weekCompare, daysLeft } = buildWeekSection({
    weeksWithGuided, weekBuckets, weekFull, weekPartial, monday, sunday, today, prevMonday, prevSameEnd, daysIntoWeek, weeklyTarget,
  });

  const goalBars = buildGoalBars({ goals, waistDeltaCm, totalTonnageKg, streakWeeks, currentKg, weights, byExercise, today });

  const oldestReport = bodyReports[bodyReports.length - 1];
  let firstReportDate: string | null = null;
  if (oldestReport?.createdAt) {
    const created =
      oldestReport.createdAt instanceof Date
        ? oldestReport.createdAt
        : new Date(oldestReport.createdAt);
    if (!Number.isNaN(created.getTime())) {
      firstReportDate = calendarDateKey(created);
    }
  }

  const achievements = computeAchievements({
    totalTonnageKg,
    totalStrengthSessions,
    streakWeeks,
    weightDeltaKg,
    waistDeltaCm,
    firstWorkoutDate,
    firstReportDate,
  });

  const intensity = buildProgressIntensitySummary(intensitySessions);

  const nutritionSettings = nutritionSettingsFromDbRow({
    trainingNutritionGoalsJson:
      settingsRow?.trainingNutritionGoalsJson ?? null,
    restNutritionGoalsJson: settingsRow?.restNutritionGoalsJson ?? null,
    nutritionDayTypesJson: settingsRow?.nutritionDayTypesJson ?? null,
  });
  const trainingByMonday = new Map(
    last8.map((w) => {
      const b = weekBuckets.get(w.monday);
      return [
        w.monday,
        {
          tonnageKg: b?.tonnageKg ?? 0,
          workouts: b?.workouts ?? 0,
          intensitySessions: intensityByWeek.get(w.monday) ?? [],
        },
      ] as const;
    }),
  );
  let dietTraining = emptyProgressDietTrainingBlock();
  if (wantsWeek) {
    try {
      dietTraining = await loadProgressDietTrainingBlock({
        userId,
        settings: nutritionSettings,
        today,
        mondaysOldestFirst: last8.map((w) => w.monday),
        weekLabel: weekShortLabel,
        trainingByMonday,
      });
    } catch {
      dietTraining = emptyProgressDietTrainingBlock();
    }
  }

  const { intelligence, cardioWeekSummary } = await buildIntelligenceSection({
    userId, today, wantsIntelligence, weeklyTarget, cardioGoal, strengthDaySet, checkinRows, deltaVsPrevKg,
    lastReportDate, dietTraining, userRow, currentKg, bodyReports, analyticsStrengthSessions,
    analyticsStrengthDates, analyticsCardioSamples, byExercise, muscleContributions,
  });

  return {
    strength: {
      maxes,
      volumeSessions: last6.slice().reverse(),
      volumeCounts,
      volumeComparedCount,
      intensity,
      planGroups,
      sinceDate: firstWorkoutDate,
      workoutCount: totalStrengthSessions,
    },
    body: {
      weights,
      tempo: {
        currentKg,
        startKg,
        kgPerWeekLast6,
        kgPerWeekFromStart,
        deltaVsPrevKg,
        weeksFromStart,
        deltaFromStartKg,
        lastReportDate,
        startDate,
        reportCount,
        lastAvgKg,
      },
      measures,
      targetWeightKg,
      goalType: goals.goalType ?? null,
      goalDeadline: goals.goalDeadline ?? null,
    },
    photos: {
      items: photoItems,
      start: startPhoto,
      now: nowPhoto,
      hasCustomStart: hasCustomStartPhoto,
      weightDeltaKg,
      waistDeltaCm,
    },
    week: {
      summary: {
        done: workoutsThisWeek,
        target: weeklyTarget,
        days: thisWeekDays,
        tonnageKg: safeRound1(tonnageThisWeek),
        prevWeekTonnageKg,
        cardioMinutes: cardioWeekSummary.minutes,
        cardioEntries: cardioWeekSummary.sessions,
        cardioGoalMinutes: cardioGoal,
        streakWeeks,
        monday,
        sunday,
        today,
        daysLeft,
        weekCompare,
        compareWeeks,
      },
      last8,
      dietTraining,
      goals: goalBars,
      exerciseTargets: goals.exerciseTargets ?? [],
      exerciseNameOptions: [...byExercise.values()]
        .sort((a, b) => b.points.length - a.points.length)
        .slice(0, 60)
        .map((e) => e.name),
      achievements,
    },
    intelligence,
  };
}
