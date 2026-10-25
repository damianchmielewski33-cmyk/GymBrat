import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { SubmitWorkoutResult } from "@/lib/workout-complete-submit";

/**
 * Testy logiki przepływu zakończenia (005 P2, P3, E-5, E-6, E-12, AC-2.1, AC-2.5, AC-3.2,
 * AC-3.4, AC-3.5, BR-2, BR-7). Hook jest wywoływany bez DOM: `useCallback` przepuszcza
 * funkcję, a `useSyncExternalStore` (używane przez zustand) zwraca aktualny snapshot.
 * Store jest prawdziwy; zapis sieciowy (`submitCompletedWorkout`) jest atrapą.
 */

const { routerMock, submitMock } = vi.hoisted(() => {
  // Store persist czyta `localStorage`; w środowisku `node` go nie ma.
  const memory = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });
  return { routerMock: { push: vi.fn() }, submitMock: vi.fn() };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const patched = { ...actual, useCallback: <T,>(fn: T) => fn };
  return { ...patched, default: patched };
});

// zustand jest w node_modules (nie przechodzi przez mock `react`), więc selektor hooka
// zastępujemy odczytem snapshotu; `getState`/`setState` pozostają prawdziwe.
vi.mock("@/lib/stores/active-workout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stores/active-workout")>();
  const realStore = actual.useActiveWorkoutStore;
  const useStoreWithoutReact = Object.assign(
    (selector: (s: ReturnType<typeof realStore.getState>) => unknown) =>
      selector(realStore.getState()),
    realStore,
  );
  return { ...actual, useActiveWorkoutStore: useStoreWithoutReact };
});

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/workout-complete-submit", () => ({
  submitCompletedWorkout: (...args: unknown[]) => submitMock(...args),
}));
vi.mock("@/actions/workout-plan", () => ({
  fetchLastWorkoutHintsForPlan: vi.fn(async () => ({})),
}));
vi.mock("@/lib/haptics", () => ({ hapticNewMax: vi.fn(), hapticWorkoutDone: vi.fn() }));
vi.mock("@/lib/active-workout-persist", () => ({ requestActiveWorkoutCloudPush: vi.fn() }));
vi.mock("@/lib/client-csrf", () => ({
  ensureCsrfCookie: vi.fn(async () => undefined),
  getXsrfHeaders: () => ({}),
}));
vi.mock("@/lib/stores/community-workout", () => ({
  useCommunityWorkoutStore: {
    getState: () => ({ groupSessionId: null, clear: () => undefined }),
  },
}));

const { useActiveWorkoutStore } = await import("@/lib/stores/active-workout");
const { useWorkoutFinishFlow } = await import("@/components/active-workout/use-workout-finish-flow");

const SAVED: SubmitWorkoutResult = {
  status: "saved",
  workoutId: "w-1",
  duplicate: false,
  strengthDeltaPercent: null,
  planCompare: null,
};

function setSession(exercises: WorkoutExerciseState[]) {
  useActiveWorkoutStore.getState().reset();
  useActiveWorkoutStore.setState({ exercises, title: "Trening A" });
}

function flowState() {
  return useActiveWorkoutStore.getState().finishFlow;
}

const DONE_SET = { reps: 8, weight: 60, done: true };

describe("useWorkoutFinishFlow: wejście zakończenia (P2, P3)", () => {
  beforeEach(() => {
    submitMock.mockReset();
    routerMock.push.mockReset();
    setSession([]);
  });

  it("bez pominięć i niewykonanych serii zapis startuje od razu, bez dialogu (AC-2.2)", async () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    submitMock.mockResolvedValueOnce(SAVED);

    useWorkoutFinishFlow().requestFinish();

    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(flowState()).toMatchObject({
      phase: "done",
      result: { saveStatus: "saved", workoutId: "w-1", setsDone: 1, setsTotal: 1, volumeKg: 480 },
    });
    // Sesja w store czyszczona dopiero po sukcesie (AC-3.3).
    expect(useActiveWorkoutStore.getState().exercises).toEqual([]);
  });

  it("pominięta seria otwiera dialog z licznikami i pierwszym celem, zapis NIE startuje (AC-2.1, AC-2.4)", () => {
    setSession([
      { id: "a", name: "Przysiad", sets: [{ reps: 5, weight: 100, done: true, skipped: true }, { reps: null, weight: 0, done: false }] },
    ]);

    useWorkoutFinishFlow().requestFinish();

    expect(flowState()).toEqual({
      phase: "skipped-dialog",
      skippedCount: 1,
      incompleteCount: 1,
      target: { exerciseId: "a", exerciseName: "Przysiad", setIndex: 0 },
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("same niewykonane serie otwierają dialog z incompleteCount (AC-2.3, wariant „niewykonane”)", () => {
    setSession([{ id: "a", name: "Wiosłowanie", sets: [DONE_SET, { reps: null, weight: 0, done: false }] }]);

    useWorkoutFinishFlow().requestFinish();

    expect(flowState()).toMatchObject({ phase: "skipped-dialog", skippedCount: 0, incompleteCount: 1 });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("trening wyłącznie z serii na masę ciała (0 kg, powt. > 0) zapisuje się bez dialogu (005 p.7)", async () => {
    setSession([
      { id: "p", name: "Pompki", sets: [{ reps: 12, weight: 0, done: true }, { reps: 10, weight: 0, done: true }] },
    ]);
    submitMock.mockResolvedValueOnce(SAVED);

    useWorkoutFinishFlow().requestFinish();

    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(flowState()).toMatchObject({ result: { volumeKg: 0, setsDone: 2 } });
  });

  it("„Zakończ i zapisz” w dialogu uruchamia zapis dokładnie raz (AC-2.5, P3)", async () => {
    setSession([{ id: "a", name: "Przysiad", sets: [{ reps: 5, weight: 100, done: true, skipped: true }] }]);
    submitMock.mockResolvedValueOnce(SAVED);

    useWorkoutFinishFlow().requestFinish();
    expect(flowState().phase).toBe("skipped-dialog");

    useWorkoutFinishFlow().confirmFinishFromDialog();

    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("„Wróć do serii” zamyka dialog bez zapisu, ustawia cel i przenosi na aktywny trening (AC-2.5)", () => {
    setSession([
      { id: "a", name: "Przysiad", sets: [{ reps: 5, weight: 100, done: true, skipped: true }] },
      { id: "b", name: "Wyciskanie", sets: [{ reps: 8, weight: 60, done: false }] },
    ]);
    useWorkoutFinishFlow().requestFinish();

    useWorkoutFinishFlow().goToSkippedTarget();

    expect(submitMock).not.toHaveBeenCalled();
    expect(flowState().phase).toBe("idle");
    expect(routerMock.push).toHaveBeenCalledWith("/active-workout");
    const store = useActiveWorkoutStore.getState();
    expect(store.selectedExerciseId).toBe("a");
    expect(store.exercises[0]!.sets[0]).toMatchObject({ done: false, skipped: false });
  });

  it("wielokrotne wywołania w trakcie zapisu (dwa tapnięcia, ponowienie) wysyłają jedno żądanie (AC-3.2, BR-2)", async () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    let resolveSave: (value: SubmitWorkoutResult) => void = () => undefined;
    submitMock.mockReturnValueOnce(new Promise<SubmitWorkoutResult>((r) => (resolveSave = r)));

    useWorkoutFinishFlow().requestFinish();
    useWorkoutFinishFlow().requestFinish();
    useWorkoutFinishFlow().retry();

    expect(submitMock).toHaveBeenCalledTimes(1);
    resolveSave(SAVED);
    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("„Zamknij” kończy ekran bez żądania zapisu i wraca na /workout-plan (AC-4.11)", () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);

    useWorkoutFinishFlow().close();

    expect(submitMock).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/workout-plan");
    expect(flowState().phase).toBe("idle");
  });

  it("zapis w kolejce offline: ekran końcowy bez workoutId i z statusem „queued” (AC-3.4, E-6)", async () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    submitMock.mockResolvedValueOnce({ status: "queued", localId: "L1" });

    useWorkoutFinishFlow().requestFinish();

    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(flowState()).toMatchObject({
      result: { saveStatus: "queued", workoutId: null, planCompare: null },
    });
  });
});

describe("useWorkoutFinishFlow: requestFinishFromSecondaryEntry (005, defekt B-3)", () => {
  beforeEach(() => {
    submitMock.mockReset();
    routerMock.push.mockReset();
    setSession([]);
  });

  it("bez pominiętych/niewykonanych serii otwiera tylko dialog potwierdzenia (prosty), nie dialog pominiętych", () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    const openConfirm = vi.fn();

    useWorkoutFinishFlow().requestFinishFromSecondaryEntry(openConfirm);

    expect(openConfirm).toHaveBeenCalledTimes(1);
    expect(flowState().phase).toBe("idle");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("z pominiętą serią idzie wprost do dialogu pominiętych, bez dodatkowego potwierdzenia (D-3)", () => {
    setSession([
      { id: "a", name: "Przysiad", sets: [{ reps: 5, weight: 100, done: true, skipped: true }] },
    ]);
    const openConfirm = vi.fn();

    useWorkoutFinishFlow().requestFinishFromSecondaryEntry(openConfirm);

    expect(openConfirm).not.toHaveBeenCalled();
    expect(flowState()).toMatchObject({ phase: "skipped-dialog", skippedCount: 1 });
  });
});

describe("useWorkoutFinishFlow: błąd zapisu (AC-3.5, E-5, E-12)", () => {
  beforeEach(() => {
    submitMock.mockReset();
    routerMock.push.mockReset();
  });

  it("błąd zapisu nie pokazuje ekranu końcowego i nie resetuje sesji", () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    const operationBefore = useActiveWorkoutStore.getState().ensureOperationId();
    submitMock.mockResolvedValueOnce({ status: "error", message: "Nie udało się zapisać." });

    useWorkoutFinishFlow().requestFinish();

    return vi.waitFor(() => {
      expect(flowState()).toEqual({ phase: "error", message: "Nie udało się zapisać." });
      const store = useActiveWorkoutStore.getState();
      expect(store.exercises).toHaveLength(1);
      expect(store.exercises[0]!.sets).toEqual([DONE_SET]);
      expect(store.operationId).toBe(operationBefore);
      expect(store.finishPending).toBe(false);
    });
  });

  it("„Spróbuj ponownie” wysyła te same dane z tym samym operationId i endedAt (BR-2)", async () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    submitMock.mockResolvedValueOnce({ status: "error", message: "Błąd sieci" });
    submitMock.mockResolvedValueOnce(SAVED);

    useWorkoutFinishFlow().requestFinish();
    await vi.waitFor(() => expect(flowState().phase).toBe("error"));

    useWorkoutFinishFlow().retry();

    await vi.waitFor(() => expect(flowState().phase).toBe("done"));
    expect(submitMock).toHaveBeenCalledTimes(2);
    const first = submitMock.mock.calls[0]![0] as { operationId: string; endedAt: number };
    const second = submitMock.mock.calls[1]![0] as { operationId: string; endedAt: number };
    expect(second.operationId).toBe(first.operationId);
    expect(second.endedAt).toBe(first.endedAt);
  });

  it("konflikt operacji (409, ADR 0004 p.12.5) kończy się jak błąd zapisu, nie ekranem sukcesu", () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    submitMock.mockResolvedValueOnce({ status: "conflict", message: "Konflikt operacji." });

    useWorkoutFinishFlow().requestFinish();

    return vi.waitFor(() => {
      expect(flowState()).toEqual({ phase: "error", message: "Konflikt operacji." });
      const store = useActiveWorkoutStore.getState();
      expect(store.exercises).toHaveLength(1);
      expect(store.finishPending).toBe(false);
    });
  });

  it("„Wróć do treningu” zamyka stan błędu i zostawia sesję nienaruszoną", () => {
    setSession([{ id: "a", name: "Wyciskanie", sets: [DONE_SET] }]);
    submitMock.mockResolvedValueOnce({ status: "error", message: "Błąd" });
    useWorkoutFinishFlow().requestFinish();

    return vi.waitFor(() => {
      expect(flowState().phase).toBe("error");
      useWorkoutFinishFlow().returnToWorkout();
      expect(flowState().phase).toBe("idle");
      expect(useActiveWorkoutStore.getState().exercises).toHaveLength(1);
    });
  });
});
