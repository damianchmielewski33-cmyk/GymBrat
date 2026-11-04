/**
 * Budowa serii do widoku zbiorczego siły z surowych sesji (czysta funkcja, bez bazy):
 * serie sesyjne wszystkich ćwiczeń z ciężarem, pogrupowane po tożsamości ćwiczenia
 * i kategorii z katalogu. Zapytanie do bazy: `strength-overview-data.ts`.
 *
 * Reguła „zaliczonej serii” jest wspólna z `getExerciseProgressSeries` i hubem Postępów
 * (`readSetForStrengthStats`); tu dodatkowo wymagamy ciężaru zewnętrznego (e1RM).
 */

import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import type { ExerciseProgressPoint } from "@/lib/exercise-progress";
import type { OverviewSeriesInput } from "@/lib/strength-overview";
import {
  CATALOG_EXERCISES,
  categoryLabel,
} from "@/lib/workout-exercise-catalog";
import {
  estimated1RM,
  safeNormalizeExercises,
  safeParseCompletedSession,
} from "@/lib/workout-history";
import { hasExternalWeight, readSetForStrengthStats } from "@/lib/workout-skipped-sets";

export type WorkoutRow = { date: string; exercisesJson: string };

const OTHER_LABEL = "Pozostałe ćwiczenia";
/** Cardio nie ma sensu w analizie siły (e1RM) — pomijamy kategorię. */
const EXCLUDED_CATEGORY = "cardio";

const CATEGORY_BY_CATALOG_ID = new Map(
  CATALOG_EXERCISES.map((e) => [e.id, e.categoryId] as const),
);

type DayAgg = {
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  tonnageKg: number;
  totalReps: number;
};

type ExerciseAgg = {
  key: string;
  name: string;
  groupId: string | null;
  groupLabel: string;
  days: Map<string, DayAgg>;
};

/**
 * Czysta funkcja: surowe sesje → serie per ćwiczenie (tylko dni z ciężarem, bestE1rm > 0).
 * Kilka treningów tego samego dnia jest łączonych (max e1RM/ciężaru, sumy tonażu i powtórzeń).
 */
export function buildOverviewSeries(rows: WorkoutRow[]): OverviewSeriesInput[] {
  const byKey = new Map<string, ExerciseAgg>();

  for (const r of rows) {
    const parsed = safeParseCompletedSession(r.exercisesJson);
    if (!parsed) continue;
    const dateKey = String(r.date);

    for (const e of safeNormalizeExercises(parsed.exercises)) {
      const rawName = String(e.name ?? "").trim();
      if (!rawName) continue;
      const identity = resolveExerciseIdentity(rawName);
      if (!identity.key) continue;

      const categoryId = identity.catalogId
        ? (CATEGORY_BY_CATALOG_ID.get(identity.catalogId) ?? null)
        : null;
      if (categoryId === EXCLUDED_CATEGORY) continue;

      let agg = byKey.get(identity.key);
      if (!agg) {
        agg = {
          key: identity.key,
          name: identity.displayName || rawName,
          groupId: categoryId,
          groupLabel: categoryId ? categoryLabel(categoryId) : OTHER_LABEL,
          days: new Map(),
        };
        byKey.set(identity.key, agg);
      }

      for (const s of e.sets ?? []) {
        const { reps, weight: w, performed } = readSetForStrengthStats(s);
        if (!performed || !hasExternalWeight(w)) continue;

        let day = agg.days.get(dateKey);
        if (!day) {
          day = { bestE1rm: 0, bestWeight: 0, bestReps: 0, tonnageKg: 0, totalReps: 0 };
          agg.days.set(dateKey, day);
        }
        day.totalReps += reps!;
        day.tonnageKg += reps! * w;
        const e1rm = estimated1RM(w, reps!);
        if (e1rm > day.bestE1rm) day.bestE1rm = e1rm;
        if (w > day.bestWeight) {
          day.bestWeight = w;
          day.bestReps = reps!;
        }
      }
    }
  }

  const result: OverviewSeriesInput[] = [];
  for (const agg of byKey.values()) {
    const points: ExerciseProgressPoint[] = [...agg.days.entries()]
      .filter(([, d]) => d.bestE1rm > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        bestE1rm: d.bestE1rm,
        bestWeight: d.bestWeight,
        bestReps: d.bestReps,
        tonnageKg: d.tonnageKg,
        totalReps: d.totalReps,
        avgRir: null,
        avgRpe: null,
        targetRir: null,
        tempo: null,
        rirVsTarget: null,
      }));
    if (points.length === 0) continue;
    result.push({
      key: agg.key,
      name: agg.name,
      groupId: agg.groupId,
      groupLabel: agg.groupLabel,
      points,
    });
  }
  return result;
}
