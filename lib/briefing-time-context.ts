import { getCalendarTimezone } from "@/lib/local-date";

/** Pora dnia po polsku — do instrukcji dla modelu i heurystyki. */
export function partOfDayPl(hour0to23: number): string {
  if (hour0to23 >= 5 && hour0to23 < 10) return "ranek";
  if (hour0to23 >= 10 && hour0to23 < 13) return "przedpołudnie";
  if (hour0to23 >= 13 && hour0to23 < 17) return "popołudnie";
  if (hour0to23 >= 17 && hour0to23 < 22) return "wieczór";
  return "późny wieczór lub noc";
}

function hourInTimeZone(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const h = parseInt(raw, 10);
  return Number.isFinite(h) ? h % 24 : 12;
}

export type BriefingTimeContext = {
  /** Jedna linia do system prompt / recentContext */
  linePl: string;
  hour: number;
  partPl: string;
};

/**
 * Czas „jak w aplikacji” — ta sama strefa co kalendarz żywienia (np. Europe/Warsaw).
 */
export function getBriefingTimeContext(now: Date = new Date()): BriefingTimeContext {
  const tz = getCalendarTimezone();
  const label = new Intl.DateTimeFormat("pl-PL", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const hour = hourInTimeZone(now, tz);
  const partPl = partOfDayPl(hour);
  const linePl = `Teraz jest ${label} (strefa ${tz}) — to ${partPl}.`;
  return { linePl, hour, partPl };
}
