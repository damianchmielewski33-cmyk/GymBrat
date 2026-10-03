import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, weightLogs, workoutPlans, workouts } from "@/db/schema";
import { computeAchievements, type AchievementDef } from "@/lib/achievements";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import { getBodyReports } from "@/lib/body-reports";
import {
  emptyProgressDietTrainingBlock,
  loadProgressDietTrainingBlock,
  type ProgressDietTrainingBlock,
} from "@/lib/diet-training-weeks";
import { estimated1RM, safeNormalizeExercises, safeParseCompletedSession } from "@/lib/workout-history";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekdaySun0,
} from "@/lib/local-date";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import {
  buildProgressIntensitySummary,
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
  | "abdomen"
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
  dataUrl: string;
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
  /** Tonaż poprzedniego tygodnia kalendarzowego. */
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
    achievements: AchievementDef[];
  };
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
      if (!Boolean(s.done) || Boolean(s.skipped) || !hasPerformedReps(reps) || !hasExternalWeight(w))
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
      if (!Boolean(s.done) || Boolean(s.skipped) || !hasPerformedReps(reps)) continue;
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

export async function getProgressHubData(userId: string): Promise<ProgressHubData> {
  const db = getDb();
  const today = calendarDateKey();
  const monday = mondayOfWeek(today);
  const sunday = addCalendarDays(monday, 6);
  const from180 = addCalendarDays(today, -180);

  const [settingsRow, planRows, workoutRows, bodyReports] = await Promise.all([
    db
      .select({
        weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
        startPhotoDataUrl: userSettings.startPhotoDataUrl,
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        id: workoutPlans.id,
        planJson: workoutPlans.planJson,
        updatedAt: workoutPlans.updatedAt,
      })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, userId))
      .orderBy(desc(workoutPlans.updatedAt)),
    db
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
      .limit(400),
    getBodyReports(userId),
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
  };

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
        spark: [],
        trend: "flat",
        status: "pending",
        firstDate: null,
        volumeDeltaKg: null,
        volumeDeltaPercent: null,
        metric: "kg",
      };
    }
    if (spark.length === 1) {
      return {
        name: displayName,
        lastVolumeKg: agg.lastVolume,
        lastBestWeight: safeRound1(agg.bestWeight),
        lastBestReps: agg.bestReps,
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

  const weekBuckets = new Map<
    string,
    { workouts: number; tonnageKg: number; cardioMinutes: number }
  >();
  for (let w = 0; w < 8; w++) {
    const m = addCalendarDays(monday, -7 * w);
    weekBuckets.set(m, { workouts: 0, tonnageKg: 0, cardioMinutes: 0 });
  }

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
    const weekIntensity = intensityByWeek.get(weekMon) ?? [];
    weekIntensity.push(sessionIntensity);
    intensityByWeek.set(weekMon, weekIntensity);

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
        if (!Boolean(s.done) || Boolean(s.skipped) || !hasPerformedReps(reps))
          continue;
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
      }
      if (dayVolKg <= 0 && dayTotalReps <= 0) continue;
      const identity = resolveExerciseIdentity(name);
      if (!identity.key) continue;
      const key = identity.key;
      const displayName = identity.displayName || name;
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

  // --- Body / tempo ---
  const weightByDay = new Map<string, number>();
  for (const r of [...bodyReports].reverse()) {
    if (r.weightKg != null && r.weightKg > 0) {
      weightByDay.set(calendarDateKey(r.createdAt), safeRound1(r.weightKg));
    }
  }

  const logRows = await db
    .select({
      recordedAt: weightLogs.recordedAt,
      weightKg: weightLogs.weightKg,
    })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(asc(weightLogs.recordedAt))
    .limit(300);

  for (const w of logRows) {
    const key = calendarDateKey(new Date(w.recordedAt));
    if (!weightByDay.has(key) && Number(w.weightKg) > 0) {
      weightByDay.set(key, safeRound1(Number(w.weightKg)));
    }
  }

  const weights: ProgressWeightPoint[] = [...weightByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, kg]) => ({ date, kg }));

  const startKg = weights[0]?.kg ?? null;
  const currentKg = weights.length ? weights[weights.length - 1]!.kg : null;
  const prevKg = weights.length >= 2 ? weights[weights.length - 2]!.kg : null;
  const deltaVsPrevKg =
    currentKg != null && prevKg != null ? safeRound1(currentKg - prevKg) : null;
  const deltaFromStartKg =
    startKg != null && currentKg != null
      ? safeRound1(currentKg - startKg)
      : null;
  const lastReportDate = weights.length
    ? weights[weights.length - 1]!.date
    : null;
  const startDate = weights[0]?.date ?? null;
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
    if (slice.length >= 2) {
      const a = slice[0]!;
      const b = slice[slice.length - 1]!;
      const days = Math.max(
        1,
        (new Date(`${b.date}T12:00:00`).getTime() -
          new Date(`${a.date}T12:00:00`).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      kgPerWeekLast6 = safeRound1(((b.kg - a.kg) / days) * 7);
    }
  }

  let kgPerWeekFromStart: number | null = null;
  let weeksFromStart: number | null = null;
  if (weights.length >= 2 && startKg != null && currentKg != null) {
    const a = weights[0]!;
    const b = weights[weights.length - 1]!;
    const days = Math.max(
      1,
      (new Date(`${b.date}T12:00:00`).getTime() -
        new Date(`${a.date}T12:00:00`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    weeksFromStart = safeRound1(days / 7);
    kgPerWeekFromStart = safeRound1(((b.kg - a.kg) / days) * 7);
  }

  const measureDefs: Array<{
    key: ProgressMeasureKey;
    label: string;
    pick: (r: (typeof bodyReports)[number]) => number | null;
    lowerIsBetter: boolean;
  }> = [
    { key: "waist", label: "Pas", pick: (r) => r.waistCm, lowerIsBetter: true },
    {
      key: "abdomen",
      label: "Brzuch",
      pick: (r) => r.abdomenCm,
      lowerIsBetter: true,
    },
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

  // --- Photos ---
  const photoItems: ProgressPhotoItem[] = [];
  for (const r of [...bodyReports].reverse()) {
    const date = calendarDateKey(r.createdAt);
    for (const p of r.photos) {
      if (!p.dataUrl) continue;
      photoItems.push({
        id: p.id,
        reportId: r.id,
        dataUrl: p.dataUrl,
        date,
        weightKg: r.weightKg,
        waistCm: r.waistCm,
      });
    }
  }
  const customStartUrl = maybeDecryptSensitiveField(
    settingsRow?.startPhotoDataUrl ?? null,
  );
  const firstReportPhoto = photoItems[0] ?? null;
  const startPhoto: ProgressPhotoItem | null = customStartUrl
    ? {
        id: CUSTOM_START_PHOTO_ID,
        reportId: "",
        dataUrl: customStartUrl,
        date: firstReportPhoto?.date ?? today,
        weightKg: firstReportPhoto?.weightKg ?? null,
        waistCm: firstReportPhoto?.waistCm ?? null,
      }
    : firstReportPhoto;
  const nowPhoto = photoItems.length ? photoItems[photoItems.length - 1]! : null;
  const weightDeltaKg =
    startPhoto?.weightKg != null && nowPhoto?.weightKg != null
      ? safeRound1(nowPhoto.weightKg - startPhoto.weightKg)
      : startKg != null && currentKg != null
        ? safeRound1(currentKg - startKg)
        : null;
  const waistReports = bodyReports.filter((r) => r.waistCm != null);
  const firstWaist = waistReports.length
    ? waistReports[waistReports.length - 1]!.waistCm
    : null;
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

  const prevMonday = addCalendarDays(monday, -7);
  const prevWeekTonnageKg = safeRound1(
    weekBuckets.get(prevMonday)?.tonnageKg ?? 0,
  );

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
  const waistGoalCm = 15;
  const waistRemain = Math.max(0, safeRound1(waistGoalCm - waistLostCm));
  const tonnageGoalKg = 50_000;
  const tonnageRemainKg = Math.max(0, tonnageGoalKg - totalTonnageKg);
  const streakGoal = 4;
  const streakRemain = Math.max(0, streakGoal - streakWeeks);

  const goalBars: ProgressGoalBar[] = [
    {
      id: "waist-15",
      label: `−${waistGoalCm} cm w pasie`,
      remainingLabel:
        waistRemain <= 0 ? "cel osiągnięty" : `jeszcze ${waistRemain} cm`,
      progressPct: Math.min(
        100,
        Math.round((waistLostCm / waistGoalCm) * 100),
      ),
    },
    {
      id: "tonnage-50t",
      label: "50 t podniesione",
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
      id: "streak-4",
      label: `${streakGoal} tygodnie z rzędu`,
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
  ];

  const firstReportDate =
    bodyReports.length > 0
      ? calendarDateKey(bodyReports[bodyReports.length - 1]!.createdAt)
      : null;

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
    },
    photos: {
      items: photoItems,
      start: startPhoto,
      now: nowPhoto,
      hasCustomStart: Boolean(customStartUrl),
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
      },
      last8,
      dietTraining,
      goals: goalBars,
      achievements,
    },
  };
}
