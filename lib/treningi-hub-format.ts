/**
 * Liczebniki i formaty ekranu Trening (BR-12: jedna odmiana w jednym miejscu).
 * Czysty moduł, bezpieczny dla klienta. Mikrokopia: docs/ux/003-przebudowa-ekranu-trening.md.
 */

import {
  daysBetweenDateKeys,
  parseDateKey,
  PL_MONTH_GENITIVE,
  type DateKeyParts,
} from "@/lib/local-date";
import type { ExerciseLastLoad } from "@/lib/plan-last-session-loads";
import { plural } from "@/lib/progress-format";
import { formatKgPl } from "@/lib/set-progression-suggestion";

/** Ile ćwiczeń następnego dnia pokazuje karta „Następny”. */
export const NEXT_CARD_EXERCISE_PREVIEW = 3;

/** Po tylu dniach etykieta „ostatnio” traci dopisek względny. */
const RELATIVE_DAYS_LIMIT = 14;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dayMonthLong(p: DateKeyParts): string {
  return `${p.d} ${PL_MONTH_GENITIVE[p.m - 1]}`;
}

/** 1 ćwiczenie / 2 ćwiczenia / 5 ćwiczeń. */
export function formatExerciseCount(n: number): string {
  return `${n} ${plural(n, "ćwiczenie", "ćwiczenia", "ćwiczeń")}`;
}

/** + 1 kolejne ćwiczenie / + 2 kolejne ćwiczenia / + 5 kolejnych ćwiczeń. */
export function formatMoreExercises(n: number): string {
  return `+ ${n} ${plural(n, "kolejne ćwiczenie", "kolejne ćwiczenia", "kolejnych ćwiczeń")}`;
}

/** Widoczny tekst chipu serii; `null` przy braku serii (chip ukryty). */
export function formatStreakWeeks(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} tyg. z rzędu`;
}

/** Pełna odmiana serii dla czytnika ekranu (AC-1.2). */
export function formatStreakWeeksAria(n: number): string {
  return `${n} ${plural(n, "tydzień", "tygodnie", "tygodni")} z rzędu z treningiem`;
}

/** Druga linia cardio: „brak sesji” / „1 sesja” / „2 sesje” / „5 sesji”. */
export function formatCardioSessions(n: number): string {
  if (n <= 0) return "brak sesji";
  return `${n} ${plural(n, "sesja", "sesje", "sesji")}`;
}

/** „80 kg × 8”, „27,5 kg × 10”, masa ciała: „× 12 powt.” (nigdy „0 kg”). */
export function formatLastLoad(load: ExerciseLastLoad): string {
  if (load.weightKg > 0) return `${formatKgPl(load.weightKg)} kg × ${load.reps}`;
  return `× ${load.reps} powt.`;
}

/** Tekst dla czytnika: „Wyciskanie: ostatnio 80 kg, 8 powtórzeń”. */
export function formatLastLoadAria(name: string, load: ExerciseLastLoad): string {
  const reps = `${load.reps} ${plural(load.reps, "powtórzenie", "powtórzenia", "powtórzeń")}`;
  if (load.weightKg > 0) {
    return `${name}: ostatnio ${formatKgPl(load.weightKg)} kg, ${reps}`;
  }
  return `${name}: ostatnio ${reps}, bez obciążenia`;
}

/** Cel z planu, gdy brak historii: „plan 3 × 10”; bez celu: „nowe”. */
export function formatPlanTarget(sets: number, reps: number): string {
  if (!(sets > 0) || !(reps > 0)) return "nowe";
  return `plan ${sets} × ${reps}`;
}

/** Tekst dla czytnika dla celu z planu. */
export function formatPlanTargetAria(name: string, sets: number, reps: number): string {
  if (!(sets > 0) || !(reps > 0)) return `${name}: nowe ćwiczenie, bez historii`;
  return `${name}: w planie ${sets} ${plural(sets, "seria", "serie", "serii")} po ${reps} ${plural(reps, "powtórzeniu", "powtórzenia", "powtórzeń")}`;
}

/** Cel ćwiczenia w podglądzie dnia: „3 × 10” (pusty, gdy brak celu). */
export function formatSetsReps(sets: number, reps: number): string {
  if (!(sets > 0) || !(reps > 0)) return "";
  return `${sets} × ${reps}`;
}

/** „Tydzień 20–26.10” / „Tydzień 27.10–02.11” / „Tydzień 29.12–04.01”. */
export function formatWeekRange(startKey: string, endKey: string): string {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  if (!a || !b) return "Tydzień";
  if (a.m === b.m && a.y === b.y) {
    return `Tydzień ${pad2(a.d)}–${pad2(b.d)}.${pad2(b.m)}`;
  }
  return `Tydzień ${pad2(a.d)}.${pad2(a.m)}–${pad2(b.d)}.${pad2(b.m)}`;
}

/** „Tydzień od 20 do 26 października” / „Tydzień od 27 października do 2 listopada”. */
export function formatWeekRangeAria(startKey: string, endKey: string): string {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  if (!a || !b) return "Tydzień";
  if (a.m === b.m && a.y === b.y) {
    return `Tydzień od ${a.d} do ${dayMonthLong(b)}`;
  }
  return `Tydzień od ${dayMonthLong(a)} do ${dayMonthLong(b)}`;
}

/** „22.10”, a z innego roku niż dziś „22.10.2025”. */
export function formatShortDate(ymd: string, todayKey: string): string {
  const p = parseDateKey(ymd);
  if (!p) return ymd;
  const t = parseDateKey(todayKey);
  const base = `${pad2(p.d)}.${pad2(p.m)}`;
  return t && t.y !== p.y ? `${base}.${p.y}` : base;
}

/**
 * Część „ostatnio …” w karcie „Następny”:
 * „pierwszy raz” / „ostatnio 23.10 (dziś)” / „(wczoraj)” / „(9 dni temu)” / „ostatnio 02.09”.
 */
export function formatLastDoneWithRelative(
  ymd: string | null,
  todayKey: string,
): string {
  if (!ymd) return "pierwszy raz";
  const short = formatShortDate(ymd, todayKey);
  const p = parseDateKey(ymd);
  const t = parseDateKey(todayKey);
  if (!p || !t) return `ostatnio ${short}`;
  const days = daysBetweenDateKeys(ymd, todayKey);
  if (days <= 0) return `ostatnio ${short} (dziś)`;
  if (days === 1) return `ostatnio ${short} (wczoraj)`;
  if (days < RELATIVE_DAYS_LIMIT) return `ostatnio ${short} (${days} dni temu)`;
  return `ostatnio ${short}`;
}

/** Linia meta karty „Następny”: „6 ćwiczeń · ostatnio 14.10 (9 dni temu)”. */
export function formatNextWorkoutMeta(
  exerciseCount: number,
  lastWorkoutDate: string | null,
  todayKey: string,
): string {
  return `${formatExerciseCount(exerciseCount)} · ${formatLastDoneWithRelative(lastWorkoutDate, todayKey)}`;
}

/** Nazwa dnia do wyświetlenia; pusta nazwa planu → „Dzień N”. */
export function planDayDisplayName(planName: string, dayNumber: number): string {
  return planName.trim() || `Dzień ${dayNumber}`;
}

/** Podpis wiersza dnia: „Dzień 2 · 5 ćw. · 22.10” / „jeszcze nie robiony” / „uzupełnij plan”. */
export function formatPlanDayCaption(
  dayNumber: number,
  exerciseCount: number,
  lastWorkoutDate: string | null,
  todayKey: string,
): string {
  const head = `Dzień ${dayNumber} · ${exerciseCount} ćw.`;
  if (exerciseCount === 0) return `${head} · uzupełnij plan`;
  if (!lastWorkoutDate) return `${head} · jeszcze nie robiony`;
  return `${head} · ${formatShortDate(lastWorkoutDate, todayKey)}`;
}

/** Partie małą literą do tekstów ciągłych: „klatka, barki, ramiona”. */
export function formatMuscleList(labels: readonly string[]): string {
  return labels.map((l) => l.toLocaleLowerCase("pl-PL")).join(", ");
}

/** Tekstowy odpowiednik sylwetki: „Partie: klatka, barki.” / „Partie nierozpoznane.” */
export function formatMusclesSentence(labels: readonly string[] | null): string {
  if (!labels || labels.length === 0) return "Partie nierozpoznane.";
  return `Partie: ${formatMuscleList(labels)}.`;
}

/** Tekst segmentu paska tygodnia dla czytnika ekranu. */
export function formatWeekSegmentLabel(
  dayNumber: number,
  doneThisWeek: boolean,
  isNext: boolean,
): string {
  if (doneThisWeek && isNext) {
    return `Dzień ${dayNumber}: wykonany w tym tygodniu, następny`;
  }
  if (doneThisWeek) return `Dzień ${dayNumber}: wykonany w tym tygodniu`;
  if (isNext) return `Dzień ${dayNumber}: następny`;
  return `Dzień ${dayNumber}: jeszcze nie w tym tygodniu`;
}

export type PlanDayAriaInput = {
  dayNumber: number;
  planName: string;
  exerciseCount: number;
  muscleLabels: readonly string[] | null;
  doneThisWeek: boolean;
  isNext: boolean;
  lastWorkoutDate: string | null;
  todayKey: string;
};

/**
 * Dostępna nazwa wiersza dnia (AC-6.2): akcja, dzień, nazwa, partie, status.
 * „Rozpocznij: Dzień 3, Push. Partie: klatka, barki. Następny. Ostatnio 14 października.”
 */
export function formatPlanDayAriaLabel(input: PlanDayAriaInput): string {
  const name = input.planName.trim();
  const day = name ? `Dzień ${input.dayNumber}, ${name}` : `Dzień ${input.dayNumber}`;
  if (input.exerciseCount === 0) return `Uzupełnij plan: ${day}, brak ćwiczeń.`;

  const parts = [`Rozpocznij: ${day}.`, formatMusclesSentence(input.muscleLabels)];
  if (input.doneThisWeek) parts.push("Wykonany w tym tygodniu.");
  if (input.isNext) parts.push("Następny.");
  if (!input.doneThisWeek) {
    const last = input.lastWorkoutDate ? parseDateKey(input.lastWorkoutDate) : null;
    if (!last) {
      parts.push("Jeszcze nie robiony.");
    } else {
      const today = parseDateKey(input.todayKey);
      const year = today && today.y !== last.y ? ` ${last.y}` : "";
      parts.push(`Ostatnio ${dayMonthLong(last)}${year}.`);
    }
  }
  return parts.join(" ");
}
