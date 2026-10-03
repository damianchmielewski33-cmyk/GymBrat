import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, workouts } from "@/db/schema";
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
  kind: "cardio_log" | "post_strength";
  /** HH:MM lokalnie z endedAt/startedAt jeśli znane. */
  clockLabel: string | null;
};

export type CardioHubData = {
  weekMonday: string;
  minutesThisWeek: number;
  entriesThisWeek: number;
  goalMinutes: number;
  historyTotal: number;
  items: CardioHubItem[];
};

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
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
    .limit(200);

  let minutesThisWeek = 0;
  let entriesThisWeek = 0;
  const items: CardioHubItem[] = [];

  for (const row of rows) {
    const session = parseWorkoutSessionJson(row.exercises);
    const minutesCol = Math.max(0, row.cardioMinutes ?? 0);
    const standalone = isStandaloneCardioLog(session, minutesCol);
    const post =
      isCompletedStrengthSession(session) && minutesCol > 0;
    if (!standalone && !post) continue;

    const counted = countableCardioMinutes(session, minutesCol);
    if (row.date >= weekMonday && row.date <= sunday && counted > 0) {
      minutesThisWeek += counted;
      entriesThisWeek += 1;
    }

    let title = "Cardio";
    let avgHr: number | null = null;
    try {
      const o = JSON.parse(row.exercises) as {
        title?: unknown;
        avgHr?: unknown;
        heartRate?: unknown;
        kind?: unknown;
      };
      if (typeof o.title === "string" && o.title.trim()) title = o.title.trim();
      const hr = o.avgHr ?? o.heartRate;
      if (typeof hr === "number" && Number.isFinite(hr) && hr > 0) {
        avgHr = Math.round(hr);
      }
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
      avgHr,
      kind: standalone ? "cardio_log" : "post_strength",
      clockLabel: clockFromPayload(row.exercises),
    });
  }

  return {
    weekMonday,
    minutesThisWeek,
    entriesThisWeek,
    goalMinutes: goalRow?.goal ?? 150,
    historyTotal: items.length,
    items,
  };
}
