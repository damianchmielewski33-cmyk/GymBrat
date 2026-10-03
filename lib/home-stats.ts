import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { workoutPlanCompareKey } from "@/lib/workout-plan-compare-key";

export type WorkoutTrendPoint = {
  date: string;
  label: string;
  volumeKg: number;
  totalReps: number;
};

export type HomeStats = {
  lastWorkout: {
    date: string;
    title: string;
    volumeKg: number;
    totalReps: number;
    durationMinutes: number | null;
    /** Dzień planu (Nogi / Push…) — delty liczone tylko vs ten sam plan. */
    planLabel: string | null;
  } | null;
  trend: WorkoutTrendPoint[];
  avgVolumeKg: number;
  avgTotalReps: number;
  deltaVolumeKg: number | null;
  deltaVolumePercent: number | null;
  deltaTotalReps: number | null;
  deltaTotalRepsPercent: number | null;
};

type ParsedSet = {
  reps?: number | string;
  weight?: number | string;
  done?: boolean;
};

type ParsedExercise = {
  name?: string;
  sets?: ParsedSet[];
};

type CompletedSessionJson = {
  kind?: string;
  title?: string;
  startedAt?: number;
  endedAt?: number;
  exercises?: ParsedExercise[];
};

function parseWorkoutExercises(json: string): {
  volumeKg: number;
  totalReps: number;
  title: string;
  durationMinutes: number | null;
} {
  let parsed: CompletedSessionJson;
  try {
    parsed = JSON.parse(json) as CompletedSessionJson;
  } catch {
    return { volumeKg: 0, totalReps: 0, title: "Trening", durationMinutes: null };
  }

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : "Trening";

  let durationMinutes: number | null = null;
  if (
    typeof parsed.startedAt === "number" &&
    typeof parsed.endedAt === "number" &&
    parsed.endedAt > parsed.startedAt
  ) {
    durationMinutes = Math.round((parsed.endedAt - parsed.startedAt) / 60000);
  }

  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
  let volumeKg = 0;
  let totalReps = 0;

  for (const ex of exercises) {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    for (const s of sets) {
      if (!s.done || Boolean((s as { skipped?: boolean }).skipped)) continue;
      const reps = Math.max(0, Math.round(Number(s.reps ?? 0)));
      const weight = Math.max(0, Number(s.weight ?? 0));
      if (!(reps > 0)) continue;
      totalReps += reps;
      if (weight > 0) volumeKg += reps * weight;
    }
  }

  return { volumeKg: Math.round(volumeKg), totalReps, title, durationMinutes };
}

function shortLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

function planNameFromJson(planJson: string | null): string | null {
  if (!planJson) return null;
  try {
    const o = JSON.parse(planJson) as Record<string, unknown>;
    const planName = String(o.planName ?? "").trim();
    if (planName) return planName;
    const name = String(o.name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}

export async function getHomeStats(userId: string): Promise<HomeStats> {
  const db = getDb();

  const rows = await db
    .select({
      date: workouts.date,
      exercises: workouts.exercises,
      workoutPlanId: workouts.workoutPlanId,
      planJson: workoutPlans.planJson,
    })
    .from(workouts)
    .leftJoin(workoutPlans, eq(workouts.workoutPlanId, workoutPlans.id))
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(40);

  const parsed = rows
    .map((r) => {
      const stats = parseWorkoutExercises(r.exercises);
      if (stats.volumeKg <= 0 && stats.totalReps <= 0) return null;
      const planName = planNameFromJson(r.planJson ?? null);
      const planKey = workoutPlanCompareKey({
        workoutPlanId: r.workoutPlanId,
        planName,
        title: stats.title,
      });
      return {
        date: r.date,
        planKey,
        planLabel: planName?.trim() || stats.title,
        ...stats,
      };
    })
    .filter(Boolean) as Array<{
    date: string;
    planKey: string;
    planLabel: string;
    volumeKg: number;
    totalReps: number;
    title: string;
    durationMinutes: number | null;
  }>;

  if (parsed.length === 0) {
    return {
      lastWorkout: null,
      trend: [],
      avgVolumeKg: 0,
      avgTotalReps: 0,
      deltaVolumeKg: null,
      deltaVolumePercent: null,
      deltaTotalReps: null,
      deltaTotalRepsPercent: null,
    };
  }

  const last = parsed[0]!;
  // Porównanie wyłącznie do poprzednich sesji tego samego dnia planu (np. Nogi → Nogi).
  const samePlan = parsed.filter((p) => p.planKey === last.planKey);
  const priorSamePlan = samePlan.slice(1);

  const trend: WorkoutTrendPoint[] = [...samePlan]
    .reverse()
    .slice(-12)
    .map((p) => ({
      date: p.date,
      label: shortLabel(p.date),
      volumeKg: p.volumeKg,
      totalReps: p.totalReps,
    }));

  const avgVolumeKg =
    priorSamePlan.length > 0
      ? Math.round(
          priorSamePlan.reduce((acc, p) => acc + p.volumeKg, 0) / priorSamePlan.length,
        )
      : last.volumeKg;

  const avgTotalReps =
    priorSamePlan.length > 0
      ? Math.round(
          priorSamePlan.reduce((acc, p) => acc + p.totalReps, 0) / priorSamePlan.length,
        )
      : last.totalReps;

  const deltaVolumeKg =
    priorSamePlan.length > 0 ? last.volumeKg - avgVolumeKg : null;
  const deltaVolumePercent =
    priorSamePlan.length > 0 && avgVolumeKg > 0
      ? Math.round(((last.volumeKg - avgVolumeKg) / avgVolumeKg) * 100)
      : null;

  const deltaTotalReps =
    priorSamePlan.length > 0 ? last.totalReps - avgTotalReps : null;
  const deltaTotalRepsPercent =
    priorSamePlan.length > 0 && avgTotalReps > 0
      ? Math.round(((last.totalReps - avgTotalReps) / avgTotalReps) * 100)
      : null;

  return {
    lastWorkout: {
      date: last.date,
      title: last.title,
      volumeKg: last.volumeKg,
      totalReps: last.totalReps,
      durationMinutes: last.durationMinutes,
      planLabel: last.planLabel,
    },
    trend,
    avgVolumeKg,
    avgTotalReps,
    deltaVolumeKg,
    deltaVolumePercent,
    deltaTotalReps,
    deltaTotalRepsPercent,
  };
}
