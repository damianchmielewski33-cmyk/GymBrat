// Pomiar kosztu modeli ekranu aktywnego treningu (zadanie 004, etap 9) wykonywanych przy każdej zmianie store
// (np. każde naciśnięcie klawisza w polu ciężaru): buildSessionProgress, buildSetSuggestionView,
// buildRestNextStep, buildSupersetLabels, ghost-ticker (reduce po wszystkich seriach) i serializacja
// payloadu do localStorage/chmury (`persistActiveWorkoutLocalNow` robi JSON.stringify całej sesji).
// Uzycie (z korzenia repo):
//   npx vitest run --config docs/wydajnosc/skrypty/001-vitest.config.ts docs/wydajnosc/skrypty/004-session-model.bench.ts
// Wynik: czas p50 / p95 w mikrosekundach dla planów 7x4 (typowy), 12x5 i 20x6 (skrajny), bez renderu React.
import { describe, it } from "vitest";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { buildSessionProgress } from "@/lib/workout-session-progress";
import { buildSetSuggestionView } from "@/lib/set-suggestion-view";
import { buildRestNextStep } from "@/lib/rest-next-step";
import { buildSupersetLabels } from "@/lib/start-workout-session";

const ITER = Number(process.env.BENCH_ITER ?? 2000);

function set(i: number, done: boolean, weight: number, reps: number | null, skipped = false): WorkoutSetState {
  return { reps, weight, done, skipped, rpe: null, rir: 1 } as WorkoutSetState;
}

function plan(exercises: number, setsPer: number): WorkoutExerciseState[] {
  const out: WorkoutExerciseState[] = [];
  for (let e = 0; e < exercises; e++) {
    const sets: WorkoutSetState[] = [];
    for (let s = 0; s < setsPer; s++) {
      // Połowa serii zrobiona (ostatnie ćwiczenia puste), żeby model liczył wszystkie gałęzie.
      const done = e < exercises / 2 ? true : s < 1;
      sets.push(done ? set(s, true, 60 + s, 8) : set(s, false, 0, 8));
    }
    out.push({
      id: `ex-${e}`,
      name: `Ćwiczenie testowe ${e + 1}`,
      sets,
      targetSets: setsPer,
      targetReps: 8,
      targetRir: 1,
      lastSessionSets: Array.from({ length: setsPer }, (_, s) => ({
        reps: 8,
        weight: 60 + s,
        done: true,
        skipped: false,
        rpe: null,
        rir: 2,
      })),
      suggestedWeights: Array.from({ length: setsPer }, () => 62.5),
      coachContext: { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 },
    } as unknown as WorkoutExerciseState);
  }
  return out;
}

function percentiles(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return { p50: at(50), p95: at(95) };
}

function time(fn: () => unknown, iter = ITER): { p50: number; p95: number } {
  const samples: number[] = [];
  let sink = 0;
  for (let i = 0; i < iter; i++) {
    const t0 = performance.now();
    const r = fn();
    samples.push((performance.now() - t0) * 1000); // µs
    sink += r ? 1 : 0;
  }
  if (sink === -1) throw new Error("unreachable");
  return percentiles(samples);
}

describe("004 — koszt modeli sesji przy zmianie store", () => {
  for (const [ex, sets] of [
    [7, 4],
    [12, 5],
    [20, 6],
  ] as const) {
    it(`plan ${ex}x${sets}`, () => {
      const exercises = plan(ex, sets);
      const current = { exerciseId: exercises[Math.floor(ex / 2)].id, setIndex: 1 };
      const payloadBytes = JSON.stringify({ exercises, selectedExerciseId: current.exerciseId }).length;

      const progress = time(() => buildSessionProgress(exercises, current));
      const suggestion = time(() => buildSetSuggestionView(exercises[Math.floor(ex / 2)], 1));
      const superset = time(() => buildSupersetLabels(exercises));
      const ghostReduce = time(() =>
        exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && !s.skipped).length, 0),
      );
      const rest = time(() =>
        buildRestNextStep(exercises, { exerciseId: exercises[0].id, setIndex: 0 }),
      );
      const serialize = time(() => JSON.stringify({ exercises }), Math.min(ITER, 500));

      console.log(
        JSON.stringify(
          {
            plan: `${ex}x${sets}`,
            serieTotal: ex * sets,
            payloadBytes,
            usOnChange: {
              buildSessionProgress: progress,
              buildSetSuggestionView_1ex: suggestion,
              buildSupersetLabels: superset,
              ghostTickerReduce: ghostReduce,
              buildRestNextStep: rest,
              jsonStringifyPayload: serialize,
            },
          },
          null,
          1,
        ),
      );
    });
  }
});
