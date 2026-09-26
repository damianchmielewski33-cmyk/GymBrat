import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bodyReportPhotos,
  bodyReports,
  trainingSessions,
  userSettings,
  users,
  weightLogs,
  workoutPlans,
  workouts,
} from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import { getHomeStats } from "@/lib/home-stats";
import {
  addCalendarDays,
  calendarDateKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";
import { getMealLogAggregatesForDates } from "@/lib/meal-logs";
import {
  nutritionSettingsFromDbRow,
  resolveProfileDayGoals,
} from "@/lib/nutrition-goals";
import { countDistinctWorkoutDaysInRange } from "@/lib/weekly-sessions";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";

export type HomeStartWeightPoint = { date: string; kg: number };
export type HomeStartWaistPoint = { date: string; cm: number };
export type HomeStartSpark = { date: string; value: number };
export type HomeStartMacroPoint = {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  remainingKcal: number | null;
};

/** Pozostałe B/W/T do spożycia w bieżącym dniu względem celu z profilu. */
export type HomeStartTodayMacros = {
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
  proteinRemaining: number | null;
  carbsRemaining: number | null;
  fatRemaining: number | null;
};

/** Sumaryczne B/W/T w bieżącym tygodniu (pon–niedz.) vs suma celów dziennych. */
export type HomeStartWeekMacros = HomeStartTodayMacros;

export type HomeStartDashboard = {
  firstName: string | null;
  lastName: string | null;
  nextWorkout: {
    planId: string;
    planName: string;
    exerciseCount: number;
    lastWorkoutDate: string | null;
    exerciseNames: string[];
    firstTime: boolean;
  } | null;
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  cardioWeeklyGoal: number;
  /** Kolejne tygodnie kalendarzowe (pon–niedz.) z ≥1 treningiem. */
  workoutStreakWeeks: number;
  daysInProgram: number | null;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
  currentWeightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  macroSeries: HomeStartMacroPoint[];
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
  formToday: {
    energy: number | null;
    sleep: number | null;
    digestion: number | null;
    training: number | null;
  };
  compliance: {
    dietPct: number | null;
    trainingPct: number | null;
    cardioPct: number | null;
    lastN: number;
    doneN: number;
    historyWindow: number;
    dietHistory: Array<"tak" | "nie" | null>;
    trainingHistory: Array<"tak" | "nie" | null>;
    cardioHistory: Array<"tak" | "nie" | null>;
  };
  transformation: {
    firstPhotoUrl: string | null;
    latestPhotoUrl: string | null;
    latestPhotoDate: string | null;
  };
  dimensions: {
    weightKg: number | null;
    waistCm: number | null;
    armCm: number | null;
    abdomenCm: number | null;
    chestCm: number | null;
    thighCm: number | null;
    waistSpark: HomeStartSpark[];
    thighSpark: HomeStartSpark[];
    chestSpark: HomeStartSpark[];
    armSpark: HomeStartSpark[];
  };
};

async function sumCardioMinutesInCalendarWeek(
  userId: string,
  weekKeys: string[],
): Promise<number> {
  const db = getDb();
  const start = weekKeys[0]!;
  const end = weekKeys[weekKeys.length - 1]!;

  const [fromWorkouts] = await db
    .select({
      total: sql<number>`coalesce(sum(${workouts.cardioMinutes}), 0)`,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, start),
        lte(workouts.date, end),
      ),
    );

  const weekStart = new Date(`${start}T00:00:00`);
  const weekEnd = new Date(`${end}T23:59:59`);

  const [fromLegacy] = await db
    .select({
      total: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, weekStart),
        lte(trainingSessions.startedAt, weekEnd),
      ),
    );

  return Number(fromWorkouts?.total ?? 0) + Number(fromLegacy?.total ?? 0);
}

async function getNextWorkoutPlan(userId: string) {
  const db = getDb();

  const lastByPlan = await db
    .select({
      planId: workouts.workoutPlanId,
      lastDate: sql<string>`max(${workouts.date})`.as("last_date"),
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), sql`${workouts.workoutPlanId} is not null`))
    .groupBy(workouts.workoutPlanId);

  const lastMap = new Map<string, string>();
  for (const row of lastByPlan) {
    if (row.planId) lastMap.set(row.planId, row.lastDate);
  }

  const rows = await db
    .select({
      id: workoutPlans.id,
      planJson: workoutPlans.planJson,
      updatedAt: workoutPlans.updatedAt,
    })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, userId))
    .orderBy(desc(workoutPlans.updatedAt));

  type Candidate = {
    planId: string;
    planName: string;
    exerciseCount: number;
    lastWorkoutDate: string | null;
    exerciseNames: string[];
    updatedAt: string;
  };

  const candidates: Candidate[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.planJson) as unknown;
      const plan = normalizeWorkoutPlan(parsed);
      if (!plan) continue;
      candidates.push({
        planId: row.id,
        planName: plan.planName?.trim() || "Plan treningowy",
        exerciseCount: plan.exercises.length,
        lastWorkoutDate: lastMap.get(row.id) ?? null,
        exerciseNames: plan.exercises
          .map((ex) => String(ex.name ?? "").trim())
          .filter(Boolean)
          .slice(0, 8),
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch {
      // pomijamy uszkodzone plany
    }
  }

  if (candidates.length === 0) return null;

  // Następny = najdawniej trenowany / nigdy nie trenowany.
  candidates.sort((a, b) => {
    if (a.lastWorkoutDate && b.lastWorkoutDate) {
      return a.lastWorkoutDate.localeCompare(b.lastWorkoutDate);
    }
    if (!a.lastWorkoutDate && b.lastWorkoutDate) return -1;
    if (a.lastWorkoutDate && !b.lastWorkoutDate) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const next = candidates[0]!;
  return {
    planId: next.planId,
    planName: next.planName,
    exerciseCount: next.exerciseCount,
    lastWorkoutDate: next.lastWorkoutDate,
    exerciseNames: next.exerciseNames,
    firstTime: !next.lastWorkoutDate,
  };
}

/** Scala wagi z ważenia i raportów ciała (ten sam dzień — wygrywa późniejszy wpis). */
export function mergeWeightPointsByDay(
  entries: Array<{ date: string; kg: number; atMs: number }>,
): HomeStartWeightPoint[] {
  const byDay = new Map<string, { kg: number; atMs: number }>();
  for (const e of entries) {
    if (!e.date || !Number.isFinite(e.kg) || e.kg <= 0) continue;
    const kg = Math.round(e.kg * 10) / 10;
    const prev = byDay.get(e.date);
    if (!prev || e.atMs >= prev.atMs) {
      byDay.set(e.date, { kg, atMs: e.atMs });
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, kg: v.kg }));
}

async function getMergedWeightEntries(
  userId: string,
  since?: Date,
): Promise<Array<{ date: string; kg: number; atMs: number }>> {
  const db = getDb();
  const weightWhere = since
    ? and(eq(weightLogs.userId, userId), gte(weightLogs.recordedAt, since))
    : eq(weightLogs.userId, userId);
  const reportWhere = since
    ? and(eq(bodyReports.userId, userId), gte(bodyReports.createdAt, since))
    : eq(bodyReports.userId, userId);

  const [logRows, reportRows] = await Promise.all([
    db
      .select({
        recordedAt: weightLogs.recordedAt,
        weightKg: weightLogs.weightKg,
      })
      .from(weightLogs)
      .where(weightWhere)
      .orderBy(asc(weightLogs.recordedAt)),
    db
      .select({
        createdAt: bodyReports.createdAt,
        weightKg: bodyReports.weightKg,
      })
      .from(bodyReports)
      .where(reportWhere)
      .orderBy(asc(bodyReports.createdAt)),
  ]);

  const entries: Array<{ date: string; kg: number; atMs: number }> = [];
  for (const r of logRows) {
    const d =
      r.recordedAt instanceof Date ? r.recordedAt : new Date(Number(r.recordedAt));
    if (Number.isNaN(d.getTime())) continue;
    entries.push({
      date: calendarDateKey(d),
      kg: Number(r.weightKg),
      atMs: d.getTime(),
    });
  }
  for (const r of reportRows) {
    if (r.weightKg == null) continue;
    const d =
      r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt));
    if (Number.isNaN(d.getTime())) continue;
    entries.push({
      date: calendarDateKey(d),
      kg: Number(r.weightKg),
      atMs: d.getTime(),
    });
  }
  return entries;
}

async function getWeightSeries(userId: string): Promise<HomeStartWeightPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - 370);
  const entries = await getMergedWeightEntries(userId, since);
  return mergeWeightPointsByDay(entries);
}

async function getWeightFromStart(userId: string): Promise<{
  currentKg: number | null;
  deltaKg: number | null;
  deltaFromPreviousKg: number | null;
}> {
  const series = mergeWeightPointsByDay(await getMergedWeightEntries(userId));
  if (series.length === 0) {
    return { currentKg: null, deltaKg: null, deltaFromPreviousKg: null };
  }
  const firstKg = series[0]!.kg;
  const lastKg = series[series.length - 1]!.kg;
  const prevKg = series.length >= 2 ? series[series.length - 2]!.kg : null;

  return {
    currentKg: lastKg,
    deltaKg: Math.round((lastKg - firstKg) * 10) / 10,
    deltaFromPreviousKg:
      prevKg != null ? Math.round((lastKg - prevKg) * 10) / 10 : null,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function remainingOrNull(goal: number | null | undefined, consumed: number): number | null {
  if (goal == null || !Number.isFinite(goal)) return null;
  return round1(goal - consumed);
}

async function getMacroSeriesAndToday(
  userId: string,
): Promise<{
  series: HomeStartMacroPoint[];
  today: HomeStartTodayMacros;
  week: HomeStartWeekMacros;
}> {
  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const days = 14;
  const keySet = new Set<string>(weekKeys);
  for (let i = days - 1; i >= 0; i--) {
    keySet.add(addCalendarDays(todayKey, -i));
  }
  const keys = [...keySet].sort();

  const db = getDb();
  const [settingsRow, aggregates] = await Promise.all([
    db
      .select({
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getMealLogAggregatesForDates(userId, keys),
  ]);

  const settings = nutritionSettingsFromDbRow({
    trainingNutritionGoalsJson: settingsRow?.trainingNutritionGoalsJson ?? null,
    restNutritionGoalsJson: settingsRow?.restNutritionGoalsJson ?? null,
    nutritionDayTypesJson: settingsRow?.nutritionDayTypesJson ?? null,
  });

  const series = keys
    .filter((date) => {
      // series: ostatnie 14 dni kalendarzowych
      const oldest = addCalendarDays(todayKey, -(days - 1));
      return date >= oldest && date <= todayKey;
    })
    .map((date) => {
      const agg = aggregates[date];
      const protein = round1(agg?.protein ?? 0);
      const carbs = round1(agg?.carbs ?? 0);
      const fat = round1(agg?.fat ?? 0);
      const consumed = Math.round(agg?.calories ?? 0);
      const goals = resolveProfileDayGoals(settings, date);
      const remainingKcal =
        goals != null ? Math.round(goals.caloriesGoal - consumed) : null;
      return { date, protein, carbs, fat, remainingKcal };
    });

  const todayAgg = aggregates[todayKey];
  const proteinConsumed = round1(todayAgg?.protein ?? 0);
  const carbsConsumed = round1(todayAgg?.carbs ?? 0);
  const fatConsumed = round1(todayAgg?.fat ?? 0);
  const todayGoals = resolveProfileDayGoals(settings, todayKey);
  const proteinGoal = todayGoals?.macroGoals.protein ?? null;
  const carbsGoal = todayGoals?.macroGoals.carbs ?? null;
  const fatGoal = todayGoals?.macroGoals.fat ?? null;

  let weekProtein = 0;
  let weekCarbs = 0;
  let weekFat = 0;
  let weekProteinGoal = 0;
  let weekCarbsGoal = 0;
  let weekFatGoal = 0;
  let weekGoalDays = 0;
  for (const date of weekKeys) {
    const agg = aggregates[date];
    weekProtein += agg?.protein ?? 0;
    weekCarbs += agg?.carbs ?? 0;
    weekFat += agg?.fat ?? 0;
    const goals = resolveProfileDayGoals(settings, date);
    if (goals?.macroGoals) {
      weekProteinGoal += goals.macroGoals.protein;
      weekCarbsGoal += goals.macroGoals.carbs;
      weekFatGoal += goals.macroGoals.fat;
      weekGoalDays += 1;
    }
  }
  const hasWeekGoals = weekGoalDays > 0;
  const wProtein = round1(weekProtein);
  const wCarbs = round1(weekCarbs);
  const wFat = round1(weekFat);
  const wProteinGoal = hasWeekGoals ? round1(weekProteinGoal) : null;
  const wCarbsGoal = hasWeekGoals ? round1(weekCarbsGoal) : null;
  const wFatGoal = hasWeekGoals ? round1(weekFatGoal) : null;

  return {
    series,
    today: {
      proteinConsumed,
      carbsConsumed,
      fatConsumed,
      proteinGoal,
      carbsGoal,
      fatGoal,
      proteinRemaining: remainingOrNull(proteinGoal, proteinConsumed),
      carbsRemaining: remainingOrNull(carbsGoal, carbsConsumed),
      fatRemaining: remainingOrNull(fatGoal, fatConsumed),
    },
    week: {
      proteinConsumed: wProtein,
      carbsConsumed: wCarbs,
      fatConsumed: wFat,
      proteinGoal: wProteinGoal,
      carbsGoal: wCarbsGoal,
      fatGoal: wFatGoal,
      proteinRemaining: remainingOrNull(wProteinGoal, wProtein),
      carbsRemaining: remainingOrNull(wCarbsGoal, wCarbs),
      fatRemaining: remainingOrNull(wFatGoal, wFat),
    },
  };
}

/** Liczba kolejnych tygodni (pon–niedz.) z ≥1 dniem treningowym. */
export function consecutiveWorkoutWeeksFromKeys(
  todayKey: string,
  workoutKeys: Set<string>,
  lookbackWeeks = 52,
): number {
  let streak = 0;
  let weekOffset = 0;
  let skippedEmptyCurrent = false;

  while (weekOffset < lookbackWeeks) {
    const anchor = addCalendarDays(todayKey, -weekOffset * 7);
    const weekKeys = weekDateKeysMondayFirst(anchor);
    const hasWorkout = weekKeys.some((k) => workoutKeys.has(k));
    if (!hasWorkout) {
      if (weekOffset === 0 && !skippedEmptyCurrent) {
        skippedEmptyCurrent = true;
        weekOffset += 1;
        continue;
      }
      break;
    }
    streak += 1;
    weekOffset += 1;
  }
  return streak;
}

async function getWorkoutStreakWeeks(
  userId: string,
  todayKey: string,
): Promise<number> {
  const db = getDb();
  const fromKey = addCalendarDays(todayKey, -(52 * 7));
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, fromKey),
        lte(workouts.date, todayKey),
      ),
    );
  const keys = new Set(rows.map((r) => r.date).filter(Boolean));
  return consecutiveWorkoutWeeksFromKeys(todayKey, keys);
}

async function getProgramStartAndReportCount(userId: string): Promise<{
  daysInProgram: number | null;
  reportCount: number;
  firstReportAt: Date | null;
}> {
  const db = getDb();
  const [[countRow], [firstReport]] = await Promise.all([
    db
      .select({ n: count() })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId)),
    db
      .select({ createdAt: bodyReports.createdAt })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId))
      .orderBy(asc(bodyReports.createdAt), asc(bodyReports.id))
      .limit(1),
  ]);

  const reportCount = Number(countRow?.n ?? 0);
  const firstReportAt = firstReport?.createdAt
    ? new Date(firstReport.createdAt)
    : null;
  const daysInProgram =
    firstReportAt && !Number.isNaN(firstReportAt.getTime())
      ? Math.max(
          1,
          Math.floor((Date.now() - firstReportAt.getTime()) / 86_400_000) + 1,
        )
      : null;

  return { daysInProgram, reportCount, firstReportAt };
}

async function getTransformationPhotos(userId: string): Promise<{
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
}> {
  const db = getDb();
  const reports = await db
    .select({ id: bodyReports.id, createdAt: bodyReports.createdAt })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(asc(bodyReports.createdAt), asc(bodyReports.id));

  if (reports.length === 0) {
    return { firstPhotoUrl: null, latestPhotoUrl: null, latestPhotoDate: null };
  }

  const reportIds = reports.map((r) => r.id);
  const photos = await db
    .select({
      reportId: bodyReportPhotos.reportId,
      dataUrl: bodyReportPhotos.dataUrl,
      createdAt: bodyReportPhotos.createdAt,
    })
    .from(bodyReportPhotos)
    .where(
      reportIds.length === 1
        ? eq(bodyReportPhotos.reportId, reportIds[0]!)
        : inArray(bodyReportPhotos.reportId, reportIds),
    )
    .orderBy(asc(bodyReportPhotos.createdAt), asc(bodyReportPhotos.id));

  if (photos.length === 0) {
    return { firstPhotoUrl: null, latestPhotoUrl: null, latestPhotoDate: null };
  }

  const photosByReport = new Map<string, string[]>();
  for (const p of photos) {
    const url = maybeDecryptSensitiveField(p.dataUrl);
    if (!url) continue;
    const arr = photosByReport.get(p.reportId) ?? [];
    arr.push(url);
    photosByReport.set(p.reportId, arr);
  }

  let firstPhotoUrl: string | null = null;
  let latestPhotoUrl: string | null = null;
  let latestPhotoDate: string | null = null;
  for (const r of reports) {
    const urls = photosByReport.get(r.id);
    if (!urls?.length) continue;
    if (!firstPhotoUrl) firstPhotoUrl = urls[0]!;
    latestPhotoUrl = urls[0]!;
    latestPhotoDate = calendarDateKey(new Date(r.createdAt));
  }

  return { firstPhotoUrl, latestPhotoUrl, latestPhotoDate };
}

async function getLatestDimensions(userId: string) {
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

function reportDateKey(d: Date): string {
  return calendarDateKey(d);
}

function compliancePct(values: Array<string | null>): number | null {
  const known = values.filter((v) => v === "tak" || v === "nie");
  if (known.length === 0) return null;
  const yes = known.filter((v) => v === "tak").length;
  return Math.round((yes / known.length) * 100);
}

function toComplianceSlot(v: string | null | undefined): "tak" | "nie" | null {
  if (v === "tak" || v === "nie") return v;
  return null;
}

/** Ostatnie `windowSize` raportów, od najstarszego do najnowszego (lewo → prawo). */
function complianceHistoryWindow(
  valuesNewestFirst: Array<string | null>,
  windowSize: number,
): Array<"tak" | "nie" | null> {
  const slice = valuesNewestFirst.slice(0, windowSize);
  return slice.map(toComplianceSlot).reverse();
}

const COMPLIANCE_HISTORY_WINDOW = 24;

async function getReportInsights(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      createdAt: bodyReports.createdAt,
      waistCm: bodyReports.waistCm,
      thighCm: bodyReports.thighCm,
      chestCm: bodyReports.chestCm,
      armCm: bodyReports.armCm,
      dayEnergy: bodyReports.dayEnergy,
      sleepQuality: bodyReports.sleepQuality,
      digestionScore: bodyReports.digestionScore,
      trainingEnergy: bodyReports.trainingEnergy,
      dietCompliance: bodyReports.dietCompliance,
      trainingCompliance: bodyReports.trainingCompliance,
      cardioCompliance: bodyReports.cardioCompliance,
    })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
    .limit(45);

  const latest = rows[0] ?? null;
  const daysSinceLastReport =
    latest?.createdAt != null
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000,
          ),
        )
      : null;

  const chronological = [...rows].reverse();
  const spark = (
    pick: (r: (typeof chronological)[number]) => number | null,
  ): HomeStartSpark[] =>
    chronological
      .map((r) => {
        const value = pick(r);
        if (value == null || !Number.isFinite(value)) return null;
        return { date: reportDateKey(new Date(r.createdAt)), value };
      })
      .filter((p): p is HomeStartSpark => p != null);

  const dietValues = rows.map((r) => r.dietCompliance);
  const trainingValues = rows.map((r) => r.trainingCompliance);
  const cardioValues = rows.map((r) => r.cardioCompliance);

  return {
    daysSinceLastReport,
    formToday: {
      energy: latest?.dayEnergy ?? null,
      sleep: latest?.sleepQuality ?? null,
      digestion: latest?.digestionScore ?? null,
      training: latest?.trainingEnergy ?? null,
    },
    compliance: {
      dietPct: compliancePct(dietValues),
      trainingPct: compliancePct(trainingValues),
      cardioPct: compliancePct(cardioValues),
      lastN: rows.length,
      doneN: rows.filter((r) => r.dietCompliance === "tak").length,
      historyWindow: COMPLIANCE_HISTORY_WINDOW,
      dietHistory: complianceHistoryWindow(dietValues, COMPLIANCE_HISTORY_WINDOW),
      trainingHistory: complianceHistoryWindow(
        trainingValues,
        COMPLIANCE_HISTORY_WINDOW,
      ),
      cardioHistory: complianceHistoryWindow(
        cardioValues,
        COMPLIANCE_HISTORY_WINDOW,
      ),
    },
    waistSeries: spark((r) => r.waistCm).map((p) => ({ date: p.date, cm: p.value })),
    waistSpark: spark((r) => r.waistCm),
    thighSpark: spark((r) => r.thighCm),
    chestSpark: spark((r) => r.chestCm),
    armSpark: spark((r) => r.armCm),
  };
}

export async function getHomeStartDashboard(
  userId: string,
): Promise<HomeStartDashboard> {
  const db = getDb();
  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const weekStart = weekKeys[0]!;
  const weekEnd = weekKeys[weekKeys.length - 1]!;

  const [
    userRow,
    nextWorkout,
    workoutsThisWeek,
    cardioThisWeekMinutes,
    cardioRolling,
    workoutStreakWeeks,
    stats,
    weightFromStart,
    weightSeries,
    macroBundle,
    transformation,
    dimensions,
    reportInsights,
    programMeta,
  ] = await Promise.all([
    db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        weightKg: users.weightKg,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getNextWorkoutPlan(userId),
    countDistinctWorkoutDaysInRange(userId, weekStart, weekEnd),
    sumCardioMinutesInCalendarWeek(userId, weekKeys),
    getWeeklyCardioProgress(userId),
    getWorkoutStreakWeeks(userId, todayKey),
    getHomeStats(userId),
    getWeightFromStart(userId),
    getWeightSeries(userId),
    getMacroSeriesAndToday(userId),
    getTransformationPhotos(userId),
    getLatestDimensions(userId),
    getReportInsights(userId),
    getProgramStartAndReportCount(userId),
  ]);

  const firstName =
    userRow?.firstName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/)[0] ||
    null;
  const lastName =
    userRow?.lastName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/).slice(1).join(" ") ||
    null;

  let tempoKgPerMin: number | null = null;
  const last = stats.lastWorkout;
  if (last && last.durationMinutes && last.durationMinutes > 0 && last.volumeKg > 0) {
    tempoKgPerMin = Math.round((last.volumeKg / last.durationMinutes) * 10) / 10;
  }

  const currentWeightKg =
    weightFromStart.currentKg ??
    dimensions.weightKg ??
    userRow?.weightKg ??
    null;

  // Preferuj dni od pierwszego raportu; fallback: data konta.
  let daysInProgram = programMeta.daysInProgram;
  if (daysInProgram == null) {
    const createdAt = userRow?.createdAt ? new Date(userRow.createdAt) : null;
    daysInProgram =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(
            1,
            Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) + 1,
          )
        : null;
  }

  return {
    firstName,
    lastName,
    nextWorkout,
    workoutsThisWeek,
    cardioThisWeekMinutes,
    cardioWeeklyGoal: cardioRolling.weeklyGoal,
    workoutStreakWeeks,
    daysInProgram,
    reportCount: programMeta.reportCount,
    daysSinceLastReport: reportInsights.daysSinceLastReport,
    reportCadenceDays: 14,
    currentWeightKg,
    tempoKgPerMin,
    weightFromStartKg: weightFromStart.deltaKg,
    weightDeltaFromPreviousKg: weightFromStart.deltaFromPreviousKg,
    weightSeries,
    waistSeries: reportInsights.waistSeries,
    macroSeries: macroBundle.series,
    todayMacros: macroBundle.today,
    weekMacros: macroBundle.week,
    formToday: reportInsights.formToday,
    compliance: reportInsights.compliance,
    transformation,
    dimensions: {
      weightKg: dimensions.weightKg ?? currentWeightKg,
      waistCm: dimensions.waistCm,
      armCm: dimensions.armCm,
      abdomenCm: dimensions.abdomenCm,
      chestCm: dimensions.chestCm,
      thighCm: dimensions.thighCm,
      waistSpark: reportInsights.waistSpark,
      thighSpark: reportInsights.thighSpark,
      chestSpark: reportInsights.chestSpark,
      armSpark: reportInsights.armSpark,
    },
  };
}

/** Pomocnicze — używane w testach / ewentualnym rozszerzeniu streaku. */
export function consecutiveWorkoutStreakFromKeys(
  todayKey: string,
  workoutKeys: Set<string>,
  lookbackDays = 60,
): number {
  let streak = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const key = addCalendarDays(todayKey, -i);
    if (!workoutKeys.has(key)) break;
    streak += 1;
  }
  return streak;
}
