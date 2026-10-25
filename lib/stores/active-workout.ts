import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  EMPTY_CARDIO_EXTRAS,
  type ActiveCardioExtras,
} from "@/lib/cardio-utils";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import type { SkippedWorkoutTarget } from "@/lib/workout-skipped-sets";
import type { WorkoutFinishedScreenData } from "@/components/active-workout/workout-finish-types";

/** Re-eksport — importy istniejące w repo wskazują na ten moduł. */
export type { ActiveCardioExtras };

/**
 * Stan przepływu zakończenia (ADR 0004 p.4): żyje w store, nie w `useState` lokalnym,
 * bo trzy komponenty montowane niezależnie (ekran, pasek globalny, menu sesji) muszą
 * widzieć ten samy stan (np. pasek musi zniknąć, gdy ekran jest w trakcie zapisu).
 */
export type WorkoutFinishFlowState =
  | { phase: "idle" }
  | {
      phase: "skipped-dialog";
      skippedCount: number;
      incompleteCount: number;
      target: SkippedWorkoutTarget;
    }
  | { phase: "saving" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: WorkoutFinishedScreenData };

type ActiveWorkoutState = {
  /** Kotwica działającego licznika (null = pauza) */
  startedAt: number | null;
  /** Sekundy zatrzymanego czasu (suma po „Koniec”) */
  pausedElapsedSeconds: number;
  /** Pierwsze kliknięcie Start — do zapisu API */
  workoutStartedAtMs: number | null;
  /**
   * Klucz idempotencji zapisu (ADR 0004 p.1): UUID v4 wygenerowany raz na sesję, w `start()`.
   * Ten sam klucz jedzie w każdej próbie zapisu (pierwszej, ponowieniu po błędzie, kolejce
   * offline) — serwer traktuje powtórzony klucz jako duplikat, nie drugi trening.
   */
  operationId: string | null;
  /** Blokada równoległego zapisu z trzech wejść zakończenia (ekran, pasek, menu). */
  finishPending: boolean;
  /** Stan wspólnego przepływu zakończenia (ADR 0004 p.4) — jedno źródło prawdy dla UI. */
  finishFlow: WorkoutFinishFlowState;
  title: string;
  workoutPlanId: string | null;
  cardioMinutes: number;
  /** Dystans / HR / kcal / kroki przy cardio po siłowym. */
  cardioExtras: ActiveCardioExtras;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  /** Ukryj dolny pasek aktywnej sesji do czasu wejścia na `/active-workout` (unika mignięcia przy starcie). */
  hideGlobalBarForRoute: boolean;
  setHideGlobalBarForRoute: (hide: boolean) => void;
  setTitle: (t: string) => void;
  setCardioMinutes: (n: number) => void;
  setCardioExtras: (extras: Partial<ActiveCardioExtras>) => void;
  setSelectedExerciseId: (id: string | null) => void;
  setExercises: (exercises: WorkoutExerciseState[]) => void;
  patchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  patchExercise: (
    exerciseId: string,
    patch: Partial<Pick<WorkoutExerciseState, "note">>,
  ) => void;
  addSet: (exerciseId: string) => number | null;
  removeLastSet: (exerciseId: string) => number | null;
  start: () => void;
  stopTimer: () => void;
  applyPlan: (planId: string, plan: WorkoutPlanPayload) => void;
  reset: () => void;
  beginFinish: () => void;
  endFinish: () => void;
  setFinishFlow: (state: WorkoutFinishFlowState) => void;
  /** Gwarantuje `operationId` — sesje wznowione z wersji store bez idempotencji (migracja) mogą go nie mieć. */
  ensureOperationId: () => string;
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      startedAt: null,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: null,
      operationId: null,
      finishPending: false,
      finishFlow: { phase: "idle" },
      title: "Sesja",
      workoutPlanId: null,
      cardioMinutes: 0,
      cardioExtras: { ...EMPTY_CARDIO_EXTRAS },
      exercises: [],
      selectedExerciseId: null,
      hideGlobalBarForRoute: false,
      setHideGlobalBarForRoute: (hideGlobalBarForRoute) =>
        set({ hideGlobalBarForRoute }),
      setTitle: (title) => set({ title }),
      setCardioMinutes: (cardioMinutes) => set({ cardioMinutes }),
      setCardioExtras: (extras) =>
        set((s) => ({
          cardioExtras: { ...s.cardioExtras, ...extras },
        })),
      setSelectedExerciseId: (selectedExerciseId) => set({ selectedExerciseId }),
      setExercises: (exercises) => set({ exercises }),
      patchSet: (exerciseId, setIndex, patch) =>
        set((s) => {
          const ex = s.exercises.find((e) => e.id === exerciseId);
          const current = ex?.sets[setIndex];
          if (!current) return {};

          const nextSet: WorkoutSetState = {
            ...current,
            ...patch,
          };

          if (patch.done === undefined) {
            // Auto-ukończenie tylko przy realnym ciężarze i powtórzeniach.
            // Ciężar 0 / pusty → nie świeć na zielono (użytkownik klika „Pomiń serię”).
            nextSet.done =
              nextSet.reps != null &&
              Number.isFinite(nextSet.reps) &&
              nextSet.reps > 0 &&
              Number.isFinite(nextSet.weight) &&
              nextSet.weight > 0;
          }

          // Ghost Training — znacznik czasu ukończenia serii (elapsed sesji).
          if (nextSet.done && !current.done && nextSet.elapsedSecondsAtCompletion == null) {
            const started = s.startedAt;
            const paused = s.pausedElapsedSeconds ?? 0;
            const elapsed = started
              ? paused + Math.max(0, Math.floor((Date.now() - started) / 1000))
              : paused;
            nextSet.elapsedSecondsAtCompletion = elapsed;
          }

          return {
            exercises: s.exercises.map((e) =>
              e.id !== exerciseId
                ? e
                : {
                    ...e,
                    sets: e.sets.map((setRow, i) => (i === setIndex ? nextSet : setRow)),
                  },
            ),
          };
        }),
      patchExercise: (exerciseId, patch) =>
        set((s) => ({
          exercises: s.exercises.map((e) =>
            e.id !== exerciseId ? e : { ...e, ...patch },
          ),
        })),
      addSet: (exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        if (!ex) return null;
        const last = ex.sets[ex.sets.length - 1];
        const newIndex = ex.sets.length;
        set({
          exercises: get().exercises.map((e) =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  sets: [
                    ...e.sets,
                    {
                      reps: last?.reps ?? e.targetReps ?? null,
                      weight: last?.weight ?? 0,
                      done: false,
                      skipped: false,
                      rpe: null,
                      rir: e.targetRir ?? null,
                    },
                  ],
                },
          ),
        });
        return newIndex;
      },
      removeLastSet: (exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        if (!ex || ex.sets.length <= 1) return null;
        const nextSets = ex.sets.slice(0, -1);
        const nextIndex = Math.max(0, nextSets.length - 1);
        set({
          exercises: get().exercises.map((e) =>
            e.id !== exerciseId ? e : { ...e, sets: nextSets },
          ),
        });
        return nextIndex;
      },
      start: () =>
        set((s) => ({
          startedAt: Date.now(),
          workoutStartedAtMs: s.workoutStartedAtMs ?? Date.now(),
          // Jeden operationId na całą sesję — wygenerowany przy pierwszym Start, nie
          // przy każdym Wznów (ADR 0004 p.1).
          operationId: s.operationId ?? crypto.randomUUID(),
        })),
      stopTimer: () =>
        set((s) => {
          if (s.startedAt == null) return {};
          const add = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
          return {
            startedAt: null,
            pausedElapsedSeconds: s.pausedElapsedSeconds + add,
          };
        }),
      applyPlan: (planId, plan) =>
        set({
          workoutPlanId: planId,
          title: plan.planName.trim() || "Sesja",
          startedAt: null,
          pausedElapsedSeconds: 0,
          workoutStartedAtMs: null,
          operationId: null,
          finishPending: false,
          finishFlow: { phase: "idle" },
          cardioMinutes: 0,
          cardioExtras: { ...EMPTY_CARDIO_EXTRAS },
          exercises: [],
          selectedExerciseId: null,
        }),
      reset: () =>
        set({
          startedAt: null,
          pausedElapsedSeconds: 0,
          workoutStartedAtMs: null,
          operationId: null,
          finishPending: false,
          finishFlow: { phase: "idle" },
          title: "Sesja",
          workoutPlanId: null,
          cardioMinutes: 0,
          cardioExtras: { ...EMPTY_CARDIO_EXTRAS },
          exercises: [],
          selectedExerciseId: null,
        }),
      beginFinish: () => set({ finishPending: true }),
      endFinish: () => set({ finishPending: false }),
      setFinishFlow: (finishFlow) => set({ finishFlow }),
      ensureOperationId: () => {
        const existing = get().operationId;
        if (existing) return existing;
        const next = crypto.randomUUID();
        set({ operationId: next });
        return next;
      },
    }),
    {
      name: "active-workout",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        startedAt: s.startedAt,
        pausedElapsedSeconds: s.pausedElapsedSeconds,
        workoutStartedAtMs: s.workoutStartedAtMs,
        operationId: s.operationId,
        title: s.title,
        workoutPlanId: s.workoutPlanId,
        cardioMinutes: s.cardioMinutes,
        cardioExtras: s.cardioExtras,
        exercises: s.exercises,
        selectedExerciseId: s.selectedExerciseId,
      }),
      version: 3,
      migrate: (persisted) => {
        const p = persisted as Record<string, unknown>;
        if (!p.cardioExtras || typeof p.cardioExtras !== "object") {
          p.cardioExtras = { ...EMPTY_CARDIO_EXTRAS };
        }
        if (typeof p.operationId !== "string") {
          // Sesja wznowiona z wersji bez idempotencji — serie są zachowane; nowy klucz
          // dostaje przy następnym `start()` (np. po „Wznów”).
          p.operationId = null;
        }
        return p as never;
      },
    },
  ),
);
