import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { withDbRetry } from "@/db/with-retry";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { hasExternalWeight, hasPerformedReps } from "@/lib/workout-skipped-sets";

/** Obciążenie z ostatniej sesji planu; `weightKg: 0` = masa ciała. */
export type ExerciseLastLoad = { weightKg: number; reps: number };

export type SessionSetLike = {
  reps?: unknown;
  weight?: unknown;
  done?: unknown;
  skipped?: unknown;
};

type SessionExerciseLike = { id?: unknown; name?: unknown; sets?: unknown };

function toFiniteNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Najcięższa wykonana seria: `done`, nie `skipped`, powtórzenia > 0.
 * Serie z ciężarem → max kg (remis → więcej powtórzeń); same 0 kg → masa ciała z max powtórzeń.
 * Wartości nienumeryczne lub ujemne odrzucają serię. Brak kandydatów → null.
 */
export function pickHeaviestCompletedSet(
  sets: readonly SessionSetLike[],
): ExerciseLastLoad | null {
  let best: ExerciseLastLoad | null = null;
  for (const set of sets) {
    if (set.done !== true || set.skipped === true) continue;
    const reps = toFiniteNumber(set.reps);
    const weight = toFiniteNumber(set.weight ?? 0);
    if (reps == null || weight == null || weight < 0) continue;
    const roundedReps = Math.round(reps);
    if (!hasPerformedReps(roundedReps)) continue;
    const weightKg = hasExternalWeight(weight) ? weight : 0;
    if (
      !best ||
      weightKg > best.weightKg ||
      (weightKg === best.weightKg && roundedReps > best.reps)
    ) {
      best = { weightKg, reps: roundedReps };
    }
  }
  return best;
}

function parseSessionExercises(sessionJson: string): SessionExerciseLike[] {
  try {
    const parsed = JSON.parse(sessionJson) as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const list = (parsed as { exercises?: unknown }).exercises;
    return Array.isArray(list)
      ? list.filter((e): e is SessionExerciseLike => !!e && typeof e === "object")
      : [];
  } catch {
    // LR-1: bez logowania treści sesji
    return [];
  }
}

/**
 * Obciążenia ćwiczeń planu z jednej sesji (klucz = id ćwiczenia planu).
 * Dopasowanie: najpierw `id`, potem tożsamość nazwy (`resolveExerciseIdentity`); pierwsze trafienie wygrywa.
 */
export function extractExerciseLastLoads(
  sessionJson: string,
  exercises: ReadonlyArray<Pick<WorkoutPlanExercise, "id" | "name">>,
): Record<string, ExerciseLastLoad> {
  // Wynik budowany w Map, nie w obiekcie bez prototypu: id ćwiczenia pochodzi z danych
  // użytkownika (może być np. "__proto__"), a Server Component nie może przekazać do
  // Client Component obiektu bez `Object.prototype`. `Object.fromEntries` zapisuje klucze
  // przez `CreateDataProperty`, więc po stronie serwera "__proto__" staje się własną
  // właściwością wynikowego obiektu, bez zanieczyszczenia jego prototypu. Uwaga: React Flight
  // serializuje "__proto__" z ostrzeżeniem (tylko w dev), a klient przy deserializacji go pomija.
  // Efekt w UI: brak wpisu obciążenia dla takiego id (nie crash, nie pollution prototypu).
  // Odczyt po stronie klienta używa `Object.hasOwn`, więc klucze z prototypu nie są brane pod uwagę.
  const resultMap = new Map<string, ExerciseLastLoad>();
  if (exercises.length === 0) return Object.fromEntries(resultMap);
  const sessionExercises = parseSessionExercises(sessionJson);
  if (sessionExercises.length === 0) return Object.fromEntries(resultMap);

  const byId = new Map<string, SessionExerciseLike>();
  const byIdentity = new Map<string, SessionExerciseLike>();
  for (const ex of sessionExercises) {
    if (typeof ex.id === "string" && ex.id && !byId.has(ex.id)) byId.set(ex.id, ex);
    if (typeof ex.name === "string") {
      const key = resolveExerciseIdentity(ex.name).key;
      if (key && !byIdentity.has(key)) byIdentity.set(key, ex);
    }
  }

  for (const planExercise of exercises) {
    const identity = resolveExerciseIdentity(planExercise.name).key;
    const match =
      byId.get(planExercise.id) ?? (identity ? byIdentity.get(identity) : undefined);
    if (!match || !Array.isArray(match.sets)) continue;
    const sets = match.sets.filter(
      (s): s is SessionSetLike => !!s && typeof s === "object",
    );
    const load = pickHeaviestCompletedSet(sets);
    if (load) resultMap.set(planExercise.id, load);
  }
  return Object.fromEntries(resultMap);
}

/**
 * Obciążenia z ostatniej sesji danego planu użytkownika (najnowsza data; remis → później wstawiona).
 * `userId` z sesji, `planId` z listy planów tego użytkownika — jedno zapytanie `LIMIT 1`.
 * Chwilowe błędy Turso ponawiane jak w `loadWorkoutPlansWithLastWorkout` (bez `label`: LR-1, nic nie logujemy).
 */
export async function getLastSessionLoadsForPlan(
  userId: string,
  planId: string,
  exercises: ReadonlyArray<Pick<WorkoutPlanExercise, "id" | "name">>,
): Promise<Record<string, ExerciseLastLoad>> {
  if (exercises.length === 0) return {};
  const [row] = await withDbRetry(
    () =>
      getDb()
        .select({ exercises: workouts.exercises })
        .from(workouts)
        .where(and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, planId)))
        .orderBy(desc(workouts.date), sql`rowid desc`)
        .limit(1),
    { attempts: 3, baseDelayMs: 250 },
  );
  return row ? extractExerciseLastLoads(row.exercises, exercises) : {};
}
