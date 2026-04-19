import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";

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
      if (!s.done) continue;
      const reps = Math.max(0, Math.round(Number(s.reps ?? 0)));
      const weight = Math.max(0, Number(s.weight ?? 0));
      totalReps += reps;
      volumeKg += reps * weight;
    }
  }

  return { volumeKg: Math.round(volumeKg), totalReps, title, durationMinutes };
}

function shortLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export async function getHomeStats(userId: string): Promise<HomeStats> {
  const db = getDb();

  const rows = await db
    .select({ date: workouts.date, exercises: workouts.exercises })
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date))
    .limit(12);

  if (rows.length === 0) {
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

  const parsed = rows.map((r) => ({
    date: r.date,
    ...parseWorkoutExercises(r.exercises),
  }));

  // trend is ascending by date (oldest → newest)
  const trend: WorkoutTrendPoint[] = parsed
    .slice()
    .reverse()
    .map((p) => ({
      date: p.date,
      label: shortLabel(p.date),
      volumeKg: p.volumeKg,
      totalReps: p.totalReps,
    }));

  const last = parsed[0];
  const rest = parsed.slice(1);

  const avgVolumeKg =
    rest.length > 0
      ? Math.round(rest.reduce((acc, p) => acc + p.volumeKg, 0) / rest.length)
      : last.volumeKg;

  const avgTotalReps =
    rest.length > 0
      ? Math.round(rest.reduce((acc, p) => acc + p.totalReps, 0) / rest.length)
      : last.totalReps;

  const deltaVolumeKg = rest.length > 0 ? last.volumeKg - avgVolumeKg : null;
  const deltaVolumePercent =
    rest.length > 0 && avgVolumeKg > 0
      ? Math.round(((last.volumeKg - avgVolumeKg) / avgVolumeKg) * 100)
      : null;

  const deltaTotalReps = rest.length > 0 ? last.totalReps - avgTotalReps : null;
  const deltaTotalRepsPercent =
    rest.length > 0 && avgTotalReps > 0
      ? Math.round(((last.totalReps - avgTotalReps) / avgTotalReps) * 100)
      : null;

  return {
    lastWorkout: {
      date: last.date,
      title: last.title,
      volumeKg: last.volumeKg,
      totalReps: last.totalReps,
      durationMinutes: last.durationMinutes,
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
