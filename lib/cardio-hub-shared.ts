/** Typy i formatowanie huba cardio — bez DB (bezpieczne dla klienta). */

import type { CardioWeekDays } from "@/lib/cardio-week-stats";

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
  clockLabel: string | null;
};

export type CardioWeekBar = CardioWeekDays;

export type CardioHubData = {
  weekMonday: string;
  todayKey: string;
  minutesThisWeek: number;
  entriesThisWeek: number;
  goalMinutes: number;
  historyTotal: number;
  distanceKmThisWeek: number;
  caloriesThisWeek: number;
  stepsThisWeek: number;
  avgPaceMinPerKmThisWeek: number | null;
  /** Bieżący tydzień pierwszy, potem wstecz (8 tygodni). */
  last8: CardioWeekBar[];
  items: CardioHubItem[];
};

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
