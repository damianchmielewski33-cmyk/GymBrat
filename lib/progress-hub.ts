import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { withDbRetry } from "@/db/with-retry";
import {
  dailyCheckins,
  userSettings,
  users,
  weightLogs,
  workoutPlans,
  workouts,
} from "@/db/schema";
import {
  buildProgressIntelligence,
  emptyProgressIntelligence,
  contributionFromExercise,
  type AnalyticsCardioSample,
  type AnalyticsStrengthSession,
  type ExerciseSessionPoint,
  type MuscleSetContribution,
  type ProgressIntelligence,
  type SexKind,
} from "@/lib/analytics";
import { computeAchievements, type AchievementDef } from "@/lib/achievements";
import { getBodyReports } from "@/lib/body-reports";
import { computeWeightTrendKgPerWeek } from "@/lib/analytics/weight-trend";
import { resolveProgressStart } from "@/lib/progress-metrics/start";
import {
  extractCardioExtrasFromSessionJson,
  parseCardioLog,
} from "@/lib/cardio-utils";
import {
  emptyProgressDietTrainingBlock,
  loadProgressDietTrainingBlock,
  type ProgressDietTrainingBlock,
} from "@/lib/diet-training-weeks";
import { estimated1RM, safeNormalizeExercises, safeParseCompletedSession } from "@/lib/workout-history";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import {
  parseFitnessGoalsJson,
  STREAK_WEEKS_GOAL_DEFAULT,
  TONNAGE_GOAL_KG_DEFAULT,
  WAIST_GOAL_CM_DEFAULT,
  type FitnessGoals,
} from "@/lib/fitness-goals";
import {
  goalStatusLabel,
  projectToTarget,
  type GoalType,
  targetE1rm,
} from "@/lib/goal-projection";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekdaySun0,
  daysBetweenDateKeys,
} from "@/lib/local-date";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { frontBodyReportPhoto } from "@/lib/body-report-photo-slots";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import { bodyReportPhotoMediaPath, startPhotoMediaPath } from "@/lib/user-photo-media";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import {
  buildProgressIntensitySummary,
  isHardSet,
  isIntensityEligibleSet,
  summarizeSessionIntensity,
  type ProgressIntensitySummary,
  type SessionIntensity,
} from "@/lib/intensity-analysis";
import {
  countableCardioMinutes,
  isCompletedStrengthSession,
  isStandaloneCardioLog,
  parseWorkoutSessionJson,
} from "@/lib/workout-cardio-attribution";
import { hasExternalWeight, hasPerformedReps } from "@/lib/workout-skipped-sets";
import {
  buildWeekTrainingCompare,
  compareProgressWeekPicks,
  type ProgressWeekPick,
  type WeekTrainingCompare,
} from "@/lib/week-training-compare";
import { resolveExerciseMuscles } from "@/lib/resolve-exercise-muscles";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";
import type { ProgressTabId } from "@/lib/progress-tabs";

export type VolumeTrendKind = "up" | "flat" | "down";

export type ProgressMetricKind = "kg" | "reps";

export type ProgressMaxItem = {
  name: string;
  /** e1RM dla obciążenia; 0 dla masy ciała. */
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  date: string;
  isNew: boolean;
  kind: "weighted" | "bodyweight";
};

export type ProgressVolumeSession = {
  id: string;
  date: string;
  title: string;
  volumeKg: number;
  trend: VolumeTrendKind;
};

export type ProgressExerciseStatus = "pending" | "first" | "compare";

export type ProgressExerciseRow = {
  name: string;
  /** Ostatnia wartość metryki: kg objętości albo suma powtórzeń (masa ciała). */
  lastVolumeKg: number;
  lastBestWeight: number;
  /** Najlepsza seria powtórzeń (przydatne przy 0 kg). */
  lastBestReps: number;
  /** e1RM z ostatniej sesji oraz kierunek zmian między dwiema ostatnimi sesjami. */
  lastBestE1rm: number | null;
  e1rmTrend: VolumeTrendKind;
  e1rmDeltaPercent: number | null;
  bestSetLabel: string | null;
  history: ExerciseSessionPoint[];
  spark: number[];
  trend: VolumeTrendKind;
  status: ProgressExerciseStatus;
  /** Pierwszy trening z tym ćwiczeniem (YYYY-MM-DD). */
  firstDate: string | null;
  volumeDeltaKg: number | null;
  volumeDeltaPercent: number | null;
  metric: ProgressMetricKind;
};

export type ProgressPlanGroup = {
  planId: string;
  planName: string;
  exercises: ProgressExerciseRow[];
};

export type ProgressWeightPoint = { date: string; kg: number };

export type ProgressTempo = {
  currentKg: number | null;
  startKg: number | null;
  kgPerWeekLast6: number | null;
  kgPerWeekFromStart: number | null;
  deltaVsPrevKg: number | null;
  weeksFromStart: number | null;
  /** current − start */
  deltaFromStartKg: number | null;
  lastReportDate: string | null;
  startDate: string | null;
  reportCount: number;
  /** Średnia krocząca na ostatnim punkcie. */
  lastAvgKg: number | null;
};

export type ProgressMeasureKey =
  | "waist"
  | "thigh"
  | "chest"
  | "arm";

export type ProgressMeasureRow = {
  key: ProgressMeasureKey;
  label: string;
  currentCm: number | null;
  deltaFromStartCm: number | null;
  spark: number[];
  lowerIsBetter: boolean;
};

export type ProgressPhotoItem = {
  id: string;
  reportId: string;
  /** Autoryzowany URL — bez data URL w payloadzie RSC. */
  src: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
};

export type ProgressWeekDay = {
  date: string;
  label: string;
  strength: boolean;
  cardio: boolean;
};

export type ProgressWeekSummary = {
  done: number;
  target: number;
  days: ProgressWeekDay[];
  tonnageKg: number;
  /** Tonaż poprzedniego tygodnia kalendarzowego (pełny Pn–Nd). */
  prevWeekTonnageKg: number;
  cardioMinutes: number;
  cardioEntries: number;
  cardioGoalMinutes: number;
  streakWeeks: number;
  monday: string;
  sunday: string;
  today: string;
  /** Dni kalendarzowe do niedzieli włącznie (0 gdy po tygodniu). */
  daysLeft: number;
  /** Domyślne porównanie: bieżący vs poprzedni (Pn→dziś). */
  weekCompare: WeekTrainingCompare;
  /** Ostatnie ~12 tygodni do wyboru dowolnej pary w UI. */
  compareWeeks: ProgressWeekPick[];
};

export type ProgressGoalBar = {
  id: string;
  label: string;
  /** Tekst po prawej, np. „jeszcze 3 cm”. */
  remainingLabel: string;
  /** 0–100 */
  progressPct: number;
};

export type ProgressWeekBar = {
  monday: string;
  label: string;
  workouts: number;
  tonnageKg: number;
  cardioMinutes: number;
  complete: boolean;
};

export type ProgressHubData = {
  strength: {
    maxes: ProgressMaxItem[];
    volumeSessions: ProgressVolumeSession[];
    volumeCounts: { up: number; flat: number; down: number };
    /** Ćwiczenia z porównywalną objętością (ostatnie 2 wpisy). */
    volumeComparedCount: number;
    /** RPE / RIR / tempo z ostatnich sesji siłowych. */
    intensity: ProgressIntensitySummary;
    planGroups: ProgressPlanGroup[];
    sinceDate: string | null;
    workoutCount: number;
  };
  body: {
    weights: ProgressWeightPoint[];
    tempo: ProgressTempo;
    measures: ProgressMeasureRow[];
    targetWeightKg: number | null;
    goalType: GoalType | null;
    goalDeadline: string | null;
  };
  photos: {
    items: ProgressPhotoItem[];
    start: ProgressPhotoItem | null;
    now: ProgressPhotoItem | null;
    /** Użytkownik wgrał własne zdjęcie startowe z galerii. */
    hasCustomStart: boolean;
    weightDeltaKg: number | null;
    waistDeltaCm: number | null;
  };
  week: {
    summary: ProgressWeekSummary;
    last8: ProgressWeekBar[];
    /** Kcal/makro z dziennika vs tonaż/RPE w tych samych tygodniach. */
    dietTraining: ProgressDietTrainingBlock;
    goals: ProgressGoalBar[];
    /** Cele ćwiczeń (edytowalne) i nazwy ćwiczeń z historii do wyboru. */
    exerciseTargets: NonNullable<FitnessGoals["exerciseTargets"]>;
    exerciseNameOptions: string[];
    achievements: AchievementDef[];
  };
  /** Silniki Analityki 11/10 — fatigue, recovery, muscle, stagnation, … */
  intelligence: ProgressIntelligence;
};

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

function volumeFromExercises(exercises: ReturnType<typeof safeNormalizeExercises>): number {
  let volume = 0;
  for (const e of exercises) {
    for (const s of e.sets ?? []) {
      const reps =
        typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      const weight =
        typeof s.weight === "number" && Number.isFinite(s.weight)
          ? s.weight
          : Number(s.weight ?? 0);
      const w = clampNonNegative(weight);
      if (!Boolean(s.done) || Boolean(s.skipped) || Boolean((s as { warmup?: boolean }).warmup) || !hasPerformedReps(reps) || !hasExternalWeight(w))
        continue;
      volume += reps! * w;
    }
  }
  return safeRound1(volume);
}

function totalRepsFromExercises(
  exercises: ReturnType<typeof safeNormalizeExercises>,
): number {
  let total = 0;
  for (const e of exercises) {
    for (const s of e.sets ?? []) {
      const reps =
        typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      if (!Boolean(s.done) || Boolean(s.skipped) || Boolean((s as { warmup?: boolean }).warmup) || !hasPerformedReps(reps)) continue;
      total += reps!;
    }
  }
  return total;
}

function trendOf(prev: number, next: number): VolumeTrendKind {
  if (prev <= 0) return "flat";
  const pct = ((next - prev) / prev) * 100;
  if (pct >= 3) return "up";
  if (pct <= -3) return "down";
  return "flat";
}

function weekShortLabel(monday: string): string {
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(a)}–${fmt(b)}`;
}

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;

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
    await Promise.all([
    db
      .select({
        weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
        startPhotoDataUrl: userSettings.startPhotoDataUrl,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
    wantsStrength ? db
      .select({
        id: workoutPlans.id,
        planJson: workoutPlans.planJson,
        updatedAt: workoutPlans.updatedAt,
      })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, userId))
      .orderBy(desc(workoutPlans.updatedAt)) : Promise.resolve([]),
    scope !== "sylwetka" ? db
      .select({
        id: workouts.id,
        date: workouts.date,
        cardioMinutes: workouts.cardioMinutes,
        exercises: workouts.exercises,
        workoutPlanId: workouts.workoutPlanId,
      })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, from180)))
      .orderBy(desc(workouts.date), desc(workouts.id))
      .limit(400) : Promise.resolve([]),
    // Body reports bez metadanych zdjęć; metadata są ładowane osobną akcją.
    wantsBody ? getBodyReports(userId, { photos: "none" }) : Promise.resolve([]),
    wantsIntelligence ? db
      .select({
        age: users.age,
        weightKg: users.weightKg,
        sex: users.sex,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0] ?? null) : Promise.resolve(null),
    wantsIntelligence ? db
      .select({
        date: dailyCheckins.date,
        sleepQuality: dailyCheckins.sleepQuality,
        dayEnergy: dailyCheckins.dayEnergy,
        stress: dailyCheckins.stress,
        weightKg: dailyCheckins.weightKg,
      })
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, userId),
          gte(dailyCheckins.date, addCalendarDays(today, -21)),
        ),
      )
      .orderBy(desc(dailyCheckins.date))
      .limit(21) : Promise.resolve([]),
  ]);

  const goals = parseFitnessGoalsJson(settingsRow?.fitnessGoalsJson ?? null);
  const weeklyTarget = goals.weeklySessionsTarget ?? 5;
  const cardioGoal = settingsRow?.weeklyCardioGoalMinutes ?? 150;

  // --- Strength aggregates ---
  type ExAgg = {
    /** Klucz tożsamości (katalog / złożona nazwa). */
    key: string;
    name: string;
    bestE1rm: number;
    bestWeight: number;
    bestReps: number;
    date: string;
    firstDate: string;
    volumes: number[];
    lastVolume: number;
    hasWeighted: boolean;
    metric: ProgressMetricKind;
    /** Historia sesji dla stagnation / prediction / velocity. */
    points: ExerciseSessionPoint[];
    primaryRegion: MuscleRegionId | null;
  };

  const analyticsStrengthSessions: AnalyticsStrengthSession[] = [];
  const analyticsStrengthDates: string[] = [];
  const analyticsCardioSamples: AnalyticsCardioSample[] = [];
  const muscleContributions: MuscleSetContribution[] = [];
  const strengthDaySet = new Set<string>();

  function toExerciseRow(input: {
    name: string;
    agg: ExAgg | undefined;
  }): ProgressExerciseRow {
    const agg = input.agg;
    const spark = agg?.volumes ?? [];
    const displayName = agg?.name ?? input.name;
    if (!agg || spark.length === 0) {
      return {
        name: displayName,
        lastVolumeKg: 0,
        lastBestWeight: 0,
        lastBestReps: 0,
        lastBestE1rm: null,
        e1rmTrend: "flat",
        e1rmDeltaPercent: null,
        bestSetLabel: null,
        history: [],
        spark: [],
        trend: "flat",
        status: "pending",
        firstDate: null,
        volumeDeltaKg: null,
        volumeDeltaPercent: null,
        metric: "kg",
      };
    }
    const e1rmPoints = agg.points.filter((point) => point.bestE1rm > 0);
    const lastE1rmPoint = e1rmPoints.at(-1);
    const previousE1rmPoint = e1rmPoints.at(-2);
    const e1rmTrend = lastE1rmPoint && previousE1rmPoint
      ? trendOf(previousE1rmPoint.bestE1rm, lastE1rmPoint.bestE1rm)
      : "flat";
    const e1rmDeltaPercent = lastE1rmPoint && previousE1rmPoint && previousE1rmPoint.bestE1rm > 0
      ? Math.round(((lastE1rmPoint.bestE1rm - previousE1rmPoint.bestE1rm) / previousE1rmPoint.bestE1rm) * 100)
      : null;
    const bestSetLabel = agg.hasWeighted
      ? `${safeRound1(agg.bestWeight)} kg × ${agg.bestReps}`
      : `${agg.bestReps} powt.`;
    if (spark.length === 1) {
      return {
        name: displayName,
        lastVolumeKg: agg.lastVolume,
        lastBestWeight: safeRound1(agg.bestWeight),
        lastBestReps: agg.bestReps,
        lastBestE1rm: lastE1rmPoint?.bestE1rm ?? null,
        e1rmTrend,
        e1rmDeltaPercent,
        bestSetLabel,
        history: agg.points,
        spark,
        trend: "flat",
        status: "first",
        firstDate: agg.firstDate,
        volumeDeltaKg: null,
        volumeDeltaPercent: null,
        metric: agg.metric,
      };
    }
    const prev = spark[spark.length - 2]!;
    const next = spark[spark.length - 1]!;
    const trend = trendOf(prev, next);
    const volumeDeltaKg = safeRound1(next - prev);
    const volumeDeltaPercent =
      prev > 0 ? Math.round(((next - prev) / prev) * 100) : null;
    return {
      name: displayName,
      lastVolumeKg: agg.lastVolume,
      lastBestWeight: safeRound1(agg.bestWeight),
      lastBestReps: agg.bestReps,
      lastBestE1rm: lastE1rmPoint?.bestE1rm ?? null,
      e1rmTrend,
      e1rmDeltaPercent,
      bestSetLabel,
      history: agg.points,
      spark,
      trend,
      status: "compare",
      firstDate: agg.firstDate,
      volumeDeltaKg,
      volumeDeltaPercent,
      metric: agg.metric,
    };
  }
  const byExercise = new Map<string, ExAgg>();
  const volumeSessions: ProgressVolumeSession[] = [];
  const intensitySessions: SessionIntensity[] = [];
  const intensityByWeek = new Map<string, SessionIntensity[]>();
  let totalTonnageKg = 0;
  let totalStrengthSessions = 0;
  let firstWorkoutDate: string | null = null;
  const weeksWithGuided = new Set<string>();

  const COMPARE_WEEK_COUNT = 12;
  type WeekAggBucket = {
    workouts: number;
    tonnageKg: number;
    cardioMinutes: number;
    rpe: number[];
    rir: number[];
  };
  const emptyWeekAgg = (): WeekAggBucket => ({
    workouts: 0,
    tonnageKg: 0,
    cardioMinutes: 0,
    rpe: [],
    rir: [],
  });

  const weekBuckets = new Map<
    string,
    { workouts: number; tonnageKg: number; cardioMinutes: number }
  >();
  /** Pełny Pn–Nd oraz wyrównany Pn→(Pn+daysIntoWeek) dla pickera porównań. */
  const weekFull = new Map<string, WeekAggBucket>();
  const weekPartial = new Map<string, WeekAggBucket>();
  for (let w = 0; w < COMPARE_WEEK_COUNT; w++) {
    const m = addCalendarDays(monday, -7 * w);
    weekBuckets.set(m, { workouts: 0, tonnageKg: 0, cardioMinutes: 0 });
    weekFull.set(m, emptyWeekAgg());
    weekPartial.set(m, emptyWeekAgg());
  }
  // last8 nadal z pierwszych 8 slotów weekBuckets (poniżej)

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
  let cardioThisWeek = 0;
  let cardioEntriesThisWeek = 0;
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
    if (row.date >= monday && row.date <= sunday) {
      cardioThisWeek += cardioMin;
      if (
        cardioMin > 0 ||
        isStandaloneCardioLog(session, row.cardioMinutes ?? 0)
      ) {
        cardioEntriesThisWeek += 1;
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

    for (const e of ex) {
      const name = (e.name ?? "").trim().replace(/\s+/g, " ");
      if (!name) continue;
      let dayVolKg = 0;
      let dayTotalReps = 0;
      let dayBestE1rm = 0;
      let dayBestWeight = 0;
      let dayBestRepsAtWeight = 0;
      let dayBestSetReps = 0;
      let dayHasWeighted = false;
      let dayHardSets = 0;
      let dayScoredSets = 0;
      let dayRpeSum = 0;
      let dayRpeN = 0;
      let dayRirSum = 0;
      let dayRirN = 0;
      let daySetsCount = 0;
      const dayLoads: Array<{ w: number; eff: boolean }> = [];
      for (const s of e.sets ?? []) {
        const reps =
          typeof s.reps === "number" && Number.isFinite(s.reps)
            ? Math.round(s.reps)
            : null;
        const weight =
          typeof s.weight === "number" && Number.isFinite(s.weight)
            ? s.weight
            : Number(s.weight ?? 0);
        const w = clampNonNegative(weight);
        if (!Boolean(s.done) || Boolean(s.skipped) || Boolean((s as { warmup?: boolean }).warmup) || !hasPerformedReps(reps))
          continue;
        daySetsCount += 1;
        dayTotalReps += reps!;
        if (reps! > dayBestSetReps) dayBestSetReps = reps!;
        if (hasExternalWeight(w)) {
          dayHasWeighted = true;
          dayVolKg += reps! * w;
          const e1rm = estimated1RM(w, reps!);
          if (e1rm > dayBestE1rm) dayBestE1rm = e1rm;
          if (w > dayBestWeight) {
            dayBestWeight = w;
            dayBestRepsAtWeight = reps!;
          }
        }
        const rir =
          typeof s.rir === "number" && Number.isFinite(s.rir) ? s.rir : null;
        const rpe =
          typeof s.rpe === "number" && Number.isFinite(s.rpe) ? s.rpe : null;
        const effRir = rir ?? (rpe != null ? 10 - rpe : null);
        dayLoads.push({
          w: hasExternalWeight(w) ? w : 0,
          // „Seria efektywna”: do 4 powtórzeń w zapasie (albo brak danych o wysiłku).
          eff: effRir == null || effRir <= 4,
        });
        if (isIntensityEligibleSet({ done: true, skipped: false, rir, rpe })) {
          dayScoredSets += 1;
          if (isHardSet({ rir, rpe })) dayHardSets += 1;
          if (rpe != null) {
            dayRpeSum += rpe;
            dayRpeN += 1;
          }
          if (rir != null) {
            dayRirSum += rir;
            dayRirN += 1;
          }
        }
      }
      if (dayVolKg <= 0 && dayTotalReps <= 0) continue;
      const identity = resolveExerciseIdentity(name);
      if (!identity.key) continue;
      const key = identity.key;
      const displayName = identity.displayName || name;
      // Rozgrzewki są wykluczone jawną flagą `warmup` (pętla serii wyżej).
      const workingSetsCount = dayLoads.length;
      const effectiveSetsCount = dayLoads.filter((l) => l.eff).length;
      const muscles = resolveExerciseMuscles({ name });
      const primaryRegion =
        muscles.primary && muscles.primary !== "cardio"
          ? muscles.primary
          : null;
      muscleContributions.push(
        contributionFromExercise({
          date: row.date,
          primaryRegion,
          secondaryRegions: muscles.secondary,
          sets: Math.max(1, workingSetsCount),
          effectiveSets: effectiveSetsCount,
          reps: dayTotalReps,
          tonnageKg: dayVolKg,
        }),
      );
      const point: ExerciseSessionPoint = {
        date: row.date,
        volumeKg: safeRound1(dayVolKg),
        totalReps: dayTotalReps,
        bestE1rm: safeRound1(dayBestE1rm),
        bestWeight: safeRound1(dayBestWeight),
        bestReps: hasExternalWeight(dayBestWeight)
          ? dayBestRepsAtWeight
          : dayBestSetReps,
        hardSets: dayHardSets,
        scoredSets: dayScoredSets,
        avgRpe: dayRpeN > 0 ? safeRound1(dayRpeSum / dayRpeN) : null,
        avgRir: dayRirN > 0 ? safeRound1(dayRirSum / dayRirN) : null,
        setsCount: daySetsCount,
      };
      const prev = byExercise.get(key);
      const hasWeighted = Boolean(prev?.hasWeighted || dayHasWeighted);
      const metric: ProgressMetricKind = hasWeighted ? "kg" : "reps";
      const metricValue = hasWeighted
        ? safeRound1(dayVolKg)
        : dayTotalReps;
      // Gdy ćwiczenie ma historię z obciążeniem, pomijamy dni tylko z masą ciała w sparkach kg.
      if (hasWeighted && dayVolKg <= 0) {
        if (!prev) continue;
        byExercise.set(key, {
          ...prev,
          key,
          name: identity.catalogId ? displayName : prev.name,
          hasWeighted: true,
          metric: "kg",
          bestReps: Math.max(prev.bestReps, dayBestSetReps),
          points: [...prev.points, point].slice(-60),
          primaryRegion: prev.primaryRegion ?? primaryRegion,
        });
        continue;
      }

      if (!prev) {
        byExercise.set(key, {
          key,
          name: displayName,
          bestE1rm: dayBestE1rm,
          bestWeight: dayBestWeight,
          bestReps: hasWeighted ? dayBestRepsAtWeight : dayBestSetReps,
          date: row.date,
          firstDate: row.date,
          volumes: [metricValue],
          lastVolume: metricValue,
          hasWeighted,
          metric,
          points: [point],
          primaryRegion,
        });
      } else {
        const isNewE1rm = dayBestE1rm > prev.bestE1rm;
        const isNewBwReps =
          !hasWeighted && dayBestSetReps > prev.bestReps;
        const nextBestReps = hasWeighted
          ? dayBestWeight > prev.bestWeight
            ? dayBestRepsAtWeight
            : prev.bestReps
          : Math.max(prev.bestReps, dayBestSetReps);
        const switchedToWeighted = !prev.hasWeighted && hasWeighted;
        byExercise.set(key, {
          key,
          name: identity.catalogId ? displayName : prev.name,
          bestE1rm: Math.max(prev.bestE1rm, dayBestE1rm),
          bestWeight: Math.max(prev.bestWeight, dayBestWeight),
          bestReps: nextBestReps,
          date:
            isNewE1rm ||
            dayBestWeight > prev.bestWeight ||
            isNewBwReps
              ? row.date
              : prev.date,
          firstDate: prev.firstDate,
          volumes: switchedToWeighted
            ? [metricValue]
            : [...prev.volumes, metricValue].slice(-8),
          lastVolume: metricValue,
          hasWeighted,
          metric,
          points: [...prev.points, point].slice(-60),
          primaryRegion: prev.primaryRegion ?? primaryRegion,
        });
      }
    }
  }

  // Volume trend on last 6 sessions (newest last in volumeSessions chronological)
  const last6 = volumeSessions.slice(-6);
  for (let i = 0; i < last6.length; i++) {
    if (i === 0) {
      last6[i]!.trend = "flat";
      continue;
    }
    last6[i]!.trend = trendOf(last6[i - 1]!.volumeKg, last6[i]!.volumeKg);
  }

  // Liczniki objętości: ćwiczenia z ≥2 wpisami (porównanie ost. vs poprzedni).
  const volumeCounts = { up: 0, flat: 0, down: 0 };
  for (const e of byExercise.values()) {
    if (e.volumes.length < 2) continue;
    const t = trendOf(
      e.volumes[e.volumes.length - 2]!,
      e.volumes[e.volumes.length - 1]!,
    );
    if (t === "up") volumeCounts.up += 1;
    else if (t === "down") volumeCounts.down += 1;
    else volumeCounts.flat += 1;
  }
  const volumeComparedCount =
    volumeCounts.up + volumeCounts.flat + volumeCounts.down;

  // Maxes: e1RM + rekordy powtórzeń (masa ciała); nowy = PR w ostatnich 21 dniach
  const cutoffNew = addCalendarDays(today, -21);
  const weightedMaxes: ProgressMaxItem[] = [...byExercise.values()]
    .filter((e) => e.hasWeighted && e.bestE1rm > 0)
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 6)
    .map((e) => ({
      name: e.name,
      bestE1rm: safeRound1(e.bestE1rm),
      bestWeight: safeRound1(e.bestWeight),
      bestReps: e.bestReps,
      date: e.date,
      isNew: e.date >= cutoffNew,
      kind: "weighted" as const,
    }));
  const bodyweightMaxes: ProgressMaxItem[] = [...byExercise.values()]
    .filter((e) => !e.hasWeighted && e.bestReps > 0)
    .sort((a, b) => b.bestReps - a.bestReps)
    .slice(0, 4)
    .map((e) => ({
      name: e.name,
      bestE1rm: 0,
      bestWeight: 0,
      bestReps: e.bestReps,
      date: e.date,
      isNew: e.date >= cutoffNew,
      kind: "bodyweight" as const,
    }));
  const maxes: ProgressMaxItem[] = [...weightedMaxes, ...bodyweightMaxes];

  // Plan groups
  const planGroups: ProgressPlanGroup[] = [];
  for (const row of planRows) {
    let plan;
    try {
      plan = normalizeWorkoutPlan(JSON.parse(row.planJson) as unknown);
    } catch {
      plan = null;
    }
    if (!plan?.exercises?.length) continue;
    const exercises: ProgressExerciseRow[] = [];
    const seenKeys = new Set<string>();
    for (const pe of plan.exercises) {
      const name = pe.name.trim().replace(/\s+/g, " ");
      if (!name) continue;
      const identity = resolveExerciseIdentity(name);
      if (!identity.key || seenKeys.has(identity.key)) continue;
      seenKeys.add(identity.key);
      exercises.push(
        toExerciseRow({
          name: identity.displayName || name,
          agg: byExercise.get(identity.key),
        }),
      );
    }
    if (!exercises.length) continue;
    planGroups.push({
      planId: row.id,
      planName: plan.planName || "Dzień planu",
      exercises,
    });
  }

  // Orphan exercises (not in any plan) under "Inne"
  if (planGroups.length) {
    const inPlan = new Set(
      planGroups.flatMap((g) =>
        g.exercises.map((e) => resolveExerciseIdentity(e.name).key),
      ),
    );
    const orphans = [...byExercise.values()]
      .filter((e) => !inPlan.has(e.key))
      .sort((a, b) => b.lastVolume - a.lastVolume)
      .slice(0, 12)
      .map((e) => toExerciseRow({ name: e.name, agg: e }));
    if (orphans.length) {
      planGroups.push({
        planId: "__other",
        planName: "Inne",
        exercises: orphans,
      });
    }
  } else {
    const all = [...byExercise.values()]
      .sort((a, b) => b.lastVolume - a.lastVolume)
      .slice(0, 40)
      .map((e) => toExerciseRow({ name: e.name, agg: e }));
    if (all.length) {
      planGroups.push({
        planId: "__all",
        planName: "Ćwiczenia",
        exercises: all,
      });
    }
  }

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

  const logRows = wantsBody ? await db
    .select({
      recordedAt: weightLogs.recordedAt,
      weightKg: weightLogs.weightKg,
    })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(asc(weightLogs.recordedAt))
    .limit(300) : [];

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
    settingsRow?.startPhotoDataUrl?.trim(),
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

  // --- Streak ---
  let streakWeeks = 0;
  for (let w = 0; w < 12; w++) {
    const weekMonday = addCalendarDays(monday, -7 * w);
    if (!weeksWithGuided.has(weekMonday)) break;
    streakWeeks += 1;
  }

  const last8: ProgressWeekBar[] = [];
  for (let w = 7; w >= 0; w--) {
    const m = addCalendarDays(monday, -7 * w);
    const b = weekBuckets.get(m) ?? { workouts: 0, tonnageKg: 0, cardioMinutes: 0 };
    last8.push({
      monday: m,
      label: weekShortLabel(m),
      workouts: b.workouts,
      tonnageKg: safeRound1(b.tonnageKg),
      cardioMinutes: Math.round(b.cardioMinutes),
      complete: b.workouts >= weeklyTarget,
    });
  }

  const prevWeekTonnageKg = safeRound1(
    weekBuckets.get(prevMonday)?.tonnageKg ?? 0,
  );

  const avgOrNull = (nums: number[]): number | null =>
    nums.length
      ? safeRound1(nums.reduce((a, b) => a + b, 0) / nums.length)
      : null;

  const rangeLabel = (from: string, to: string) => {
    const a = new Date(`${from}T12:00:00`);
    const b = new Date(`${to}T12:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
    return `${fmt(a)}–${fmt(b)}`;
  };

  const toWeekMetrics = (
    mondayKey: string,
    agg: WeekAggBucket,
    rangeEnd: string,
  ) => ({
    rangeEnd,
    rangeLabel: rangeLabel(mondayKey, rangeEnd),
    workouts: agg.workouts,
    tonnageKg: safeRound1(agg.tonnageKg),
    cardioMinutes: Math.round(agg.cardioMinutes),
    avgRpe: avgOrNull(agg.rpe),
    avgRir: avgOrNull(agg.rir),
  });

  const compareWeeks: ProgressWeekPick[] = [];
  for (let w = 0; w < COMPARE_WEEK_COUNT; w++) {
    const m = addCalendarDays(monday, -7 * w);
    const sun = addCalendarDays(m, 6);
    const partialEnd = addCalendarDays(m, daysIntoWeek);
    const full = weekFull.get(m) ?? emptyWeekAgg();
    const partial = weekPartial.get(m) ?? emptyWeekAgg();
    const isCurrent = m === monday;
    compareWeeks.push({
      monday: m,
      sunday: sun,
      label: weekShortLabel(m),
      isCurrent,
      full: toWeekMetrics(m, full, isCurrent ? today : sun),
      partial: toWeekMetrics(m, partial, partialEnd),
    });
  }

  const primaryPick = compareWeeks[0]!;
  const baselinePick =
    compareWeeks.find((w) => w.monday === prevMonday) ?? compareWeeks[1]!;
  const weekCompare =
    primaryPick && baselinePick
      ? compareProgressWeekPicks(primaryPick, baselinePick)
      : buildWeekTrainingCompare({
          thisRangeLabel: rangeLabel(monday, today),
          prevRangeLabel: rangeLabel(prevMonday, prevSameEnd),
          workouts: { current: 0, previous: 0 },
          tonnageKg: { current: 0, previous: 0 },
          cardioMinutes: { current: 0, previous: 0 },
          avgRpe: { current: null, previous: null },
          avgRir: { current: null, previous: null },
        });

  const daysLeftRaw = Math.round(
    (new Date(`${sunday}T12:00:00`).getTime() -
      new Date(`${today}T12:00:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const daysLeft = Math.max(0, daysLeftRaw);

  const waistLostCm =
    waistDeltaCm != null && waistDeltaCm < 0
      ? Math.abs(waistDeltaCm)
      : 0;
  const waistGoalCm = goals.waistGoalCm ?? WAIST_GOAL_CM_DEFAULT;
  const waistRemain = Math.max(0, safeRound1(waistGoalCm - waistLostCm));
  const tonnageGoalKg = goals.tonnageGoalKg ?? TONNAGE_GOAL_KG_DEFAULT;
  const tonnageRemainKg = Math.max(0, tonnageGoalKg - totalTonnageKg);
  const streakGoal = goals.streakWeeksGoal ?? STREAK_WEEKS_GOAL_DEFAULT;
  const streakRemain = Math.max(0, streakGoal - streakWeeks);

  // Cele pasa i tonażu pokazujemy tylko, gdy użytkownik je ustawił — domyślne
  // „−15 cm” nie pasuje np. do osoby na masie.
  const goalBars: ProgressGoalBar[] = [
    {
      id: "waist-goal",
      label: `−${waistGoalCm} cm w pasie`,
      remainingLabel:
        waistRemain <= 0 ? "cel osiągnięty" : `jeszcze ${waistRemain} cm`,
      progressPct: Math.min(
        100,
        Math.round((waistLostCm / waistGoalCm) * 100),
      ),
    },
    {
      id: "tonnage-goal",
      label: `${safeRound1(tonnageGoalKg / 1000)} t podniesione`,
      remainingLabel:
        tonnageRemainKg <= 0
          ? "cel osiągnięty"
          : `jeszcze ${safeRound1(tonnageRemainKg / 1000)} t`,
      progressPct: Math.min(
        100,
        Math.round((totalTonnageKg / tonnageGoalKg) * 100),
      ),
    },
    {
      id: "streak-goal",
      label: `${streakGoal} ${streakGoal === 1 ? "tydzień" : "tygodnie"} z rzędu`,
      remainingLabel:
        streakRemain <= 0
          ? "cel osiągnięty"
          : streakRemain === 1
            ? "jeszcze 1 tydzień"
            : `jeszcze ${streakRemain} tygodnie`,
      progressPct: Math.min(
        100,
        Math.round((streakWeeks / streakGoal) * 100),
      ),
    },
  ].filter(
    (g) =>
      (g.id !== "waist-goal" || goals.waistGoalCm != null) &&
      (g.id !== "tonnage-goal" || goals.tonnageGoalKg != null),
  );

  // Cele z prognozą: waga docelowa (z terminem) i cele ćwiczeń (e1RM).
  if (
    typeof goals.targetWeightKg === "number" &&
    goals.targetWeightKg > 0 &&
    currentKg != null &&
    weights.length > 0
  ) {
    const recentWeights = weights.filter(
      (w) => daysBetweenDateKeys(w.date, today) <= 60,
    );
    const proj = projectToTarget({
      points: recentWeights.map((w) => ({ date: w.date, value: w.kg })),
      target: goals.targetWeightKg,
      deadline: goals.goalDeadline ?? null,
      today,
    });
    const startW = weights[0]!.kg;
    const span = Math.abs(goals.targetWeightKg - startW);
    const done = Math.abs(currentKg - startW);
    const wrongWay =
      Math.sign(goals.targetWeightKg - startW) !== Math.sign(currentKg - startW);
    goalBars.push({
      id: "weight-goal",
      label: `Waga ${goals.targetWeightKg} kg`,
      remainingLabel: goalStatusLabel(proj),
      progressPct:
        proj.status === "reached"
          ? 100
          : span > 0 && !wrongWay
            ? Math.min(100, Math.round((done / span) * 100))
            : 0,
    });
  }
  for (const t of goals.exerciseTargets ?? []) {
    if (!t.targetKg) continue;
    const key = resolveExerciseIdentity(t.name).key;
    const agg = key ? byExercise.get(key) : undefined;
    if (!agg || agg.points.length === 0) continue;
    const target = targetE1rm(t.targetKg, t.targetReps);
    const proj = projectToTarget({
      points: agg.points
        .filter((p) => p.bestE1rm > 0 && daysBetweenDateKeys(p.date, today) <= 120)
        .map((p) => ({ date: p.date, value: p.bestE1rm })),
      target,
      deadline: t.deadline ?? null,
      today,
    });
    goalBars.push({
      id: `exercise-goal-${key}`,
      label: `${agg.name} ${t.targetKg} kg${t.targetReps ? ` × ${t.targetReps}` : ""}`,
      remainingLabel: goalStatusLabel(proj),
      progressPct: Math.min(100, Math.round((agg.bestE1rm / target) * 100)),
    });
  }

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

  // --- Intelligence (Analityka 11/10) ---
  let consecutiveTrainingDays = 0;
  {
    let cursor = today;
    for (let i = 0; i < 21; i++) {
      if (strengthDaySet.has(cursor)) {
        consecutiveTrainingDays += 1;
        cursor = addCalendarDays(cursor, -1);
      } else {
        break;
      }
    }
  }

  const latestCheckin = checkinRows[0] ?? null;
  const checkinWeekAgo = checkinRows.find((c) => {
    const gap =
      (new Date(`${today}T12:00:00`).getTime() -
        new Date(`${c.date}T12:00:00`).getTime()) /
      (24 * 60 * 60 * 1000);
    return gap >= 5 && gap <= 10;
  });
  const weightDeltaKg7d =
    latestCheckin?.weightKg != null && checkinWeekAgo?.weightKg != null
      ? safeRound1(latestCheckin.weightKg - checkinWeekAgo.weightKg)
      : deltaVsPrevKg != null &&
          lastReportDate != null &&
          (() => {
            const gap =
              (new Date(`${today}T12:00:00`).getTime() -
                new Date(`${lastReportDate}T12:00:00`).getTime()) /
              (24 * 60 * 60 * 1000);
            return gap <= 10;
          })()
        ? deltaVsPrevKg
        : null;

  const dietAdherencePct =
    dietTraining.current?.calorieAdherencePct ??
    (dietTraining.weeks.length
      ? (() => {
          const vals = dietTraining.weeks
            .map((w) => w.calorieAdherencePct)
            .filter((x): x is number => x != null);
          if (!vals.length) return null;
          return (
            Math.round(
              (vals.reduce((a, b) => a + b, 0) / vals.length) * 10,
            ) / 10
          );
        })()
      : null);

  const sexRaw = (userRow?.sex ?? "").trim().toLowerCase();
  const sex: SexKind | null =
    sexRaw === "male" || sexRaw === "female" ? sexRaw : null;

  let intelligence: ProgressIntelligence = emptyProgressIntelligence();
  if (wantsIntelligence) {
    try {
      intelligence = buildProgressIntelligence({
      today,
      weeklySessionsTarget: weeklyTarget,
      weeklyCardioGoalMinutes: cardioGoal,
      ageYears: userRow?.age ?? null,
      weightKg: userRow?.weightKg ?? currentKg,
      sex,
      strengthSessions: analyticsStrengthSessions,
      strengthDates: analyticsStrengthDates,
      consecutiveTrainingDays,
      exercises: [...byExercise.values()].map((e) => ({
        exerciseKey: e.key,
        name: e.name,
        points: e.points,
        primaryRegion: e.primaryRegion,
      })),
      muscleContributions,
      cardioSamples: analyticsCardioSamples,
      subjective: latestCheckin
        ? {
            sleepQuality: latestCheckin.sleepQuality,
            dayEnergy: latestCheckin.dayEnergy,
            stress: latestCheckin.stress,
            weightDeltaKg7d,
          }
        : bodyReports[0]
          ? {
              sleepQuality: bodyReports[0].sleepQuality ?? null,
              dayEnergy: bodyReports[0].dayEnergy ?? null,
              stress: null,
              weightDeltaKg7d,
            }
          : null,
      dietAdherencePct,
      });
    } catch (e) {
      console.error(
        "[progress-hub] intelligence",
        e instanceof Error ? e.message : e,
      );
      intelligence = emptyProgressIntelligence();
    }
  }

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
        cardioMinutes: Math.round(cardioThisWeek),
        cardioEntries: cardioEntriesThisWeek,
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
