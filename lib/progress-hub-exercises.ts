import { contributionFromExercise, type ExerciseSessionPoint, type MuscleSetContribution } from "@/lib/analytics";
import { estimated1RM, safeNormalizeExercises } from "@/lib/workout-history";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import { addCalendarDays } from "@/lib/local-date";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import { isHardSet, isIntensityEligibleSet } from "@/lib/intensity-analysis";
import { hasExternalWeight, hasPerformedReps } from "@/lib/workout-skipped-sets";
import { resolveExerciseMuscles } from "@/lib/resolve-exercise-muscles";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";
import { clampNonNegative, safeRound1, trendOf } from "@/lib/progress-hub-helpers";
import type { ProgressExerciseRow, ProgressMaxItem, ProgressMetricKind, ProgressPlanGroup, ProgressVolumeSession } from "@/lib/progress-hub-types";

/** Agregaty siłowe Postępów (Z88a): wiersze ćwiczeń, składanie serii, rekordy i grupy planów. */
export type ExAgg = {
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

export function toExerciseRow(input: {
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

/** Składa serie jednej sesji w agregaty per ćwiczenie (`byExercise`) i wkłady mięśniowe. */
export function foldExercisesIntoAggregates(args: {
  ex: ReturnType<typeof safeNormalizeExercises>;
  date: string;
  byExercise: Map<string, ExAgg>;
  muscleContributions: MuscleSetContribution[];
}): void {
  const { ex, date, byExercise, muscleContributions } = args;
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
        date: date,
        primaryRegion,
        secondaryRegions: muscles.secondary,
        sets: Math.max(1, workingSetsCount),
        effectiveSets: effectiveSetsCount,
        reps: dayTotalReps,
        tonnageKg: dayVolKg,
      }),
    );
    const point: ExerciseSessionPoint = {
      date: date,
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
        date: date,
        firstDate: date,
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
            ? date
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

/** Trendy objętości, rekordy (e1RM / powtórzenia) i grupy ćwiczeń wg planów. */
export function buildStrengthViews(args: {
  volumeSessions: ProgressVolumeSession[];
  byExercise: Map<string, ExAgg>;
  planRows: Array<{ id: string; planJson: string }>;
  today: string;
}) {
  const { volumeSessions, byExercise, planRows, today } = args;
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
  // Lista wszystkich ćwiczeń dla zakładki Siła (z ostatnią historią, bez podziału na plany).
  const allExercises: ProgressExerciseRow[] = [...byExercise.values()]
    .filter((e) => e.hasWeighted && e.bestE1rm > 0)
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 40)
    .map((e) => {
      const row = toExerciseRow({ name: e.name, agg: e });
      return { ...row, history: row.history.slice(-30) };
    });
  return { last6, volumeCounts, volumeComparedCount, maxes, planGroups, allExercises };
}
