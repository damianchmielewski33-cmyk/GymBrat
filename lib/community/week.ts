/**
 * Wspólna definicja tygodnia Team (pon–nd) — ADR 0011 §3.
 * Reeksport z `local-date`, żeby pierścienie/FCS/misje miały jedno miejsce importu.
 */

import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekMondayKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";

export { addCalendarDays, calendarDateKey, weekDateKeysMondayFirst };

export function mondayOf(dateKey: string): string {
  return calendarWeekMondayKey(dateKey);
}

export function weekBounds(dateKey: string = calendarDateKey()): {
  weekStart: string;
  weekEnd: string;
  days: string[];
} {
  const days = weekDateKeysMondayFirst(dateKey);
  return {
    weekStart: days[0]!,
    weekEnd: days[6]!,
    days,
  };
}

/** Deterministyczny indeks rotacji (bez Math.random) — ADR 0011 §5.1. */
export function hashWeek(teamId: string, weekStart: string): number {
  const s = `${teamId}:${weekStart}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
