import {
  addCalendarDays,
  calendarDateKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";
import type { HofPeriodKind } from "@/lib/community/hof-types";
import { HOF_PERIOD_LABELS } from "@/lib/community/hof-types";

export type HofPeriodBounds = {
  kind: HofPeriodKind;
  key: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** all_time nigdy nie jest „zamknięty”. */
  isClosed: boolean;
};

function utcDayStart(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
}

function utcDayEndExclusive(dateKey: string): Date {
  return utcDayStart(addCalendarDays(dateKey, 1));
}

/** Numer tygodnia ISO (1–53) dla dateKey. */
export function isoWeekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const isoYear = date.getUTCFullYear();
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}

/** Sezon GymBrat: S1=I–III … S4=X–XII. */
export function gymbratSeasonKey(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  const season = Math.ceil((m ?? 1) / 3);
  return `${y}-S${season}`;
}

export function resolvePeriod(
  kind: HofPeriodKind,
  now: Date = new Date(),
): HofPeriodBounds {
  const today = calendarDateKey(now);

  if (kind === "all_time") {
    return {
      kind,
      key: "all",
      title: HOF_PERIOD_LABELS.all_time,
      startsAt: new Date(0),
      endsAt: new Date(Date.UTC(2099, 0, 1)),
      isClosed: false,
    };
  }

  if (kind === "week") {
    const days = weekDateKeysMondayFirst(today);
    const start = days[0]!;
    const end = days[6]!;
    const key = isoWeekKey(today);
    const endsAt = utcDayEndExclusive(end);
    return {
      kind,
      key,
      title: `${HOF_PERIOD_LABELS.week} ${key}`,
      startsAt: utcDayStart(start),
      endsAt,
      isClosed: now.getTime() >= endsAt.getTime(),
    };
  }

  if (kind === "month") {
    const [y, m] = today.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const nextMonth =
      m === 12
        ? `${y! + 1}-01-01`
        : `${y}-${String(m! + 1).padStart(2, "0")}-01`;
    const end = addCalendarDays(nextMonth, -1);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const endsAt = utcDayStart(nextMonth);
    return {
      kind,
      key,
      title: `${HOF_PERIOD_LABELS.month} ${key}`,
      startsAt: utcDayStart(start),
      endsAt,
      isClosed: now.getTime() >= endsAt.getTime(),
    };
  }

  if (kind === "season") {
    const [y, m] = today.split("-").map(Number);
    const season = Math.ceil((m ?? 1) / 3);
    const startMonth = (season - 1) * 3 + 1;
    const start = `${y}-${String(startMonth).padStart(2, "0")}-01`;
    const endMonth = startMonth + 2;
    const nextStart =
      endMonth === 12
        ? `${y! + 1}-01-01`
        : `${y}-${String(endMonth + 1).padStart(2, "0")}-01`;
    const key = `${y}-S${season}`;
    const endsAt = utcDayStart(nextStart);
    return {
      kind,
      key,
      title: `Sezon ${key}`,
      startsAt: utcDayStart(start),
      endsAt,
      isClosed: now.getTime() >= endsAt.getTime(),
    };
  }

  // year
  const y = Number(today.slice(0, 4));
  const start = `${y}-01-01`;
  const endsAt = utcDayStart(`${y + 1}-01-01`);
  return {
    kind: "year",
    key: String(y),
    title: `Rok ${y}`,
    startsAt: utcDayStart(start),
    endsAt,
    isClosed: now.getTime() >= endsAt.getTime(),
  };
}

export function previousPeriod(
  kind: HofPeriodKind,
  now: Date = new Date(),
): HofPeriodBounds | null {
  if (kind === "all_time") return null;
  const cur = resolvePeriod(kind, now);
  const before = new Date(cur.startsAt.getTime() - 86_400_000);
  return resolvePeriod(kind, before);
}
