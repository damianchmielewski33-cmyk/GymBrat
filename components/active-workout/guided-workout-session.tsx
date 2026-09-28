"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { SessionExerciseListSheet } from "@/components/active-workout/session-exercise-list-sheet";
import {
  formatCompletedSetLine,
  SessionRestScreen,
} from "@/components/active-workout/session-rest-screen";
import { SessionSetScreen } from "@/components/active-workout/session-set-screen";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import {
  clearExerciseRestSeconds,
  isRestMuted,
  readExerciseRestSeconds,
  writeExerciseRestSeconds,
  writeRestMuted,
} from "@/lib/exercise-rest-prefs";
import { readRestTimerPrefs, writeRestDefaultSeconds } from "@/lib/rest-timer-prefs";
import { playRestTimerEndSignal } from "@/lib/rest-timer-signal";
import { NewMaxCelebration } from "@/components/progress-analysis/new-max-celebration";
import { estimated1RM } from "@/lib/workout-history";
import type { ExercisePrs } from "@/lib/exercise-progress";
import {
  countSessionSets,
  findLastCompletedSet,
  findNextIncompleteSet,
} from "@/lib/session-cursor";

export function GuidedWorkoutSession({
  title,
  elapsedSeconds,
  exercises,
  selectedExerciseId,
  lastHints,
  saving,
  saveError,
  onSelectExercise,
  onPatchSet,
  onReset,
  onComplete,
}: {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  lastHints?: LastPlanHintsMap;
  saving: boolean;
  saveError?: string | null;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onReset: () => void;
  onComplete: () => void;
}) {
  const router = useRouter();
  const counts = useMemo(() => countSessionSets(exercises), [exercises]);
  const lastDone = useMemo(() => findLastCompletedSet(exercises), [exercises]);

  const [phase, setPhase] = useState<"log" | "rest">("log");
  const [restRemaining, setRestRemaining] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [remember, setRemember] = useState(true);
  const [muted, setMuted] = useState(false);
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const [newMax, setNewMax] = useState<{
    kind: "e1rm" | "weight" | "first";
    exerciseName: string;
    weight: number;
    reps: number;
  } | null>(null);
  const [prsCache, setPrsCache] = useState<Record<string, ExercisePrs | null>>({});

  const next = useMemo(() => {
    if (focusExerciseId) {
      const exerciseIndex = exercises.findIndex((e) => e.id === focusExerciseId);
      if (exerciseIndex >= 0) {
        const setIndex = exercises[exerciseIndex]!.sets.findIndex((s) => !s.done);
        if (setIndex >= 0) return { exerciseIndex, setIndex };
      }
    }
    return findNextIncompleteSet(exercises);
  }, [exercises, focusExerciseId]);

  const currentExercise =
    (next ? exercises[next.exerciseIndex] : null) ??
    exercises.find((e) => e.id === selectedExerciseId) ??
    exercises[0] ??
    null;

  useEffect(() => {
    setMuted(isRestMuted());
  }, []);

  useEffect(() => {
    if (currentExercise?.id) onSelectExercise(currentExercise.id);
  }, [currentExercise?.id, onSelectExercise]);

  useEffect(() => {
    if (phase !== "rest") return;
    const id = window.setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 0) return 0;
        if (r === 1) {
          queueMicrotask(() => playRestTimerEndSignal());
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  function restSecondsFor(exerciseId: string) {
    return readExerciseRestSeconds(exerciseId) ?? readRestTimerPrefs().defaultSeconds;
  }

  function startRestFor(exerciseId: string) {
    const seconds = restSecondsFor(exerciseId);
    setRemember(readExerciseRestSeconds(exerciseId) != null || remember);
    setRestRemaining(seconds);
    setPhase("rest");
  }

  const lastEx = lastDone ? exercises[lastDone.exerciseIndex] : null;
  const lastSet = lastEx?.sets[lastDone?.setIndex ?? -1];
  const lastLine =
    lastEx && lastSet && lastDone
      ? formatCompletedSetLine(lastEx.name, lastDone.setIndex, lastSet.weight, lastSet.reps)
      : "—";

  let nextKind: "set" | "exercise" | "finish" = "finish";
  let nextLabel = "Koniec treningu";
  if (next && currentExercise) {
    const sameExercise = lastDone?.exerciseIndex === next.exerciseIndex;
    nextKind = sameExercise || lastDone == null ? "set" : "exercise";
    nextLabel =
      nextKind === "set"
        ? `Seria ${next.setIndex + 1} z ${currentExercise.sets.length}`
        : currentExercise.name;
  }

  function confirmSet(values: {
    weight: number;
    reps: number;
    rpe: number | null;
    rir: number | null;
    tempo: string | null;
  }) {
    if (!currentExercise || !next) return;
    onPatchSet(currentExercise.id, next.setIndex, {
      weight: values.weight,
      reps: values.reps,
      rpe: values.rpe,
      rir: values.rir,
      tempo: values.tempo,
      done: true,
    });

    const name = currentExercise.name;
    const checkPr = (prs: ExercisePrs | null) => {
      if (!(values.weight > 0) || !(values.reps > 0)) return;
      const e1 = estimated1RM(values.weight, values.reps);
      if (!prs || (prs.maxE1rm.value <= 0 && prs.maxWeight.value <= 0)) {
        setNewMax({
          kind: "first",
          exerciseName: name,
          weight: values.weight,
          reps: values.reps,
        });
        return;
      }
      if (e1 > prs.maxE1rm.value + 0.05) {
        setNewMax({
          kind: "e1rm",
          exerciseName: name,
          weight: values.weight,
          reps: values.reps,
        });
      } else if (values.weight > prs.maxWeight.value + 0.05) {
        setNewMax({
          kind: "weight",
          exerciseName: name,
          weight: values.weight,
          reps: values.reps,
        });
      }
    };

    const cached = prsCache[name];
    if (cached !== undefined) {
      checkPr(cached);
    } else {
      void fetch(`/api/progress/exercise?q=${encodeURIComponent(name)}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data: { ok?: boolean; prs?: ExercisePrs }) => {
          const prs = data.ok && data.prs ? data.prs : null;
          setPrsCache((prev) => ({ ...prev, [name]: prs }));
          checkPr(prs);
        })
        .catch(() => checkPr(null));
    }

    startRestFor(currentExercise.id);
  }

  function continueFromRest() {
    setFocusExerciseId(null);
    setPhase("log");
    setRestRemaining(0);
  }

  function pickDuration(seconds: number) {
    setRestRemaining(seconds);
    writeRestDefaultSeconds(seconds);
    const exId = lastEx?.id ?? currentExercise?.id;
    if (remember && exId) writeExerciseRestSeconds(exId, seconds);
  }

  function toggleRemember() {
    const nextVal = !remember;
    setRemember(nextVal);
    const exId = lastEx?.id ?? currentExercise?.id;
    if (!exId) return;
    if (nextVal) writeExerciseRestSeconds(exId, restRemaining || restSecondsFor(exId));
    else clearExerciseRestSeconds(exId);
  }

  if (listOpen) {
    return (
      <SessionExerciseListSheet
        title={title.trim() || "Trening"}
        exercises={exercises}
        currentId={currentExercise?.id ?? null}
        saving={saving}
        saveError={saveError}
        onClose={() => setListOpen(false)}
        onPick={(id) => {
          setFocusExerciseId(id);
          onSelectExercise(id);
          setPhase("log");
          setListOpen(false);
        }}
        onReset={onReset}
        onComplete={onComplete}
      />
    );
  }

  if (!next) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-6 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/40">Gotowe</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold text-white">
          Wszystkie serie zaliczone
        </h1>
        {saveError ? <p className="mt-3 text-sm text-red-400">{saveError}</p> : null}
        <button
          type="button"
          onClick={onComplete}
          disabled={saving}
          className="mt-8 inline-flex h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408] disabled:opacity-40"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Zakończ trening
        </button>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="mt-3 text-sm text-white/50"
        >
          Lista ćwiczeń
        </button>
      </div>
    );
  }

  if (phase === "rest") {
    return (
      <SessionRestScreen
        title={title.trim() || "Trening"}
        elapsedSeconds={elapsedSeconds}
        doneSets={counts.done}
        totalSets={counts.total}
        remaining={restRemaining}
        remember={remember}
        muted={muted}
        lastLine={lastLine}
        nextLabel={nextLabel}
        nextKind={nextKind}
        onClose={() => router.push("/")}
        onOpenList={() => setListOpen(true)}
        onPickDuration={pickDuration}
        onRememberToggle={toggleRemember}
        onMuteToggle={() => {
          const n = !muted;
          setMuted(n);
          writeRestMuted(n);
        }}
        onAddThirty={() => setRestRemaining((r) => r + 30)}
        onContinue={continueFromRest}
      />
    );
  }

  if (!currentExercise) return null;

  const set = currentExercise.sets[next.setIndex]!;
  const hint = lastHints?.[currentExercise.id]?.sets[next.setIndex];
  const previousLabel =
    hint && hint.weight > 0
      ? `${hint.weight} kg × ${hint.reps ?? "—"}${hint.rir != null ? ` RIR${hint.rir}` : ""}`
      : null;
  const suggestedWeightKg =
    currentExercise.suggestedWeightKg ??
    lastHints?.[currentExercise.id]?.suggestedWeightKg ??
    null;
  const partners =
    currentExercise.supersetGroupId != null
      ? exercises
          .filter(
            (e) =>
              e.supersetGroupId === currentExercise.supersetGroupId &&
              e.id !== currentExercise.id,
          )
          .map((e) => e.name)
      : [];

  return (
    <>
      <NewMaxCelebration payload={newMax} onClose={() => setNewMax(null)} />
      <SessionSetScreen
      title={title.trim() || "Trening"}
      elapsedSeconds={elapsedSeconds}
      doneSets={counts.done}
      totalSets={counts.total}
      exerciseName={currentExercise.name}
      setIndex={next.setIndex}
      setCount={currentExercise.sets.length}
      initial={set}
      previousLabel={previousLabel}
      suggestedWeightKg={suggestedWeightKg}
      videoUrl={currentExercise.videoUrl}
      catalogId={currentExercise.catalogId}
      supersetPartnerNames={partners}
      onClose={() => router.push("/")}
      onOpenList={() => setListOpen(true)}
      onConfirm={confirmSet}
    />
    </>
  );
}
