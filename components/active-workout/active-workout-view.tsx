"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GymPadSessionLayout } from "@/components/active-workout/gympad-session-layout";
import { PlanProgressHeader } from "@/components/active-workout/plan-progress-header";
import { WorkoutPlanCard } from "@/components/active-workout/workout-plan-card";
import { RestTimerBar } from "@/components/workout/RestTimerBar";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Domyślnie 3 serie: reps z planu, weight 0, done false. */
function planExercisesToSession(exercises: WorkoutPlanExercise[]): WorkoutExerciseState[] {
  return exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    sets: Array.from({ length: 3 }, () => ({
      reps: clampInt(ex.reps, 1, 99),
      weight: 0,
      done: false,
    })),
  }));
}

function formatLastWorkoutDate(ymd: string | null) {
  if (!ymd) return "Jeszcze nie trenowano";
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return ymd;
  }
}

export function ActiveWorkoutView({
  initialPlans,
}: {
  initialPlans: WorkoutPlanWithLastWorkoutDTO[];
}) {
  const {
    startedAt,
    pausedElapsedSeconds,
    workoutStartedAtMs,
    title,
    workoutPlanId,
    applyPlan,
    start,
    reset,
  } = useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();

  const [cardioMinutes, setCardioMinutes] = useState<number>(20);
  const [exercises, setExercises] = useState<WorkoutExerciseState[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  /** Inkrementowane przy każdym starcie odpoczynku — stabilny interval w useEffect */
  const [restSessionId, setRestSessionId] = useState(0);

  const hasLoadedPlan = workoutPlanId != null && exercises.length > 0;

  function startRest(seconds: number) {
    setRestRemaining(seconds);
    setRestSessionId((x) => x + 1);
  }

  const sessionTotal = useMemo(() => sessionVolume(exercises), [exercises]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const id = window.setInterval(() => {
      setRestRemaining((r) => {
        if (r === null || r <= 1) return null;
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restSessionId]);

  const elapsed = useMemo(() => {
    const running =
      startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return pausedElapsedSeconds + running;
  }, [now, startedAt, pausedElapsedSeconds]);

  const completedSets = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        total += 1;
        if (s.done) done += 1;
      }
    }
    return { done, total };
  }, [exercises]);

  function patchSet(exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) {
    setExercises((prev) => {
      const target = prev.find((e) => e.id === exerciseId);
      const wasDone = target?.sets[setIndex]?.done;
      if (patch.done === true && !wasDone) {
        queueMicrotask(() => startRest(90));
      }
      return prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
        };
      });
    });
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              reps: last ? last.reps : 10,
              weight: last ? last.weight : 0,
              done: false,
            },
          ],
        };
      }),
    );
  }

  function removeLastSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.slice(0, -1) };
      }),
    );
  }

  function beginWorkoutFromPlan(row: WorkoutPlanWithLastWorkoutDTO) {
    if (row.plan.exercises.length === 0) return;
    applyPlan(row.id, row.plan);
    const next = planExercisesToSession(row.plan.exercises);
    setExercises(next);
    setSelectedExerciseId(next[0]?.id ?? null);
    setSaveError(null);
    stopRest();
    start();
  }

  function stopRest() {
    setRestRemaining(null);
    setRestSessionId((x) => x + 1);
  }

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
      const endedAt = Date.now();
      const res = await fetch("/api/workouts/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          startedAt: workoutStartedAtMs ?? startedAt ?? Date.now(),
          endedAt,
          cardioMinutes,
          exercises,
          workoutPlanId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Nie udało się zapisać treningu");
      }
      reset();
      setExercises([]);
      setSelectedExerciseId(null);
      stopRest();
      router.push("/reports");
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Nie udało się zapisać treningu");
    } finally {
      setSaving(false);
    }
  }

  const exerciseList = (
    <GymPadSessionLayout
      title={title}
      elapsedSeconds={elapsed}
      exercises={exercises}
      selectedExerciseId={selectedExerciseId}
      onSelectExercise={setSelectedExerciseId}
      onPatchSet={patchSet}
      onAddSet={addSet}
      onRemoveLastSet={removeLastSet}
    />
  );

  return (
    <div
      className={
        hasLoadedPlan
          ? "relative ml-[calc(50%-50vw)] w-screen max-w-[100vw] overflow-x-hidden bg-black pb-28 pt-0 sm:pb-32"
          : "relative min-h-[calc(100dvh-6rem)] rounded-2xl bg-[#0f0f0f] p-4 sm:p-6 lg:min-h-[calc(100dvh-5rem)]"
      }
    >
      {hasLoadedPlan ? (
        <PlanProgressHeader done={completedSets.done} total={completedSets.total} title={title} />
      ) : null}

      {hasLoadedPlan ? (
        <RestTimerBar remaining={restRemaining} onStart={startRest} onStop={stopRest} />
      ) : null}

      <div
        className={
          hasLoadedPlan
            ? "mx-auto w-full max-w-[min(100%,720px)] px-4 pb-4 pt-2 sm:px-6"
            : "mx-auto max-w-[1400px]"
        }
      >
        <div
          className={
            hasLoadedPlan ? "grid gap-0" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start"
          }
        >
          <ActiveSessionCard
            hasLoadedPlan={hasLoadedPlan}
            initialPlansEmpty={initialPlans.length === 0}
            cardioMinutes={cardioMinutes}
            onCardioChange={(n) => setCardioMinutes(clampInt(n, 0, 600))}
            onResetSession={() => {
              reset();
              setExercises([]);
              setSelectedExerciseId(null);
              stopRest();
            }}
          >
            {hasLoadedPlan ? exerciseList : null}
          </ActiveSessionCard>

          {!hasLoadedPlan ? (
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="flex max-h-[min(88vh,900px)] flex-col gap-4 lg:sticky lg:top-4"
            >
              <div className="shrink-0 px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Biblioteka
                </p>
                <h2 className="font-heading mt-1 text-xl font-semibold text-white">Plany treningowe</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Od najnowszego do najdawniejszego treningu z planu.
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12">
                {initialPlans.length === 0 ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-white/55 backdrop-blur-[12px]"
                  >
                    Brak planów.{" "}
                    <Link
                      href="/workout-plan"
                      className="font-medium text-[#FF1A4B] underline-offset-2 hover:underline"
                    >
                      Utwórz plan
                    </Link>
                    .
                  </motion.p>
                ) : (
                  initialPlans.map((row, i) => {
                    const empty = row.plan.exercises.length === 0;
                    const active = workoutPlanId === row.id;
                    return (
                      <WorkoutPlanCard
                        key={row.id}
                        row={row}
                        index={i}
                        active={active}
                        empty={empty}
                        lastActivityLabel={formatLastWorkoutDate(row.lastWorkoutDate)}
                        onStart={() => beginWorkoutFromPlan(row)}
                        startLabel={active ? "Wczytaj ponownie" : "Rozpocznij trening"}
                      />
                    );
                  })
                )}
              </div>
            </motion.aside>
          ) : null}
        </div>
      </div>

      {hasLoadedPlan ? (
        <WorkoutSummary
          sessionTotal={sessionTotal}
          canComplete={hasLoadedPlan}
          saving={saving}
          onComplete={completeWorkout}
          saveError={saveError}
        />
      ) : null}
    </div>
  );
}
