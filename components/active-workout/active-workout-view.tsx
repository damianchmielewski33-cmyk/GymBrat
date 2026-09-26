"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  fetchLastWorkoutHintsForPlan,
  type WorkoutPlanWithLastWorkoutDTO,
} from "@/actions/workout-plan";
import { mergeHintsIntoExercises } from "@/lib/last-workout-hints";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GuidedSessionLayout } from "@/components/active-workout/guided-session-layout";
import { WorkoutFinishedScreen } from "@/components/active-workout/workout-finished-screen";
import { StartWorkoutScreen } from "@/components/active-workout/start-workout-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RestBreakScreen } from "@/components/active-workout/rest-break-screen";
import { readRestTimerPrefs } from "@/lib/rest-timer-prefs";
import { playRestTimerEndSignal } from "@/lib/rest-timer-signal";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { mapUnknownFetchError, UserMessages } from "@/lib/user-facing-errors";
import { submitCompletedWorkout } from "@/lib/workout-complete-submit";
import { RotateCcw } from "lucide-react";

type LastCompletedSnap = {
  exerciseName: string;
  setIndex: number;
  setCount: number;
  weight: number;
  reps: number;
  nextLabel: string;
  nextValue: string;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Serie z planu (domyślnie 3); powtórzenia startowe z planu. */
function planExercisesToSession(exercises: WorkoutPlanExercise[]): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const setCount =
      typeof ex.sets === "number" && Number.isFinite(ex.sets) && ex.sets > 0
        ? clampInt(ex.sets, 1, 20)
        : 3;
    const reps =
      typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
        ? clampInt(ex.reps, 1, 99)
        : null;
    return {
      id: ex.id,
      name: ex.name,
      targetSets: setCount,
      targetReps: reps ?? undefined,
      targetRir: 1,
      tempo: null,
      sets: Array.from({ length: setCount }, () => ({
        reps,
        weight: 0,
        done: false,
        rpe: null,
        rir: 1,
      })),
    };
  });
}

export function ActiveWorkoutView({
  initialPlans,
  entry = "active",
  display = "page",
  homeStats = null,
  workoutDaysThisWeek = [false, false, false, false, false, false, false],
}: {
  initialPlans: WorkoutPlanWithLastWorkoutDTO[];
  entry?: "active" | "start";
  display?: "page" | "modal";
  homeStats?: import("@/lib/home-stats").HomeStats | null;
  workoutDaysThisWeek?: boolean[];
}) {
  const {
    startedAt,
    pausedElapsedSeconds,
    workoutStartedAtMs,
    title,
    workoutPlanId,
    cardioMinutes,
    exercises,
    selectedExerciseId,
    applyPlan,
    start,
    reset,
    setCardioMinutes: _setCardioMinutes,
    setExercises,
    setSelectedExerciseId,
    patchSet: patchSetInStore,
    patchExercise,
  } = useActiveWorkoutStore();
  void _setCardioMinutes;
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const [lastPlanHints, setLastPlanHints] = useState<LastPlanHintsMap>({});
  const hintsMergedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restSoundOn, setRestSoundOn] = useState(true);
  const [lastCompleted, setLastCompleted] = useState<LastCompletedSnap | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);
  /** Bez tego pierwszy render `/active-workout` widzi pusty stan zanim wczyta się localStorage → fałszywy redirect na `/start-workout`. */
  const [storeHydrated, setStoreHydrated] = useState(false);

  const hasLoadedPlan = workoutPlanId != null && exercises.length > 0;

  useLayoutEffect(() => {
    const api = useActiveWorkoutStore.persist;
    if (api.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = api.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    hintsMergedRef.current = false;
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId) {
      setLastPlanHints({});
      return;
    }
    let cancelled = false;
    void fetchLastWorkoutHintsForPlan(workoutPlanId).then((h) => {
      if (!cancelled) setLastPlanHints(h);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId || hintsMergedRef.current) return;
    const ex = useActiveWorkoutStore.getState().exercises;
    if (!ex.length) return;
    if (!Object.keys(lastPlanHints).length) {
      hintsMergedRef.current = true;
      return;
    }
    setExercises(mergeHintsIntoExercises(ex, lastPlanHints));
    hintsMergedRef.current = true;
  }, [lastPlanHints, workoutPlanId, setExercises]);

  // Route gating:
  // - `/active-workout` is a strict "session view" and must NOT be accessible without an active session.
  // - `/start-workout` is the entry point that lets user pick a plan and begin a session.
  useEffect(() => {
    if (display !== "page") return;
    if (suppressRouteGate || !storeHydrated) return;
    if (entry === "active" && !hasLoadedPlan) {
      router.replace("/workout-plan");
      return;
    }
    if (entry === "start" && hasLoadedPlan) {
      router.replace("/active-workout");
    }
  }, [display, entry, hasLoadedPlan, router, suppressRouteGate, storeHydrated]);

  function startRest(seconds: number) {
    setRestRemaining(seconds);
  }

  function stopRest() {
    setRestRemaining(null);
  }

  function buildCompletedSnap(
    exerciseId: string,
    setIndex: number,
    weight: number,
    reps: number,
  ): LastCompletedSnap | null {
    const idx = exercises.findIndex((e) => e.id === exerciseId);
    const ex = exercises[idx];
    if (!ex) return null;
    const nextSetIdx = setIndex + 1;
    let nextLabel = "Następna seria";
    let nextValue = `Seria ${nextSetIdx + 1} z ${ex.sets.length}`;
    if (nextSetIdx >= ex.sets.length) {
      const nextEx = exercises[idx + 1];
      if (nextEx) {
        nextLabel = "Następne ćwiczenie";
        nextValue = nextEx.name;
      } else {
        nextLabel = "Koniec";
        nextValue = "Ostatnia seria zaliczona";
      }
    }
    return {
      exerciseName: ex.name,
      setIndex,
      setCount: ex.sets.length,
      weight,
      reps,
      nextLabel,
      nextValue,
    };
  }

  const sessionTotal = useMemo(() => sessionVolume(exercises), [exercises]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    /** Na ekranie wyboru planu nie pytamy o wznowienie — użytkownik świadomie zaczyna ścieżkę treningu. */
    if (entry === "start") return;

    const skipOnceKey = "active-workout:skipResumeOnce";
    if (sessionStorage.getItem(skipOnceKey) === "1") {
      sessionStorage.removeItem(skipOnceKey);
      return;
    }

    const seenKey = "active-workout:resumePromptSeen";
    if (sessionStorage.getItem(seenKey) === "1") return;

    const raw = localStorage.getItem("active-workout");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const state =
        parsed && typeof parsed === "object" && "state" in parsed
          ? (parsed as { state?: unknown }).state
          : null;

      const s = state && typeof state === "object" ? (state as Record<string, unknown>) : null;
      const hasPersistedSession =
        s &&
        typeof s === "object" &&
        typeof s.workoutPlanId === "string" &&
        s.workoutPlanId.length > 0 &&
        Array.isArray(s.exercises) &&
        s.exercises.length > 0;

      if (hasPersistedSession) {
        // Ustawiamy od razu, żeby popup nie wracał przy nawigacji między ekranami
        // (np. gdy użytkownik przejdzie na inną stronę zanim kliknie w modal).
        sessionStorage.setItem(seenKey, "1");
        setResumePromptOpen(true);
      }
    } catch {
      // ignore malformed storage; user can start fresh
    }
  }, [entry]);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const id = window.setInterval(() => {
      setRestRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (r === 1 && restSoundOn) {
            queueMicrotask(() => playRestTimerEndSignal());
          }
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRemaining, restSoundOn]);

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

  function patchSet(
    exerciseId: string,
    setIndex: number,
    patch: Partial<{
      reps: number | null;
      weight: number;
      done: boolean;
      rpe: number | null;
      rir: number | null;
    }>,
  ) {
    const ex = exercises.find((e) => e.id === exerciseId);
    const current = ex?.sets[setIndex];
    const wasDone = current?.done ?? false;

    patchSetInStore(exerciseId, setIndex, patch);

    // Start odpoczynku tylko przy przejściu false -> true (auto-done po wpisaniu danych).
    const nextReps = patch.reps !== undefined ? patch.reps : current?.reps ?? null;
    const nextWeight = patch.weight !== undefined ? patch.weight : current?.weight ?? 0;
    const isDoneNext =
      patch.done !== undefined
        ? patch.done
        : nextReps != null &&
          Number.isFinite(nextReps) &&
          nextReps > 0 &&
          Number.isFinite(nextWeight) &&
          nextWeight > 0;
    if (isDoneNext && !wasDone) {
      const { autoStart, defaultSeconds } = readRestTimerPrefs();
      if (autoStart) {
        const snap = buildCompletedSnap(
          exerciseId,
          setIndex,
          Number(nextWeight) || 0,
          Number(nextReps) || 0,
        );
        if (snap) setLastCompleted(snap);
        queueMicrotask(() => startRest(defaultSeconds));
      }
    }
  }

  function beginWorkoutFromPlan(row: WorkoutPlanWithLastWorkoutDTO) {
    if (row.plan.exercises.length === 0) return;
    hintsMergedRef.current = false;
    applyPlan(row.id, row.plan);
    const next = planExercisesToSession(row.plan.exercises);
    setExercises(next);
    setSelectedExerciseId(next[0]?.id ?? null);
    setSaveError(null);
    stopRest();
    start();
    if (entry === "start") {
      sessionStorage.setItem("active-workout:skipResumeOnce", "1");
      /** Nawigacja: wyłącznie efekt „route gate” (`start` + `hasLoadedPlan` → `replace`), żeby uniknąć podwójnego push/replace i wyścigów z hydracją. */
    }
  }

  const [finishOpen, setFinishOpen] = useState(false);

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
      // Prevent the `/active-workout` gate from overriding the redirect
      // after we reset the active session state.
      setSuppressRouteGate(true);

      const endedAt = Date.now();
      const baseSummary = {
        title: title.trim() || "Trening",
        endedAt,
        durationSeconds: elapsed,
        cardioMinutes,
        exercisesCount: exercises.length,
        setsDone: completedSets.done,
        setsTotal: completedSets.total,
        totalVolume: sessionTotal,
      };
      const result = await submitCompletedWorkout({
        title,
        startedAt: workoutStartedAtMs ?? startedAt ?? Date.now(),
        endedAt,
        cardioMinutes,
        exercises,
        workoutPlanId,
      });
      if (result.status === "error") {
        throw new Error(result.message);
      }
      reset();
      setExercises([]);
      setSelectedExerciseId(null);
      stopRest();
      setFinishOpen(false);
      const completedSummary = {
        ...baseSummary,
        strengthDeltaPercent:
          result.status === "saved"
            ? result.strengthDeltaPercent
            : null,
      };
      sessionStorage.setItem("workout:completedSummary", JSON.stringify(completedSummary));
      if (result.status === "queued") {
        sessionStorage.setItem("gymbrat:workoutQueued", "1");
      } else {
        sessionStorage.removeItem("gymbrat:workoutQueued");
      }
      router.push("/workout-plan");
    } catch (e) {
      setSaveError(mapUnknownFetchError(e, UserMessages.workoutSaveUnknown));
      setSuppressRouteGate(false);
    } finally {
      setSaving(false);
    }
  }

  const exerciseList = (
    <GuidedSessionLayout
      title={title}
      elapsedSeconds={elapsed}
      exercises={exercises}
      selectedExerciseId={selectedExerciseId}
      listOpen={listOpen}
      onListOpenChange={setListOpen}
      onSelectExercise={(id) => setSelectedExerciseId(id)}
      onPatchSet={patchSet}
      onExerciseNoteChange={(exerciseId, note) =>
        patchExercise(exerciseId, { note })
      }
      onCancelSession={() => {
        if (
          !window.confirm(
            "Anulować sesję? Postęp z tej sesji nie zostanie zapisany.",
          )
        ) {
          return;
        }
        reset();
        setExercises([]);
        setSelectedExerciseId(null);
        stopRest();
        router.push("/workout-plan");
      }}
      onFinishSession={() => {
        setFinishOpen(true);
      }}
      finishPending={saving}
      onDeferExercise={() => {
        /* lista / kolejność — „Wrócę później” przechodzi do następnego w GuidedSessionLayout */
      }}
    />
  );

  const startPlansContent =
    !hasLoadedPlan && entry === "start" ? (
      <StartWorkoutScreen
        plans={initialPlans}
        activePlanId={workoutPlanId}
        onBegin={beginWorkoutFromPlan}
        homeStats={homeStats}
        workoutDaysThisWeek={workoutDaysThisWeek}
      />
    ) : null;

  return (
    <div
      className={
        hasLoadedPlan
          ? display === "modal"
            ? "relative bg-black"
            : "relative ml-[calc(50%-50vw)] w-screen max-w-[100vw] overflow-x-hidden bg-black pb-36 pt-0 sm:pb-40"
          : "relative min-h-[calc(100dvh-6rem)] rounded-2xl bg-[#0f0f0f] p-4 sm:p-6 lg:min-h-[calc(100dvh-5rem)]"
      }
    >
      {hasLoadedPlan && restRemaining != null && restRemaining > 0 ? (
        <RestBreakScreen
          open
          remaining={restRemaining}
          title={title}
          elapsedSeconds={elapsed}
          setsDone={completedSets.done}
          setsTotal={completedSets.total}
          completedLine={
            lastCompleted
              ? `${lastCompleted.exerciseName} · seria ${lastCompleted.setIndex + 1}: ${lastCompleted.weight} kg × ${lastCompleted.reps}`
              : null
          }
          nextLabel={lastCompleted?.nextLabel ?? "Następna seria"}
          nextValue={lastCompleted?.nextValue ?? "—"}
          soundOn={restSoundOn}
          onToggleSound={() => setRestSoundOn((v) => !v)}
          onAddSeconds={(sec) =>
            setRestRemaining((r) => (r == null ? sec : r + sec))
          }
          onSetSeconds={(sec) => setRestRemaining(sec)}
          onContinue={() => stopRest()}
          onCloseSession={() => {
            if (
              !window.confirm(
                "Anulować sesję? Postęp z tej sesji nie zostanie zapisany.",
              )
            ) {
              return;
            }
            reset();
            setExercises([]);
            setSelectedExerciseId(null);
            stopRest();
            router.push("/workout-plan");
          }}
          onOpenList={() => {
            stopRest();
            setListOpen(true);
          }}
        />
      ) : null}

      <div
        className={
          hasLoadedPlan
            ? display === "modal"
              ? "mx-auto w-full max-w-[min(100%,720px)] px-4 pb-4 pt-2 sm:px-6"
              : "mx-auto w-full max-w-[min(100%,720px)] px-4 pb-4 pt-2 sm:px-6"
            : "mx-auto max-w-[1400px]"
        }
      >
        <div className={hasLoadedPlan ? "grid gap-0" : ""}>
          <ActiveSessionCard
            hasLoadedPlan={hasLoadedPlan}
            initialPlansEmpty={initialPlans.length === 0}
            emptyContent={
              entry === "start" ? (
                startPlansContent
              ) : (
              entry === "active" ? (
                !storeHydrated ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-16 text-center">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.08]" />
                    <p className="text-sm text-white/45">Wczytywanie sesji…</p>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-10 text-center">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
                      <RotateCcw className="mx-auto h-11 w-11 text-[#FF9500]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-semibold text-white">Trening jest wyłączony</p>
                      <p className="mt-2 max-w-md text-[13px] text-white/45">
                        Nie możesz wejść do ekranu treningu bez aktywnej sesji.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={() => router.push("/workout-plan")}>
                        Rozpocznij trening
                      </Button>
                      <Button type="button" variant="outline" onClick={() => router.push("/profile/workout-plan")}>
                        Ustaw plan
                      </Button>
                    </div>
                  </div>
                )
              ) : undefined
              )
            }
          >
            {hasLoadedPlan ? exerciseList : null}
          </ActiveSessionCard>
        </div>
      </div>

      {hasLoadedPlan && saveError ? (
        <p className="fixed bottom-24 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-2 text-center text-sm text-red-100">
          {saveError}
        </p>
      ) : null}

      {finishOpen && hasLoadedPlan ? (
        <WorkoutFinishedScreen
          title={title}
          elapsedSeconds={elapsed}
          setsDone={completedSets.done}
          setsTotal={completedSets.total}
          volumeKg={sessionTotal}
          saving={saving}
          onDone={() => {
            void completeWorkout();
          }}
          onReturn={() => setFinishOpen(false)}
          onClose={() => setFinishOpen(false)}
        />
      ) : null}

      {resumePromptOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Czy chcesz kontynuować trening?</CardTitle>
              <CardDescription>
                Wykryliśmy niedokończoną sesję. Twoje dane nie zostały utracone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-foreground/10 bg-muted/40 p-3 text-xs text-muted-foreground">
                Jeśli wybierzesz „Odrzuć”, usuniemy zapisany stan aktywnego treningu na tym urządzeniu.
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem("active-workout:resumePromptSeen", "1");
                  reset();
                  setExercises([]);
                  setSelectedExerciseId(null);
                  setRestRemaining(null);
                  setResumePromptOpen(false);
                }}
              >
                Odrzuć
              </Button>
              <Button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("active-workout:resumePromptSeen", "1");
                  setResumePromptOpen(false);
                }}
              >
                Kontynuuj
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
