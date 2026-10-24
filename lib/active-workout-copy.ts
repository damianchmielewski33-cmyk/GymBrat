/**
 * Mikrokopia ekranu aktywnego treningu (zadanie 004, `docs/ux/004-ekran-aktywnego-treningu.md` §10):
 * schemat ćwiczenia, czas sesji, „N dni temu”, pary „ciężar × powtórzenia”, różnica ciężaru
 * i etykieta przycisku głównego. Jedno miejsce dla ekranu serii (A) i przerwy (B).
 */

import { formatClockMmSs, plural } from "@/lib/progress-format";
import { formatKgPl, resolveRepRange } from "@/lib/set-progression-suggestion";

/** „6–8” (półpauza) albo „10”; null bez celu w planie. */
export function formatRepTarget(targetReps: number | null | undefined): string | null {
  const range = resolveRepRange(targetReps);
  if (!range) return null;
  return range.min === range.max ? String(range.max) : `${range.min}–${range.max}`;
}

/** „1 seria”, „3 serie”, „5 serii”, „12 serii”, „22 serie”. */
export function formatSeriesCount(n: number): string {
  return `${n} ${plural(n, "seria", "serie", "serii")}`;
}

/**
 * Części schematu: [„3 serie × 6–8”, „RIR 1”, „tempo 3-1-1”]; części bez danych pomijane.
 * Pierwsza część jest zawsze (liczba serii), łączenie „ · ” po stronie widoku.
 */
export function formatExerciseSchemeParts(args: {
  sets: number;
  targetReps?: number | null;
  targetRir?: number | null;
  tempo?: string | null;
}): string[] {
  const reps = formatRepTarget(args.targetReps);
  const parts = [
    reps ? `${formatSeriesCount(args.sets)} × ${reps}` : formatSeriesCount(args.sets),
  ];
  if (args.targetRir != null) parts.push(`RIR ${args.targetRir}`);
  const tempo = args.tempo?.trim();
  if (tempo) parts.push(`tempo ${tempo}`);
  return parts;
}

/** Czas sesji: „24:05”, od godziny „1:02:15”. */
export function formatSessionClock(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  if (s < 3600) return formatClockMmSs(s);
  const h = Math.floor(s / 3600);
  return `${h}:${formatClockMmSs(s % 3600).padStart(5, "0")}`;
}

/** Czas do czytnika ekranu: „1 godzinę 2 minuty 15 sekund”, „24 minuty 5 sekund”. */
export function formatSessionClockSpoken(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${plural(h, "godzinę", "godziny", "godzin")}`);
  if (h > 0 || m > 0) parts.push(`${m} ${plural(m, "minutę", "minuty", "minut")}`);
  parts.push(`${sec} ${plural(sec, "sekundę", "sekundy", "sekund")}`);
  return parts.join(" ");
}

/** „dziś”, „wczoraj”, „5 dni temu”; null od 7 dni albo bez danych. */
export function formatDaysAgo(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  const d = Math.round(days);
  if (d === 0) return "dziś";
  if (d === 1) return "wczoraj";
  if (d < 7) return `${d} dni temu`;
  return null;
}

/** „30 × 8” (bez jednostki, jak w wierszu sugestii); bez powtórzeń „30”. */
export function formatWeightReps(weightKg: number, reps: number | null | undefined): string {
  const w = formatKgPl(weightKg);
  return reps != null && reps > 0 ? `${w} × ${Math.round(reps)}` : w;
}

/** „+2 kg”, „−2,5 kg” (znak minus U+2212). */
export function formatSignedKg(deltaKg: number): string {
  const sign = deltaKg < 0 ? "−" : "+";
  return `${sign}${formatKgPl(Math.abs(deltaKg))} kg`;
}

/**
 * D-2 / BR-8: przycisk główny zawsze zapisuje. Nigdy „Pomiń serię” —
 * pomijanie tylko linkiem „Pomiń”.
 */
export function primarySetActionLabel(setOrdinal: number, setCompleted: boolean): string {
  return setCompleted ? `Popraw serię ${setOrdinal}` : `Zapisz serię ${setOrdinal}`;
}
