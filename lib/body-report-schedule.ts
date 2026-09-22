import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

/** Domyślny odstęp między raportami ciała (dni kalendarzowe). */
export const BODY_REPORT_INTERVAL_DAYS = 7;

export type NextBodyReportCountdown = {
  /** Ile pełnych dni zostało do terminu (≥ 0). */
  daysUntil: number;
  /** Termin minął albo nigdy nie było raportu. */
  isDue: boolean;
  /** YYYY-MM-DD ostatniego raportu albo null. */
  lastReportDateKey: string | null;
  /** YYYY-MM-DD planowanego kolejnego raportu albo null (gdy brak historii). */
  nextReportDateKey: string | null;
};

/** Różnica dni kalendarzowych: toKey − fromKey. */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  const a = Date.UTC(y1!, m1! - 1, d1!);
  const b = Date.UTC(y2!, m2! - 1, d2!);
  return Math.round((b - a) / 86_400_000);
}

export function formatDaysUntilLabel(days: number): string {
  return days === 1 ? "dzień" : "dni";
}

/**
 * Odliczanie do kolejnego raportu: ostatni raport + `intervalDays`.
 * Bez historii — uznajemy, że raport jest do zrobienia dziś (`daysUntil: 0`).
 */
export function getNextBodyReportCountdown(
  lastReportAt: Date | string | null | undefined,
  opts?: {
    todayKey?: string;
    intervalDays?: number;
  },
): NextBodyReportCountdown {
  const todayKey = opts?.todayKey ?? calendarDateKey();
  const intervalDays = opts?.intervalDays ?? BODY_REPORT_INTERVAL_DAYS;

  if (lastReportAt == null) {
    return {
      daysUntil: 0,
      isDue: true,
      lastReportDateKey: null,
      nextReportDateKey: null,
    };
  }

  const last =
    lastReportAt instanceof Date
      ? lastReportAt
      : new Date(lastReportAt);
  if (Number.isNaN(last.getTime())) {
    return {
      daysUntil: 0,
      isDue: true,
      lastReportDateKey: null,
      nextReportDateKey: null,
    };
  }

  const lastReportDateKey = calendarDateKey(last);
  const nextReportDateKey = addCalendarDays(lastReportDateKey, intervalDays);
  const remaining = calendarDaysBetween(todayKey, nextReportDateKey);
  const daysUntil = Math.max(0, remaining);

  return {
    daysUntil,
    isDue: daysUntil === 0,
    lastReportDateKey,
    nextReportDateKey,
  };
}
