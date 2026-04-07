import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, workouts } from "@/db/schema";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import { localDateKey } from "@/lib/local-date";

export type ReportsSessionRow = {
  id: string;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
  cardioMinutes: number;
  durationMinutes: number | null;
};

export type DailyCardioPoint = {
  day: string;
  shortLabel: string;
  minutes: number;
};

export type WeeklySessionBar = {
  weekLabel: string;
  sessions: number;
};

function formatDayKey(d: Date): string {
  return localDateKey(d);
}

function shortWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function titleFromWorkoutExercises(json: string): string {
  try {
    const o = JSON.parse(json) as { kind?: string; title?: string };
    if (typeof o?.title === "string" && o.title.trim()) return o.title.trim();
    if (o?.kind === "cardio_log") return "Cardio";
    return "Workout";
  } catch {
    return "Workout";
  }
}

function durationFromWorkoutExercises(json: string): number | null {
  try {
    const o = JSON.parse(json) as {
      kind?: string;
      startedAt?: number;
      endedAt?: number;
    };
    if (
      o?.kind === "completed_session" &&
      typeof o.startedAt === "number" &&
      typeof o.endedAt === "number"
    ) {
      const ms = o.endedAt - o.startedAt;
      if (ms > 0) return Math.round(ms / 60000);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function dateKeyToLocalNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

export async function getReportsData(userId: string) {
  const db = getDb();
  const now = Date.now();
  const ms14 = 14 * 24 * 60 * 60 * 1000;
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const ms42 = 42 * 24 * 60 * 60 * 1000;

  const d14 = new Date(now - ms14);
  const d30 = new Date(now - ms30);
  const d42 = new Date(now - ms42);

  const min30DateKey = localDateKey(d30);

  const [totalsTraining] = await db
    .select({
      totalSessions: sql<number>`cast(count(*) as integer)`,
      totalCardioAll: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId));

  const [totalsWorkouts] = await db
    .select({
      totalSessions: sql<number>`cast(count(*) as integer)`,
      totalCardioAll: sql<number>`coalesce(sum(${workouts.cardioMinutes}), 0)`,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId));

  const [last30Training] = await db
    .select({
      cardio: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, d30),
      ),
    );

  const [last30Workouts] = await db
    .select({
      cardio: sql<number>`coalesce(sum(${workouts.cardioMinutes}), 0)`,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, min30DateKey),
      ),
    );

  const weekly = await getWeeklyCardioProgress(userId);

  const forChartsTraining = await db
    .select({
      startedAt: trainingSessions.startedAt,
      endedAt: trainingSessions.endedAt,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, d42),
      ),
    );

  const forChartsWorkouts = await db
    .select({
      date: workouts.date,
    })
    .from(workouts)
    .where(
      and(eq(workouts.userId, userId), gte(workouts.date, localDateKey(d42))),
    );

  const forCharts = [
    ...forChartsTraining.map((r) => ({ startedAt: r.startedAt })),
    ...forChartsWorkouts.map((r) => ({
      startedAt: dateKeyToLocalNoon(r.date),
    })),
  ];

  const forDailyTraining = await db
    .select({
      startedAt: trainingSessions.startedAt,
      cardioMinutes: trainingSessions.cardioMinutes,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, d14),
      ),
    );

  const min14Key = localDateKey(d14);
  const forDailyWorkouts = await db
    .select({
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
    })
    .from(workouts)
    .where(
      and(eq(workouts.userId, userId), gte(workouts.date, min14Key)),
    );

  const tableTraining = await db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      startedAt: trainingSessions.startedAt,
      endedAt: trainingSessions.endedAt,
      cardioMinutes: trainingSessions.cardioMinutes,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId));

  const tableWorkouts = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      exercises: workouts.exercises,
      cardioMinutes: workouts.cardioMinutes,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId));

  const dailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000);
    dailyMap.set(formatDayKey(day), 0);
  }
  for (const r of forDailyTraining) {
    const key = formatDayKey(r.startedAt);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.cardioMinutes);
    }
  }
  for (const r of forDailyWorkouts) {
    if (dailyMap.has(r.date)) {
      dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + r.cardioMinutes);
    }
  }
  const dailyCardio: DailyCardioPoint[] = Array.from(dailyMap.entries()).map(
    ([day, minutes]) => {
      const d = new Date(day + "T12:00:00");
      return {
        day,
        shortLabel: shortWeekday(d),
        minutes,
      };
    },
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  const weeklySessions: WeeklySessionBar[] = [];
  for (let w = 5; w >= 0; w--) {
    const rangeEnd = new Date(now - w * 7 * DAY_MS);
    const rangeStart = new Date(rangeEnd.getTime() - 7 * DAY_MS);
    const sessionsInRange = forCharts.filter(
      (r) => r.startedAt >= rangeStart && r.startedAt < rangeEnd,
    ).length;
    weeklySessions.push({
      weekLabel: rangeStart.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      sessions: sessionsInRange,
    });
  }

  const mergedRows: ReportsSessionRow[] = [
    ...tableTraining.map((r) => {
      let durationMinutes: number | null = null;
      if (r.endedAt && r.startedAt) {
        const ms = r.endedAt.getTime() - r.startedAt.getTime();
        if (ms > 0) durationMinutes = Math.round(ms / 60000);
      }
      return {
        id: r.id,
        title: r.title,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        cardioMinutes: r.cardioMinutes,
        durationMinutes,
      };
    }),
    ...tableWorkouts.map((r) => {
      const startedAt = dateKeyToLocalNoon(r.date);
      return {
        id: `workout:${r.id}`,
        title: titleFromWorkoutExercises(r.exercises),
        startedAt,
        endedAt: null as Date | null,
        cardioMinutes: r.cardioMinutes,
        durationMinutes: durationFromWorkoutExercises(r.exercises),
      };
    }),
  ];

  mergedRows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const sessions = mergedRows.slice(0, 50);

  const durations = sessions
    .map((s) => s.durationMinutes)
    .filter((n): n is number => n != null && n > 0);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  return {
    stats: {
      totalSessions:
        Number(totalsTraining?.totalSessions ?? 0) +
        Number(totalsWorkouts?.totalSessions ?? 0),
      totalCardioAll:
        Number(totalsTraining?.totalCardioAll ?? 0) +
        Number(totalsWorkouts?.totalCardioAll ?? 0),
      cardioLast30Days:
        Number(last30Training?.cardio ?? 0) +
        Number(last30Workouts?.cardio ?? 0),
      weeklyCardioMinutes: weekly.minutesCompleted,
      weeklyCardioGoal: weekly.weeklyGoal,
      weeklyCardioPercent: weekly.percent,
      avgDurationMinutes: avgDuration,
    },
    dailyCardio,
    weeklySessions,
    sessions,
  };
}
