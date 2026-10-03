"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  fetchLastWorkoutHintsForPlan,
  type WorkoutPlanWithLastWorkoutDTO,
} from "@/actions/workout-plan";
import { getExerciseTechniqueUrlMap } from "@/actions/exercise-technique";
import { attachTechniqueUrls } from "@/lib/attach-technique-urls";
import { mergeHintsIntoExercises } from "@/lib/last-workout-hints";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { planExercisesToSession } from "@/lib/start-workout-session";
import { detectSessionNewMaxes } from "@/lib/session-new-max";
import { whenActiveWorkoutCloudHydrated } from "@/lib/active-workout-cloud-ready";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GuidedSessionLayout } from "@/components/active-workout/guided-session-layout";
import { WorkoutFinishedScreen } from "@/components/active-workout/workout-finished-screen";
import { StartWorkoutScreen } from "@/components/active-workout/start-workout-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RestBreakScreen } from "@/components/active-workout/rest-break-screen";
import { WorkoutAllSetsDoneDialog } from "@/components/active-workout/workout-all-sets-done-dialog";
import { readRestTimerPrefs } from "@/lib/rest-timer-prefs";
import { playRestTimerEndSignal, playRestTimerStartSignal, unlockRestTimerAudio } from "@/lib/rest-timer-signal";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { mapUnknownFetchError, UserMessages } from "@/lib/user-facing-errors";
import { submitCompletedWorkout } from "@/lib/workout-complete-submit";
import {
  canCompleteWorkoutSet,
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
  findNextIncompleteExercise,
  isSkippedWorkoutSet,
} from "@/lib/workout-skipped-sets";
import { hapticExerciseDone, hapticNewMax, hapticWorkoutDone } from "@/lib/haptics";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";

type LastCompletedSnap = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  setCount: number;
  weight: number;
  reps: number;
  nextLabel: string;
  nextValue: string;
  /** Ostatnia seria tego ćwiczenia (można dodać kolejną). */
  exerciseFinished: boolean;
  /** Ostatnia seria całego treningu. */
  workoutFinished: boolean;
};

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
    cardioExtras,
    exercises,
    selectedExerciseId,
    applyPlan,
    start,
    reset,
    setCardioMinutes,
    setCardioExtras,
    setExercises,
    setSelectedExerciseId,
    patchSet: patchSetInStore,
    patchExercise,
    addSet: addSetInStore,
    removeLastSet: removeLastSetInStore,
  } = useActiveWorkoutStore();
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const [lastPlanHints, setLastPlanHints] = useState<LastPlanHintsMap>({});
  const [hintsFetchDone, setHintsFetchDone] = useState(false);
  const hintsMergedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restSoundOn, setRestSoundOn] = useState(true);
  const [lastCompleted, setLastCompleted] = useState<LastCompletedSnap | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [allSetsDoneOpen, setAllSetsDoneOpen] = useState(false);
  const [allSetsDoneSkipped, setAllSetsDoneSkipped] = useState<{
    target: ReturnType<typeof findFirstSkippedWorkoutTarget>;
    count: number;
  }>({ target: null, count: 0 });
  const [focusSetRequest, setFocusSetRequest] = useState<{
    exerciseId: string;
    setIndex: number;
    nonce: number;
  } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);
  /** Bez tego pierwszy render `/active-workout` widzi pusty stan zanim wczyta się localStorage → fałszywy redirect na `/start-workout`. */
  const [storeHydrated, setStoreHydrated] = useState(false);
  /** Czekamy na pull chmury, żeby nie wyrzucić sesji z innego urządzenia. */
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const finishNewMaxes = useMemo(
    () => detectSessionNewMaxes(exercises, lastPlanHints),
    [exercises, lastPlanHints],
  );

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
    let cancelled = false;
    void whenActiveWorkoutCloudHydrated().then(() => {
      if (!cancelled) setCloudHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hintsMergedRef.current = false;
    setHintsFetchDone(false);
    setLastPlanHints({});
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId) {
      setLastPlanHints({});
      setHintsFetchDone(true);
      return;
    }
    let cancelled = false;
    setHintsFetchDone(false);
    void fetchLastWorkoutHintsForPlan(workoutPlanId).then((h) => {
      if (cancelled) return;
      setLastPlanHints(h);
      setHintsFetchDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId || !hintsFetchDone || hintsMergedRef.current) return;
    const ex = useActiveWorkoutStore.getState().exercises;
    if (!ex.length) return;
    if (Object.keys(lastPlanHints).length) {
      setExercises(mergeHintsIntoExercises(ex, lastPlanHints));
    }
    hintsMergedRef.current = true;
  }, [lastPlanHints, hintsFetchDone, workoutPlanId, setExercises]);

  const techniqueMapRef = useRef<Record<string, string>>({});
  const techniqueAppliedKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    void getExerciseTechniqueUrlMap().then((map) => {
      if (cancelled) return;
      techniqueMapRef.current = map;
      const current = useActiveWorkoutStore.getState().exercises;
      if (!current.length || !Object.keys(map).length) return;
      const key = current.map((e) => `${e.id}:${e.name}`).join("|");
      const next = attachTechniqueUrls(current, map);
      techniqueAppliedKeyRef.current = key;
      const changed = next.some(
        (ex, i) => ex.techniqueYoutubeUrl !== current[i]?.techniqueYoutubeUrl,
      );
      if (changed) setExercises(next);
    });
    return () => {
      cancelled = true;
    };
  }, [setExercises]);

  useEffect(() => {
    const map = techniqueMapRef.current;
    const key = exercises.map((e) => `${e.id}:${e.name}`).join("|");
    if (!key || !Object.keys(map).length) return;
    if (techniqueAppliedKeyRef.current === key) return;
    const next = attachTechniqueUrls(exercises, map);
    techniqueAppliedKeyRef.current = key;
    const changed = next.some(
      (ex, i) => ex.techniqueYoutubeUrl !== exercises[i]?.techniqueYoutubeUrl,
    );
    if (changed) setExercises(next);
  }, [exercises, setExercises]);

  // Route gating:
  // - `/active-workout` is a strict "session view" and must NOT be accessible without an active session.
  // - `/start-workout` is the entry point that lets user pick a plan and begin a session.
  useEffect(() => {
    if (display !== "page") return;
    if (suppressRouteGate || !storeHydrated || !cloudHydrated) return;
    if (entry === "active" && !hasLoadedPlan) {
      router.replace("/workout-plan");
      return;
    }
    if (entry === "start" && hasLoadedPlan) {
      router.replace("/active-workout");
    }
  }, [
    display,
    entry,
    hasLoadedPlan,
    router,
    suppressRouteGate,
    storeHydrated,
    cloudHydrated,
  ]);

  function startRest(seconds: number) {
    void unlockRestTimerAudio();
    if (restSoundOn) {
      playRestTimerStartSignal();
    }
    setRestRemaining(seconds);
  }

  function stopRest() {
    setRestRemaining(null);
  }

  function buildCompletedSnap(
    list: WorkoutExerciseState[],
    exerciseId: string,
    setIndex: number,
    weight: number,
    reps: number,
  ): LastCompletedSnap | null {
    const idx = list.findIndex((e) => e.id === exerciseId);
    const ex = list[idx];
    if (!ex) return null;
    const nextSetIdx = setIndex + 1;
    let nextLabel = "Następna seria";
    let nextValue = `Seria ${nextSetIdx + 1} z ${ex.sets.length}`;
    let exerciseFinished = false;
    let workoutFinished = false;
    if (nextSetIdx >= ex.sets.length) {
      exerciseFinished = true;
      const nextEx = findNextIncompleteExercise(list, exerciseId);
      if (nextEx) {
        nextLabel = "Następne ćwiczenie";
        nextValue = nextEx.name;
      } else {
        nextLabel = "Koniec";
        nextValue = "Ostatnia seria zaliczona";
        workoutFinished = true;
      }
    }
    return {
      exerciseId,
      exerciseName: ex.name,
      setIndex,
      setCount: ex.sets.length,
      weight,
      reps,
      nextLabel,
      nextValue,
      exerciseFinished,
      workoutFinished,
    };
  }

  function countSetsDone(list: WorkoutExerciseState[]) {
    let done = 0;
    let total = 0;
    for (const ex of list) {
      for (const s of ex.sets) {
        total += 1;
        if (s.done) done += 1;
      }
    }
    return { done, total };
  }

  function addSetToExercise(exerciseId: string): number | null {
    const newIndex = addSetInStore(exerciseId);
    if (newIndex == null) return null;
    const setCount = newIndex + 1;
    setLastCompleted((prev) =>
      prev && prev.exerciseId === exerciseId
        ? {
            ...prev,
            setCount,
            exerciseFinished: false,
            workoutFinished: false,
            nextLabel: "Następna seria",
            nextValue: `Seria ${setCount} z ${setCount}`,
          }
        : prev,
    );
    setAllSetsDoneOpen(false);
    return newIndex;
  }

  function discardSession() {
    if (
      !window.confirm(
        "Zakończyć bez zapisu? Postęp z tej sesji nie zostanie zapisany.",
      )
    ) {
      return;
    }
    reset();
    setExercises([]);
    setSelectedExerciseId(null);
    stopRest();
    setAllSetsDoneOpen(false);
    setFinishOpen(false);
    router.push("/workout-plan");
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

  const restSoundOnRef = useRef(restSoundOn);
  restSoundOnRef.current = restSoundOn;

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      setRestRemaining(null);
      return;
    }
    const id = window.setTimeout(() => {
      if (restRemaining === 1) {
        if (restSoundOnRef.current) {
          playRestTimerEndSignal();
        }
        setRestRemaining(null);
        return;
      }
      setRestRemaining(restRemaining - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [restRemaining]);

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

  const skippedTarget = allSetsDoneSkipped.target;
  const skippedCount = allSetsDoneSkipped.count;

  function goToSkippedTarget() {
    const exercisesNow = useActiveWorkoutStore.getState().exercises;
    const target = findFirstSkippedWorkoutTarget(exercisesNow);
    if (!target) return;
    stopRest();
    const set = exercisesNow
      .find((e) => e.id === target.exerciseId)
      ?.sets[target.setIndex];
    if (set && isSkippedWorkoutSet(set)) {
      patchSetInStore(target.exerciseId, target.setIndex, {
        done: false,
        skipped: false,
      });
    }
    setSelectedExerciseId(target.exerciseId);
    setFocusSetRequest({
      exerciseId: target.exerciseId,
      setIndex: target.setIndex,
      nonce: Date.now(),
    });
  }

  function patchSet(
    exerciseId: string,
    setIndex: number,
    patch: Partial<{
      reps: number | null;
      weight: number;
      done: boolean;
      skipped: boolean;
      rpe: number | null;
      rir: number | null;
    }>,
  ) {
    // Zawsze świeży stan ze store — po „+ Seria” snapshot z rendera bywa nieaktualny
    // i wtedy wasDone/done>=total błędnie blokują ekran przerwy.
    const exercisesBefore = useActiveWorkoutStore.getState().exercises;
    const current = exercisesBefore
      .find((e) => e.id === exerciseId)
      ?.sets[setIndex];
    const wasDone = current?.done ?? false;

    let nextPatch = { ...patch };
    if (nextPatch.done === true && nextPatch.skipped !== true) {
      const nextWeight =
        nextPatch.weight !== undefined ? nextPatch.weight : current?.weight ?? 0;
      const nextReps =
        nextPatch.reps !== undefined ? nextPatch.reps : current?.reps ?? null;
      if (!canCompleteWorkoutSet(nextWeight, nextReps)) {
        nextPatch = { ...nextPatch, skipped: true };
      }
    }

    patchSetInStore(exerciseId, setIndex, nextPatch);
    requestActiveWorkoutCloudPush(Boolean(nextPatch.done === true));

    // Start odpoczynku tylko przy przejściu false -> true (prawdziwe zaliczenie, nie pominięcie).
    const nextReps = nextPatch.reps !== undefined ? nextPatch.reps : current?.reps ?? null;
    const nextWeight = nextPatch.weight !== undefined ? nextPatch.weight : current?.weight ?? 0;
    const isDoneNext =
      nextPatch.done !== undefined
        ? nextPatch.done
        : canCompleteWorkoutSet(nextWeight, nextReps);
    const isSkippedNext = Boolean(
      nextPatch.skipped === true ||
        (isDoneNext && !canCompleteWorkoutSet(nextWeight, nextReps)),
    );
    if (isDoneNext && !wasDone) {
      const exercisesNow = useActiveWorkoutStore.getState().exercises;
      const snap = buildCompletedSnap(
        exercisesNow,
        exerciseId,
        setIndex,
        Number(nextWeight) || 0,
        Number(nextReps) || 0,
      );
      if (snap && !isSkippedNext) setLastCompleted(snap);

      const { done, total } = countSetsDone(exercisesNow);
      if (total > 0 && done >= total) {
        stopRest();
        hapticWorkoutDone();
        const skipped = findFirstSkippedWorkoutTarget(exercisesNow);
        const skipCount = countSkippedWorkoutSets(exercisesNow);
        if (skipped) {
          setAllSetsDoneSkipped({ target: skipped, count: skipCount });
          setAllSetsDoneOpen(true);
        } else {
          setAllSetsDoneSkipped({ target: null, count: 0 });
          setFinishOpen(true);
        }
        return;
      }

      // Pominięcie: bez przerwy — od razu widać następną serię / ćwiczenie.
      if (isSkippedNext) {
        stopRest();
        return;
      }

      if (snap?.exerciseFinished) {
        hapticExerciseDone();
      }

      const { autoStart, defaultSeconds } = readRestTimerPrefs();
      if (autoStart) {
        startRest(defaultSeconds);
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

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
      // Prevent the `/active-workout` gate from overriding the redirect
      // after we reset the active session state.
      setSuppressRouteGate(true);

      const endedAt = Date.now();
      const sessionExercises = exercises;
      const storeNow = useActiveWorkoutStore.getState();
      const cardioMinutesNow = storeNow.cardioMinutes;
      const cardioExtrasNow = storeNow.cardioExtras;
      const newMaxHits = detectSessionNewMaxes(sessionExercises, lastPlanHints);
      const baseSummary = {
        title: title.trim() || "Trening",
        endedAt,
        durationSeconds: elapsed,
        cardioMinutes: cardioMinutesNow,
        exercisesCount: sessionExercises.length,
        setsDone: completedSets.done,
        setsTotal: completedSets.total,
        totalVolume: sessionTotal,
      };
      const result = await submitCompletedWorkout({
        title,
        startedAt: workoutStartedAtMs ?? startedAt ?? Date.now(),
        endedAt,
        cardioMinutes: cardioMinutesNow,
        cardio:
          cardioMinutesNow > 0
            ? {
                distanceKm: cardioExtrasNow.distanceKm,
                avgHr: cardioExtrasNow.avgHr,
                calories: cardioExtrasNow.calories,
                steps: cardioExtrasNow.steps,
                paceMinPerKm: cardioExtrasNow.paceMinPerKm ?? null,
              }
            : null,
        exercises: sessionExercises,
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
        planCompare: result.status === "saved" ? result.planCompare : null,
        newMaxHits,
      };
      sessionStorage.setItem("workout:completedSummary", JSON.stringify(completedSummary));
      if (newMaxHits.length > 0) {
        hapticNewMax();
        const primary = newMaxHits[0]!;
        sessionStorage.setItem(
          "gymbrat:newMaxToast",
          `NOWY MAX: ${newMaxHits
            .slice(0, 2)
            .map((h) => `${h.exerciseName} (${h.value} kg)`)
            .join(", ")}`,
        );
        router.push(
          `/progress/exercises/${encodeURIComponent(primary.exerciseName)}`,
        );
      } else {
        hapticWorkoutDone();
        sessionStorage.removeItem("gymbrat:newMaxToast");
        router.push("/workout-plan");
      }
      if (result.status === "queued") {
        sessionStorage.setItem("gymbrat:workoutQueued", "1");
      } else {
        sessionStorage.removeItem("gymbrat:workoutQueued");
      }
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
      onAddSet={(exerciseId) => {
        return addSetToExercise(exerciseId);
      }}
      onRemoveLastSet={(exerciseId) => {
        return removeLastSetInStore(exerciseId);
      }}
      onExerciseNoteChange={(exerciseId, note) =>
        patchExercise(exerciseId, { note })
      }
      onCancelSession={discardSession}
      onDiscardSession={discardSession}
      onFinishSession={() => {
        setFinishOpen(true);
      }}
      finishPending={saving}
      onDeferExercise={() => {
        /* lista / kolejność — „Wrócę później” przechodzi do następnego w GuidedSessionLayout */
      }}
      focusSetRequest={focusSetRequest}
      onFocusSetHandled={() => setFocusSetRequest(null)}
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
          onToggleSound={() => {
            void unlockRestTimerAudio();
            setRestSoundOn((v) => {
              const next = !v;
              if (next) playRestTimerStartSignal();
              return next;
            });
          }}
          onAddSeconds={(sec) =>
            setRestRemaining((r) => (r == null ? sec : r + sec))
          }
          onSetSeconds={(sec) => setRestRemaining(sec)}
          onContinue={() => stopRest()}
          onCloseSession={discardSession}
          onOpenList={() => {
            stopRest();
            setListOpen(true);
          }}
        />
      ) : null}

      {skippedTarget ? (
        <WorkoutAllSetsDoneDialog
          open={allSetsDoneOpen}
          onOpenChange={(open) => {
            setAllSetsDoneOpen(open);
            if (!open) {
              setAllSetsDoneSkipped({ target: null, count: 0 });
            }
          }}
          onFinish={() => setFinishOpen(true)}
          skippedTarget={skippedTarget}
          skippedCount={skippedCount}
          onGoToSkipped={goToSkippedTarget}
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
                !storeHydrated || !cloudHydrated ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-16 text-center">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.08]" />
                    <p className="text-sm text-white/45">{t("session.loading")}</p>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-10 text-center">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
                      <RotateCcw className="mx-auto h-11 w-11 text-[#FF9500]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-semibold text-white">
                        {t("session.disabledTitle")}
                      </p>
                      <p className="mt-2 max-w-md text-[13px] text-white/45">
                        {t("session.disabledBody")}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" onClick={() => router.push("/workout-plan")}>
                        {t("session.startWorkout")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => router.push("/profile/workout-plan")}>
                        {t("session.setPlan")}
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
          exercises={exercises}
          cardioMinutes={cardioMinutes}
          cardioExtras={cardioExtras}
          onCardioMinutesChange={setCardioMinutes}
          onCardioExtrasChange={setCardioExtras}
          saving={saving}
          newMaxLabel={
            finishNewMaxes[0]
              ? `${finishNewMaxes[0].exerciseName} ${finishNewMaxes[0].value} kg`
              : null
          }
          newMaxHit={finishNewMaxes[0] ?? null}
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
              <CardTitle>{t("session.resumeTitle")}</CardTitle>
              <CardDescription>{t("session.resumeBody")}</CardDescription>
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
