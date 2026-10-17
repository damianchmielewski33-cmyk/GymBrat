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
import {
  backfillSessionExerciseCategories,
  planExercisesToSession,
} from "@/lib/start-workout-session";
import {
  detectSessionNewMaxes,
  detectSessionWeightRecords,
} from "@/lib/session-new-max";
import {
  buildLiveCoachTipAfterCompletedSet,
  liveCoachTipToPlainText,
} from "@/lib/live-set-coach";
import { whenActiveWorkoutCloudHydrated } from "@/lib/active-workout-cloud-ready";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GuidedSessionLayout } from "@/components/active-workout/guided-session-layout";
import { WorkoutFinishedScreen } from "@/components/active-workout/workout-finished-screen";
import { StartWorkoutScreen } from "@/components/active-workout/start-workout-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RestBreakScreen } from "@/components/active-workout/rest-break-screen";
import { WorkoutAllSetsDoneDialog } from "@/components/active-workout/workout-all-sets-done-dialog";
import { WorkoutDiscardSessionDialog } from "@/components/active-workout/workout-discard-session-dialog";
import { readRestTimerPrefs } from "@/lib/rest-timer-prefs";
import { playRestTimerEndSignal, playRestTimerStartSignal, unlockRestTimerAudio } from "@/lib/rest-timer-signal";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { mapUnknownFetchError, UserMessages } from "@/lib/user-facing-errors";
import { submitCompletedWorkout } from "@/lib/workout-complete-submit";
import {
  areAllWorkoutSetsDone,
  canCompleteWorkoutSet,
  findFirstSkippedWorkoutTarget,
  isSkippedWorkoutSet,
  resolveAdvanceAfterSet,
} from "@/lib/workout-skipped-sets";
import { hapticExerciseDone, hapticNewMax, hapticWorkoutDone } from "@/lib/haptics";
import {
  resolveExerciseMuscles,
  type ResolvedExerciseMuscles,
} from "@/lib/resolve-exercise-muscles";
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
  /** Partie mięśniowe tego, co zaraz będzie robione (kolejna seria / kolejne ćwiczenie). */
  nextMuscles: ResolvedExerciseMuscles | null;
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
    setHideGlobalBarForRoute,
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
  /** Pełny czas bieżącego cyklu przerwy — do animacji koła odliczania. */
  const [restDurationTotal, setRestDurationTotal] = useState(90);
  const restStartedAtRef = useRef<number | null>(null);
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
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [sessionExitPending, setSessionExitPending] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);
  /** Bez tego pierwszy render `/active-workout` widzi pusty stan zanim wczyta się localStorage → fałszywy redirect na `/start-workout`. */
  const [storeHydrated, setStoreHydrated] = useState(false);
  /** Czekamy na pull chmury, żeby nie wyrzucić sesji z innego urządzenia. */
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const finishWeightRecords = useMemo(
    () => detectSessionWeightRecords(exercises, lastPlanHints),
    [exercises, lastPlanHints],
  );
  const restCoachTip = useMemo(() => {
    if (!lastCompleted) return null;
    const ex = exercises.find((e) => e.id === lastCompleted.exerciseId);
    if (!ex) return null;
    return liveCoachTipToPlainText(
      buildLiveCoachTipAfterCompletedSet(ex, lastCompleted.setIndex),
    );
  }, [lastCompleted, exercises]);

  /** Manekin na pauzie: snap albo żywe dopasowanie (categoryId / katalog). */
  const restNextMuscles = useMemo((): ResolvedExerciseMuscles | null => {
    if (!lastCompleted || lastCompleted.workoutFinished) return null;
    if (lastCompleted.nextMuscles?.primary) return lastCompleted.nextMuscles;
    if (
      lastCompleted.nextLabel === "Następne ćwiczenie" &&
      lastCompleted.nextValue !== "Koniec treningu"
    ) {
      const nextEx = exercises.find((e) => e.name === lastCompleted.nextValue);
      if (nextEx) {
        return resolveExerciseMuscles({
          name: nextEx.name,
          categoryId: nextEx.categoryId,
        });
      }
      return resolveExerciseMuscles({ name: lastCompleted.nextValue });
    }
    const ex = exercises.find((e) => e.id === lastCompleted.exerciseId);
    if (ex) {
      return resolveExerciseMuscles({
        name: ex.name,
        categoryId: ex.categoryId,
      });
    }
    return resolveExerciseMuscles({ name: lastCompleted.exerciseName });
  }, [lastCompleted, exercises]);

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

  /** Sesja pełnoekranowa: bez scrolla dokumentu (tylko wewnętrzna lista ćwiczenia). */
  useEffect(() => {
    if (!hasLoadedPlan || display === "modal") return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [hasLoadedPlan, display]);

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
      setExercises(
        backfillSessionExerciseCategories(
          mergeHintsIntoExercises(ex, lastPlanHints),
        ),
      );
    } else {
      const filled = backfillSessionExerciseCategories(ex);
      if (filled !== ex) setExercises(filled);
    }
    hintsMergedRef.current = true;
  }, [lastPlanHints, hintsFetchDone, workoutPlanId, setExercises]);

  /** Sesje wznowione sprzed poprawki — bez categoryId manekin na pauzie był pusty. */
  useEffect(() => {
    if (!storeHydrated || !cloudHydrated || !hasLoadedPlan) return;
    const ex = useActiveWorkoutStore.getState().exercises;
    const filled = backfillSessionExerciseCategories(ex);
    if (filled !== ex) setExercises(filled);
  }, [
    storeHydrated,
    cloudHydrated,
    hasLoadedPlan,
    workoutPlanId,
    setExercises,
  ]);

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
    const sec = Math.max(1, Math.round(seconds));
    setRestDurationTotal(sec);
    setRestRemaining(sec);
    restStartedAtRef.current = Date.now();
  }

  /** Zapisuje faktyczną przerwę na następną serię (rest-aware coach). */
  function persistRestSecondsFromTimer() {
    const started = restStartedAtRef.current;
    restStartedAtRef.current = null;
    const snap = lastCompletedRef.current;
    if (started == null || !snap) return;
    const restSec = Math.max(
      0,
      Math.min(3600, Math.round((Date.now() - started) / 1000)),
    );
    const prev = useActiveWorkoutStore.getState().exercises;
    const exIdx = prev.findIndex((e) => e.id === snap.exerciseId);
    if (exIdx < 0) return;
    const ex = prev[exIdx]!;
    let targetExIdx = exIdx;
    let targetSetIdx = snap.setIndex + 1;
    if (targetSetIdx >= ex.sets.length) {
      targetExIdx = exIdx + 1;
      targetSetIdx = 0;
    }
    if (targetExIdx >= prev.length) return;
    setExercises(
      prev.map((e, i) => {
        if (i !== targetExIdx) return e;
        const sets = e.sets.map((s, si) =>
          si === targetSetIdx ? { ...s, restSeconds: restSec } : s,
        );
        return { ...e, sets };
      }),
    );
  }

  function stopRest() {
    if (restRemaining != null) {
      persistRestSecondsFromTimer();
    }
    setRestRemaining(null);
  }

  function buildCompletedSnap(
    list: WorkoutExerciseState[],
    exerciseId: string,
    setIndex: number,
    weight: number,
    reps: number,
  ): LastCompletedSnap | null {
    const ex = list.find((e) => e.id === exerciseId);
    if (!ex) return null;

    const advance = resolveAdvanceAfterSet(list, exerciseId, setIndex);
    let nextLabel = "Następna seria";
    let nextValue = `Seria ${setIndex + 2} z ${ex.sets.length}`;
    let exerciseFinished = false;
    let workoutFinished = false;
    /** Manekin: partia tego, co zaraz będzie robione. */
    let nextMuscles: ResolvedExerciseMuscles | null = resolveExerciseMuscles({
      name: ex.name,
      categoryId: ex.categoryId,
    });

    if (!advance) {
      // Brak otwartej serii / ćwiczenia — pauza z „Koniec treningu”.
      exerciseFinished = true;
      workoutFinished = true;
      nextLabel = "Następne ćwiczenie";
      nextValue = "Koniec treningu";
      nextMuscles = null;
    } else if (advance.exerciseId === exerciseId) {
      nextLabel = "Następna seria";
      nextValue = `Seria ${advance.setIndex + 1} z ${ex.sets.length}`;
    } else {
      exerciseFinished = true;
      const nextEx = list.find((e) => e.id === advance.exerciseId);
      nextLabel = "Następne ćwiczenie";
      nextValue = nextEx?.name ?? "—";
      nextMuscles = nextEx
        ? resolveExerciseMuscles({
            name: nextEx.name,
            categoryId: nextEx.categoryId,
          })
        : null;
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
      nextMuscles,
    };
  }

  /** Dalej / koniec odliczania → podsumowanie, gdy snap albo stan sesji mówi „wszystko zaliczone”. */
  function shouldOpenFinishAfterRest(): boolean {
    if (lastCompletedRef.current?.workoutFinished) return true;
    return areAllWorkoutSetsDone(useActiveWorkoutStore.getState().exercises);
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

  function requestDiscardSession() {
    setDiscardConfirmOpen(true);
  }

  function confirmDiscardSession() {
    setSessionExitPending(true);
    setSuppressRouteGate(true);
    const groupSessionId =
      useCommunityWorkoutStore.getState().groupSessionId;
    if (groupSessionId) {
      void (async () => {
        try {
          await ensureCsrfCookie();
          await fetch(
            `/api/community/group-workout/${groupSessionId}/presence`,
            {
              method: "DELETE",
              credentials: "same-origin",
              headers: getXsrfHeaders(),
            },
          );
        } catch {
          /* ignore */
        }
      })();
    }
    useCommunityWorkoutStore.getState().clear();
    reset();
    setExercises([]);
    setSelectedExerciseId(null);
    stopRest();
    setAllSetsDoneOpen(false);
    setFinishOpen(false);
    setDiscardConfirmOpen(false);
    requestActiveWorkoutCloudPush(true);
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
  const lastCompletedRef = useRef(lastCompleted);
  lastCompletedRef.current = lastCompleted;

  useEffect(() => {
    useCommunityWorkoutStore.getState().setRestRemaining(restRemaining);
  }, [restRemaining]);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      persistRestSecondsFromTimer();
      setRestRemaining(null);
      return;
    }
    const id = window.setTimeout(() => {
      if (restRemaining === 1) {
        if (restSoundOnRef.current) {
          playRestTimerEndSignal();
        }
        const finished = shouldOpenFinishAfterRest();
        persistRestSecondsFromTimer();
        setRestRemaining(null);
        if (finished) {
          setFinishOpen(true);
        }
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
      const { done, total } = countSetsDone(exercisesNow);
      const workoutComplete = total > 0 && done >= total;

      if (workoutComplete) {
        // Zawsze pauza z „Koniec treningu” (także przy pominięciach / masie ciała) —
        // dialog pominięć i „Trening zrobiony” dopiero po Dalej / końcu odliczania.
        hapticWorkoutDone();
        const endSnap = snap
          ? {
              ...snap,
              exerciseFinished: true,
              workoutFinished: true,
              nextLabel: "Następne ćwiczenie",
              nextValue: "Koniec treningu",
              nextMuscles: null,
            }
          : null;
        if (endSnap) setLastCompleted(endSnap);
        setAllSetsDoneOpen(false);
        setAllSetsDoneSkipped({ target: null, count: 0 });
        const { defaultSeconds } = readRestTimerPrefs();
        startRest(defaultSeconds);
        return;
      }

      // Pominięcie w trakcie sesji: bez przerwy — od razu następna seria / ćwiczenie.
      if (isSkippedNext) {
        stopRest();
        return;
      }

      if (snap) setLastCompleted(snap);

      if (snap?.exerciseFinished) {
        hapticExerciseDone();
      }

      const { autoStart, defaultSeconds } = readRestTimerPrefs();
      if (autoStart) {
        startRest(defaultSeconds);
      }
    }
  }

  /** Dalej / koniec odliczania → podsumowanie, gdy sesja jest domknięta. */
  function continueAfterRest() {
    const finished = shouldOpenFinishAfterRest();
    stopRest();
    if (finished) {
      setFinishOpen(true);
    }
  }

  function beginWorkoutFromPlan(row: WorkoutPlanWithLastWorkoutDTO) {
    if (row.plan.exercises.length === 0) return;
    setHideGlobalBarForRoute(true);
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
      setSessionExitPending(true);
      const groupSessionId =
        useCommunityWorkoutStore.getState().groupSessionId;
      if (groupSessionId) {
        try {
          await ensureCsrfCookie();
          await fetch(
            `/api/community/group-workout/${groupSessionId}/presence`,
            {
              method: "DELETE",
              credentials: "same-origin",
              headers: getXsrfHeaders(),
            },
          );
        } catch {
          /* ignore */
        }
      }
      useCommunityWorkoutStore.getState().clear();
      reset();
      setExercises([]);
      setSelectedExerciseId(null);
      stopRest();
      setFinishOpen(false);
      requestActiveWorkoutCloudPush(true);
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
        router.refresh();
      } else {
        hapticWorkoutDone();
        sessionStorage.removeItem("gymbrat:newMaxToast");
        router.push("/workout-plan");
        router.refresh();
      }
      if (result.status === "queued") {
        sessionStorage.setItem("gymbrat:workoutQueued", "1");
      } else {
        sessionStorage.removeItem("gymbrat:workoutQueued");
      }
    } catch (e) {
      setSaveError(mapUnknownFetchError(e, UserMessages.workoutSaveUnknown));
      setSessionExitPending(false);
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
      onCancelSession={requestDiscardSession}
      onDiscardSession={requestDiscardSession}
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
            ? "relative flex h-full min-h-0 flex-col bg-black"
            : "relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-black"
          : "relative min-h-[calc(100dvh-6rem)] rounded-2xl bg-[#0f0f0f] p-4 sm:p-6 lg:min-h-[calc(100dvh-5rem)]"
      }
    >
      {hasLoadedPlan && restRemaining != null && restRemaining > 0 ? (
        <RestBreakScreen
          open
          remaining={restRemaining}
          durationTotal={restDurationTotal}
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
          nextMuscles={restNextMuscles}
          coachTip={restCoachTip}
          soundOn={restSoundOn}
          onToggleSound={() => {
            void unlockRestTimerAudio();
            setRestSoundOn((v) => {
              const next = !v;
              if (next) playRestTimerStartSignal();
              return next;
            });
          }}
          onAddSeconds={(sec) => {
            const add = Math.max(1, Math.round(sec));
            setRestDurationTotal((t) => t + add);
            setRestRemaining((r) => (r == null ? add : r + add));
          }}
          onSetSeconds={(sec) => {
            const next = Math.max(1, Math.round(sec));
            setRestDurationTotal(next);
            setRestRemaining(next);
          }}
          onContinue={continueAfterRest}
          onCloseSession={requestDiscardSession}
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

      <WorkoutDiscardSessionDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        onConfirm={confirmDiscardSession}
      />

      <div
        className={
          hasLoadedPlan
            ? "mx-auto flex h-full min-h-0 w-full max-w-[min(100%,720px)] flex-1 flex-col px-0"
            : "mx-auto max-w-[1400px]"
        }
      >
        <div
          className={
            hasLoadedPlan ? "flex h-full min-h-0 flex-1 flex-col gap-0" : ""
          }
        >
          <ActiveSessionCard
            hasLoadedPlan={hasLoadedPlan}
            initialPlansEmpty={initialPlans.length === 0}
            emptyContent={
              entry === "start" ? (
                startPlansContent
              ) : (
              entry === "active" ? (
                !storeHydrated || !cloudHydrated || sessionExitPending ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-16 text-center">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.08]" />
                    <p className="text-sm text-white/45">
                      {sessionExitPending && saving
                        ? "Zapisuję trening…"
                        : t("session.loading")}
                    </p>
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
          weightRecords={finishWeightRecords}
          cardioMinutes={cardioMinutes}
          cardioExtras={cardioExtras}
          onCardioMinutesChange={setCardioMinutes}
          onCardioExtrasChange={setCardioExtras}
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
                  requestActiveWorkoutCloudPush(true);
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
