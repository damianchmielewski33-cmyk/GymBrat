import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, workouts } from "@/db/schema";
import {
  extractCardioExtrasFromSessionJson,
  type CardioExtras,
} from "@/lib/cardio";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekdaySun0,
} from "@/lib/local-date";
import {
  countableCardioMinutes,
  isCompletedStrengthSession,
  isStandaloneCardioLog,
  parseWorkoutSessionJson,
} from "@/lib/workout-cardio-attribution";

export type CardioHubItem = {
  id: string;
  date: string;
  title: string;
  minutes: number;
  avgHr: number | null;
  distanceKm: number | null;
  calories: number | null;
  steps: number | null;
  paceMinPerKm: number | null;
  kind: "cardio_log" | "post_strength";
  /** HH:MM lokalnie z endedAt/startedAt jeśli znane. */
  clockLabel: string | null;
};

export type CardioWeekBar = {
  monday: string;
  label: string;
  minutes: number;
  distanceKm: number;
  calories: number;
  steps: number;
  entries: number;
};

export type CardioHubData = {
  weekMonday: string;
  minutesThisWeek: number;
  entriesThisWeek: number;
  goalMinutes: number;
  historyTotal: number;
  /** Sumy tygodnia z dostępnych metryk. */
  distanceKmThisWeek: number;
  caloriesThisWeek: number;
  stepsThisWeek: number;
  /** Średnie tempo (min/km) z wpisów tygodnia mających dystans. */
  avgPaceMinPerKmThisWeek: number | null;
  /** Ostatnie 8 tygodni (najnowszy pierwszy). */
  last8: CardioWeekBar[];
  items: CardioHubItem[];
};

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

function weekShortLabel(monday: string): string {
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(a)}–${fmt(b)}`;
}

function clockFromPayload(raw: string): string | null {
  try {
    const o = JSON.parse(raw) as { endedAt?: unknown; startedAt?: unknown };
    const ms =
      typeof o.endedAt === "number" && Number.isFinite(o.endedAt)
        ? o.endedAt
        : typeof o.startedAt === "number" && Number.isFinite(o.startedAt)
          ? o.startedAt
          : null;
    if (ms == null) return null;
    return new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

/** Czas trwania jak na makiecie: `20:00` / `1:30:00`. */
export function formatCardioDurationClock(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function formatCardioRelativeDay(ymd: string, todayYmd: string): string {
  try {
    const t0 = new Date(`${ymd}T12:00:00`).getTime();
    const t1 = new Date(`${todayYmd}T12:00:00`).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return ymd;
    const days = Math.round((t1 - t0) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "dziś";
    if (days === 1) return "wczoraj";
    if (days < 14) return `${days} dni temu`;
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

function safeRound2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getCardioHubData(userId: string): Promise<CardioHubData> {
  const db = getDb();
  const today = calendarDateKey();
  const weekMonday = mondayOfWeek(today);
  const sunday = addCalendarDays(weekMonday, 6);

  const [goalRow] = await db
    .select({ goal: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const rows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(400);

  let minutesThisWeek = 0;
  let entriesThisWeek = 0;
  let distanceKmThisWeek = 0;
  let caloriesThisWeek = 0;
  let stepsThisWeek = 0;
  const paceSamplesThisWeek: number[] = [];
  const items: CardioHubItem[] = [];

  const weekBuckets = new Map<
    string,
    {
      minutes: number;
      distanceKm: number;
      calories: number;
      steps: number;
      entries: number;
    }
  >();
  for (let w = 0; w < 8; w++) {
    const m = addCalendarDays(weekMonday, -7 * w);
    weekBuckets.set(m, {
      minutes: 0,
      distanceKm: 0,
      calories: 0,
      steps: 0,
      entries: 0,
    });
  }

  for (const row of rows) {
    const session = parseWorkoutSessionJson(row.exercises);
    const minutesCol = Math.max(0, row.cardioMinutes ?? 0);
    const standalone = isStandaloneCardioLog(session, minutesCol);
    const post = isCompletedStrengthSession(session) && minutesCol > 0;
    if (!standalone && !post) continue;

    const counted = countableCardioMinutes(session, minutesCol);
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(row.exercises);
    } catch {
      parsedJson = null;
    }
    const extras: CardioExtras = extractCardioExtrasFromSessionJson(
      parsedJson,
      minutesCol,
    );

    const weekMon = mondayOfWeek(row.date);
    const bucket = weekBuckets.get(weekMon);
    if (bucket && counted > 0) {
      bucket.minutes += counted;
      bucket.entries += 1;
      if (extras.distanceKm != null) bucket.distanceKm += extras.distanceKm;
      if (extras.calories != null) bucket.calories += extras.calories;
      if (extras.steps != null) bucket.steps += extras.steps;
    }

    if (row.date >= weekMonday && row.date <= sunday && counted > 0) {
      minutesThisWeek += counted;
      entriesThisWeek += 1;
      if (extras.distanceKm != null) distanceKmThisWeek += extras.distanceKm;
      if (extras.calories != null) caloriesThisWeek += extras.calories;
      if (extras.steps != null) stepsThisWeek += extras.steps;
      if (extras.paceMinPerKm != null) paceSamplesThisWeek.push(extras.paceMinPerKm);
    }

    let title = "Cardio";
    try {
      const o = parsedJson as { title?: unknown } | null;
      if (typeof o?.title === "string" && o.title.trim()) title = o.title.trim();
      if (!standalone && post) {
        title = `${title} · cardio`;
      }
    } catch {
      /* ignore */
    }

    items.push({
      id: row.id,
      date: row.date,
      title,
      minutes: minutesCol,
      avgHr: extras.avgHr,
      distanceKm: extras.distanceKm,
      calories: extras.calories,
      steps: extras.steps,
      paceMinPerKm: extras.paceMinPerKm,
      kind: standalone ? "cardio_log" : "post_strength",
      clockLabel: clockFromPayload(row.exercises),
    });
  }

  const last8: CardioWeekBar[] = [];
  for (let w = 0; w < 8; w++) {
    const m = addCalendarDays(weekMonday, -7 * w);
    const b = weekBuckets.get(m)!;
    last8.push({
      monday: m,
      label: weekShortLabel(m),
      minutes: Math.round(b.minutes),
      distanceKm: safeRound2(b.distanceKm),
      calories: Math.round(b.calories),
      steps: Math.round(b.steps),
      entries: b.entries,
    });
  }

  const avgPaceMinPerKmThisWeek =
    paceSamplesThisWeek.length > 0
      ? Math.round(
          (paceSamplesThisWeek.reduce((a, b) => a + b, 0) /
            paceSamplesThisWeek.length) *
            100,
        ) / 100
      : null;

  return {
    weekMonday,
    minutesThisWeek,
    entriesThisWeek,
    goalMinutes: goalRow?.goal ?? 150,
    historyTotal: items.length,
    distanceKmThisWeek: safeRound2(distanceKmThisWeek),
    caloriesThisWeek: Math.round(caloriesThisWeek),
    stepsThisWeek: Math.round(stepsThisWeek),
    avgPaceMinPerKmThisWeek,
    last8,
    items,
  };
}
