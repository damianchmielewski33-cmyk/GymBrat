"use client";

/**
 * Wspólna logika zakończenia treningu (ADR 0004 p.4), używana przez trzy wejścia:
 * ekran główny (ostatnia seria / dolne „Zakończ”), pasek globalny, menu sesji.
 * Stan żyje w store (`finishFlow`) — nie w `useState` lokalnym — żeby komponenty
 * montowane niezależnie (ekran vs pasek globalny) widziały ten sam stan.
 */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchLastWorkoutHintsForPlan } from "@/actions/workout-plan";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { hapticNewMax, hapticWorkoutDone } from "@/lib/haptics";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import { detectSessionNewMaxes, detectSessionWeightRecords } from "@/lib/session-new-max";
import { useActiveWorkoutStore, type WorkoutFinishFlowState } from "@/lib/stores/active-workout";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import { UserMessages } from "@/lib/user-facing-errors";
import { countSetsDone } from "@/lib/workout-session-progress";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { submitCompletedWorkout } from "@/lib/workout-complete-submit";
import { deriveWorkoutOperationId } from "@/lib/workout-operation-id";
import {
  countIncompleteWorkoutSets,
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
  isSkippedWorkoutSet,
} from "@/lib/workout-skipped-sets";
import type { WorkoutFinishedScreenData } from "@/components/active-workout/workout-finish-types";

/**
 * Zapis jest jedną operacją logiczną, wspólną dla wszystkich wejść — stan pomocniczy
 * (endedAt ustalony przy pierwszej próbie, podpowiedzi z ostatniej sesji planu) żyje
 * na poziomie modułu, nie w store: to nie dane sesji, tylko pamięć bieżącej próby
 * zapisu, potrzebna wyłącznie do `retry()` (ten sam `endedAt`, bez przeliczania — ADR p.3).
 */
let lastAttempt: { endedAt: number; hints: LastPlanHintsMap } | null = null;

async function doSave(reuse: boolean) {
  const store = useActiveWorkoutStore.getState();
  if (store.finishPending) return;
  store.beginFinish();
  store.setFinishFlow({ phase: "saving" });

  const endedAt = reuse && lastAttempt ? lastAttempt.endedAt : Date.now();
  const exercises = store.exercises;
  const cardioMinutesNow = store.cardioMinutes;
  const cardioExtrasNow = store.cardioExtras;
  // Klucz idempotencji wyliczony deterministycznie (ADR 0004 p.13, pivot) — nie czytany
  // ze store'a, nie synchronizowany przez chmurę; ten sam łańcuch fallback co `startedAt`
  // wysyłane w żądaniu poniżej, żeby obie wartości zawsze odpowiadały tej samej chwili.
  const operationId = await deriveWorkoutOperationId(
    store.workoutPlanId,
    store.workoutStartedAtMs ?? store.startedAt ?? endedAt,
  );
  const { done: setsDone, total: setsTotal } = countSetsDone(exercises);
  const volumeKg = sessionVolume(exercises);
  const elapsedSeconds =
    (store.startedAt != null
      ? Math.max(0, Math.floor((endedAt - store.startedAt) / 1000))
      : 0) + store.pausedElapsedSeconds;

  let hints: LastPlanHintsMap;
  if (reuse && lastAttempt) {
    hints = lastAttempt.hints;
  } else {
    try {
      hints = store.workoutPlanId ? await fetchLastWorkoutHintsForPlan(store.workoutPlanId) : {};
    } catch {
      hints = {};
    }
  }
  lastAttempt = { endedAt, hints };

  const weightRecords = detectSessionWeightRecords(exercises, hints);
  const newMaxHits = detectSessionNewMaxes(exercises, hints);

  const result = await submitCompletedWorkout({
    operationId,
    title: store.title,
    startedAt: store.workoutStartedAtMs ?? store.startedAt ?? endedAt,
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
    exercises,
    workoutPlanId: store.workoutPlanId,
  });

  if (result.status === "error" || result.status === "conflict") {
    store.endFinish();
    store.setFinishFlow({ phase: "error", message: result.message });
    return;
  }

  // Diagnostyka (005, B-1): `duplicate: true` na pierwszej próbie (nie `retry()`,
  // `reuse === false`) wskazywałby na rozjazd `operationId` między urządzeniami —
  // po poprawce propagacji klucza przez chmurę nie powinno się zdarzać w normalnym
  // użyciu. Nie blokujemy UI (wynik serwera jest poprawny — zapis już istnieje),
  // tylko odnotowujemy do diagnozy, bez danych treningu.
  if (result.status === "saved" && result.duplicate && !reuse) {
    console.warn("[workout-finish] nieoczekiwany duplicate=true na pierwszej próbie zapisu");
  }

  const groupSessionId = useCommunityWorkoutStore.getState().groupSessionId;
  if (groupSessionId) {
    try {
      await ensureCsrfCookie();
      await fetch(`/api/community/group-workout/${groupSessionId}/presence`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: getXsrfHeaders(),
      });
    } catch {
      /* ignore */
    }
  }
  useCommunityWorkoutStore.getState().clear();

  const title = store.title.trim() || "Trening";
  const data: WorkoutFinishedScreenData = {
    title,
    planLabel: title.toUpperCase(),
    endedAtMs: endedAt,
    durationSeconds: elapsedSeconds,
    setsDone,
    setsTotal,
    volumeKg,
    exercises,
    weightRecords,
    newMaxHits,
    cardioMinutes: cardioMinutesNow,
    cardioExtras: cardioExtrasNow,
    saveStatus: result.status === "queued" ? "queued" : "saved",
    workoutId: result.status === "saved" ? result.workoutId : null,
    planCompare: result.status === "saved" ? result.planCompare : null,
  };

  lastAttempt = null;
  store.reset();
  store.endFinish();
  requestActiveWorkoutCloudPush(true);
  store.setFinishFlow({ phase: "done", result: data });

  // `QueuedWorkoutBanner` na /reports (ADR 0004 p.7) — pokrywa przypadek zamknięcia
  // aplikacji na ekranie „Trening zakończony” w stanie kolejki, poza tym przepływem.
  if (typeof sessionStorage !== "undefined") {
    if (result.status === "queued") {
      sessionStorage.setItem("gymbrat:workoutQueued", "1");
    } else {
      sessionStorage.removeItem("gymbrat:workoutQueued");
    }
  }

  if (newMaxHits.length > 0) {
    hapticNewMax();
  } else {
    hapticWorkoutDone();
  }
}

export function useWorkoutFinishFlow(): {
  state: WorkoutFinishFlowState;
  requestFinish: () => void;
  requestFinishFromSecondaryEntry: (openConfirmDialog: () => void) => void;
  confirmFinishFromDialog: () => void;
  goToSkippedTarget: () => void;
  retry: () => void;
  returnToWorkout: () => void;
  close: () => void;
} {
  const router = useRouter();
  const state = useActiveWorkoutStore((s) => s.finishFlow);

  const requestFinish = useCallback(() => {
    const store = useActiveWorkoutStore.getState();
    if (store.finishPending) return;
    const exercises = store.exercises;
    const skippedCount = countSkippedWorkoutSets(exercises);
    const incompleteCount = countIncompleteWorkoutSets(exercises);
    if (skippedCount + incompleteCount > 0) {
      const target = findFirstSkippedWorkoutTarget(exercises);
      if (target) {
        store.setFinishFlow({
          phase: "skipped-dialog",
          skippedCount,
          incompleteCount,
          target,
        });
        return;
      }
    }
    void doSave(false);
  }, []);

  /**
   * Wejścia bez dostępu do serii (pasek globalny, menu sesji) — 005, defekt B-3.
   * Jedno potwierdzenie na wejście (ux sekcja 1, D-3): gdy są pominięte/niewykonane
   * serie, przechodzi wprost do `requestFinish()` (otworzy dialog pominiętych),
   * bez dodatkowego „Zakończyć trening?” przed nim. Dialog proste potwierdzenie
   * pokazuje tylko, gdy nie ma czego pominąć.
   */
  const requestFinishFromSecondaryEntry = useCallback(
    (openConfirmDialog: () => void) => {
      const store = useActiveWorkoutStore.getState();
      if (store.finishPending) return;
      const exercises = store.exercises;
      const skippedCount = countSkippedWorkoutSets(exercises);
      const incompleteCount = countIncompleteWorkoutSets(exercises);
      if (skippedCount + incompleteCount > 0) {
        requestFinish();
        return;
      }
      openConfirmDialog();
    },
    [requestFinish],
  );

  const confirmFinishFromDialog = useCallback(() => {
    void doSave(false);
  }, []);

  const goToSkippedTarget = useCallback(() => {
    const store = useActiveWorkoutStore.getState();
    const flow = store.finishFlow;
    if (flow.phase !== "skipped-dialog") return;
    const { target } = flow;
    const set = store.exercises.find((e) => e.id === target.exerciseId)?.sets[target.setIndex];
    if (set && isSkippedWorkoutSet(set)) {
      store.patchSet(target.exerciseId, target.setIndex, { done: false, skipped: false });
    }
    store.setSelectedExerciseId(target.exerciseId);
    store.setFinishFlow({ phase: "idle" });
    router.push("/active-workout");
  }, [router]);

  const retry = useCallback(() => {
    void doSave(true);
  }, []);

  const returnToWorkout = useCallback(() => {
    useActiveWorkoutStore.getState().setFinishFlow({ phase: "idle" });
  }, []);

  const close = useCallback(() => {
    lastAttempt = null;
    useActiveWorkoutStore.getState().setFinishFlow({ phase: "idle" });
    router.push("/workout-plan");
  }, [router]);

  return {
    state,
    requestFinish,
    requestFinishFromSecondaryEntry,
    confirmFinishFromDialog,
    goToSkippedTarget,
    retry,
    returnToWorkout,
    close,
  };
}

/** Komunikat błędu „sesja wygasła” — 005 sekcja 5.3 (wariant z linkiem „Zaloguj się”). */
export function isSessionExpiredFinishError(message: string): boolean {
  return message === UserMessages.sessionExpired;
}
