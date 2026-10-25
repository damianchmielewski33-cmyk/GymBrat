/**
 * Mikrobenchmark zadania 005 (etap 9, tester-wydajnosci). Uruchomienie z korzenia repo:
 *   npx tsx docs/wydajnosc/005-koniec-treningu-pomiar.ts
 *
 * Mierzy dwie rzeczy, których nie da się zobaczyć czytaniem kodu:
 *  A. koszt reguły bodyweight (`isSkippedWorkoutSet`/`isCompletedWorkoutSet`) na dużej
 *     historii, nowa reguła vs reguła sprzed zmiany (ADR 0004 p.6, usunięty warunek ciężaru),
 *  B. rozmiar i czas (JSON parse + stringify) payloadu PUT `/api/active-workout-session`
 *     dla typowej sesji — payload zawiera pola wyliczane po stronie klienta.
 *
 * Dane syntetyczne (założenia podane przy wyniku). Nie zastępują pomiaru na realnej bazie.
 */
import { performance } from "node:perf_hooks";
import {
  countSkippedWorkoutSets,
  isCompletedWorkoutSet,
} from "../../lib/workout-skipped-sets";
import type { WorkoutExerciseState, WorkoutSetState } from "../../components/workout/types";

type SetLike = { done: boolean; skipped?: boolean; reps: number | null; weight: number };

/** Reguła sprzed zmiany 005 (ADR 0004 p.6): bez tego warunku seria 0 kg = pominięta. */
function oldIsSkippedWorkoutSet(set: SetLike): boolean {
  if (!set.done) return false;
  if (set.skipped) return true;
  const hasReps = set.reps != null && Number.isFinite(set.reps) && set.reps > 0;
  const hasWeight = set.weight != null && Number.isFinite(set.weight) && set.weight > 0;
  return !hasReps || !hasWeight;
}

function oldCountSkipped(exercises: WorkoutExerciseState[]): number {
  let n = 0;
  for (const ex of exercises) for (const s of ex.sets) if (oldIsSkippedWorkoutSet(s)) n += 1;
  return n;
}

function makeSet(i: number, bodyweight: boolean): WorkoutSetState {
  return {
    reps: 8 + (i % 4),
    weight: bodyweight ? 0 : 60 + i * 2.5,
    done: true,
    skipped: i % 13 === 12,
    rpe: 7,
    rir: 2,
    restSeconds: 90,
    heartRate: 128,
    elapsedSecondsAtCompletion: 600 + i * 90,
  };
}

/** Historia: `sessions` treningów x `exercisesPer` ćwiczeń x `setsPer` serii (co 5. ćwiczenie = masa ciała). */
function makeHistory(sessions: number, exercisesPer: number, setsPer: number): WorkoutExerciseState[][] {
  const out: WorkoutExerciseState[][] = [];
  for (let s = 0; s < sessions; s++) {
    const exs: WorkoutExerciseState[] = [];
    for (let e = 0; e < exercisesPer; e++) {
      const bodyweight = e % 5 === 4;
      const sets: WorkoutSetState[] = [];
      for (let i = 0; i < setsPer; i++) sets.push(makeSet(s + i, bodyweight));
      exs.push({ id: `ex-${e}`, name: `Ćwiczenie ${e}`, sets });
    }
    out.push(exs);
  }
  return out;
}

function timeMs(iterations: number, fn: () => void): number {
  fn(); // rozgrzewka
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - t0) / iterations;
}

// --- A. Koszt reguły bodyweight na historii ---------------------------------------------
const history = makeHistory(400, 8, 4); // 400 treningów x 8 ćwiczeń x 4 serie = 12 800 serii
const totalSets = history.reduce((acc, exs) => acc + exs.reduce((a, e) => a + e.sets.length, 0), 0);

const newPass = (): number => {
  let acc = 0;
  for (const exs of history) {
    acc += countSkippedWorkoutSets(exs);
    for (const ex of exs) for (const s of ex.sets) if (isCompletedWorkoutSet(s)) acc += 1;
  }
  return acc;
};
const oldPass = (): number => {
  let acc = 0;
  for (const exs of history) {
    acc += oldCountSkipped(exs);
    for (const ex of exs) for (const s of ex.sets) if (s.done && !oldIsSkippedWorkoutSet(s)) acc += 1;
  }
  return acc;
};

const newMs = timeMs(200, () => void newPass());
const oldMs = timeMs(200, () => void oldPass());
console.log("== A. Reguła bodyweight na historii ==");
console.log(`serie w historii: ${totalSets}`);
console.log(`przejście pełne (liczenie pominiętych + zaliczonych), nowa reguła: ${newMs.toFixed(3)} ms`);
console.log(`przejście pełne, reguła sprzed zmiany:                         ${oldMs.toFixed(3)} ms`);
console.log(`wynik kontrolny nowa/stara (liczba zaliczonych+pominiętych): ${newPass()} / ${oldPass()}`);

// --- B. Payload PUT ----------------------------------------------------------------------
/**
 * Typowa sesja: 6 ćwiczeń x 4 serie. Pola wyliczane po stronie klienta (`lastSessionSets`,
 * `suggestedWeights`, `coachContext`) są w `exercises` — trafiają do chmury razem z resztą.
 * `coachContext` jest ZAŁOŻONYM kształtem (~4 wpisy kontekstu), nie odczytem z typu.
 */
function typicalPayload(withDerived: boolean): Record<string, unknown> {
  const exercises = [];
  for (let e = 0; e < 6; e++) {
    const sets = [];
    for (let i = 0; i < 4; i++) sets.push(makeSet(i, false));
    const ex: Record<string, unknown> = {
      id: `ex-${e}`,
      name: `Ćwiczenie treningowe ${e}`,
      sets,
      targetSets: 4,
      targetReps: 10,
      targetRir: 2,
      tempo: "2-0-1-0",
      supersetGroupId: null,
      categoryId: "compound-upper",
    };
    if (withDerived) {
      ex.lastSessionSets = sets.map((s) => ({ ...s }));
      ex.suggestedWeights = [62.5, 62.5, 65, 65];
      ex.coachContext = {
        restDays: 3,
        stagnationWeeks: 0,
        avgTop: 82.5,
        sessions: [
          { dateMs: 1_750_000_000_000, top: 80, rir: 2 },
          { dateMs: 1_750_500_000_000, top: 82.5, rir: 2 },
          { dateMs: 1_751_000_000_000, top: 82.5, rir: 1 },
          { dateMs: 1_751_500_000_000, top: 85, rir: 2 },
        ],
      };
    }
    exercises.push(ex);
  }
  return {
    startedAt: 1_760_000_000_000,
    pausedElapsedSeconds: 0,
    workoutStartedAtMs: 1_760_000_000_000,
    title: "Trening A - klatka i plecy",
    workoutPlanId: "3f2c9e1a-7b4d-4e8a-9c2f-1a2b3c4d5e6f",
    cardioMinutes: 0,
    cardioExtras: { distanceKm: null, avgHr: null, calories: null, steps: null, paceMinPerKm: null },
    exercises,
    selectedExerciseId: "ex-2",
  };
}

const withDerived = JSON.stringify(typicalPayload(true));
const withoutDerived = JSON.stringify(typicalPayload(false));
const parseStringifyMs = timeMs(2000, () => {
  const o = JSON.parse(withDerived) as unknown;
  void JSON.stringify(o);
});

console.log("\n== B. Payload PUT (typowa sesja 6 ćwiczeń x 4 serie) ==");
console.log(`bajty z polami wyliczanymi przez klienta:  ${withDerived.length} (${(withDerived.length / 1024).toFixed(1)} KiB)`);
console.log(`bajty bez lastSessionSets/suggested/coach: ${withoutDerived.length} (${(withoutDerived.length / 1024).toFixed(1)} KiB)`);
console.log(`udział pól wyliczanych: ${(((withDerived.length - withoutDerived.length) / withDerived.length) * 100).toFixed(0)}%`);
console.log(`JSON.parse + JSON.stringify na serwerze (payload z pochodnymi): ${parseStringifyMs.toFixed(4)} ms`);
