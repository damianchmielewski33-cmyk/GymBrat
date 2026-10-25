import { describe, expect, it } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  formatDaysAgo,
  formatExerciseSchemeParts,
  formatRepTarget,
  formatSeriesCount,
  formatSessionClock,
  formatSessionClockSpoken,
  formatSignedKg,
  formatWeightReps,
  primarySetActionLabel,
} from "@/lib/active-workout-copy";
import { buildSetSuggestionView } from "@/lib/set-suggestion-view";
import {
  findPreviousCompletedSet,
  parseRepsInput,
  parseWeightInput,
  resolveInitialSetDraft,
} from "@/lib/workout-set-draft";
import { resolveSetSaveIssue } from "@/lib/workout-skipped-sets";

describe("active-workout-copy", () => {
  it("formatRepTarget: półpauza w zakresie, pojedyncza liczba, brak celu", () => {
    expect(formatRepTarget(8)).toBe("6–8");
    expect(formatRepTarget(1)).toBe("1");
    expect(formatRepTarget(null)).toBeNull();
    expect(formatRepTarget(0)).toBeNull();
  });

  it("formatSeriesCount: odmiana 1 / 2-4 / 5+ / 12-14 / 22-24", () => {
    expect(formatSeriesCount(1)).toBe("1 seria");
    expect(formatSeriesCount(3)).toBe("3 serie");
    expect(formatSeriesCount(5)).toBe("5 serii");
    expect(formatSeriesCount(12)).toBe("12 serii");
    expect(formatSeriesCount(22)).toBe("22 serie");
  });

  it("formatExerciseSchemeParts: pomija części bez danych", () => {
    expect(
      formatExerciseSchemeParts({ sets: 3, targetReps: 8, targetRir: 1, tempo: " 3-1-1 " }),
    ).toEqual(["3 serie × 6–8", "RIR 1", "tempo 3-1-1"]);
    expect(formatExerciseSchemeParts({ sets: 3 })).toEqual(["3 serie"]);
    expect(formatExerciseSchemeParts({ sets: 2, targetRir: 0 })).toEqual(["2 serie", "RIR 0"]);
  });

  it("formatSessionClock: m:ss i h:mm:ss od godziny", () => {
    expect(formatSessionClock(0)).toBe("0:00");
    expect(formatSessionClock(24 * 60 + 5)).toBe("24:05");
    expect(formatSessionClock(3600 + 2 * 60 + 15)).toBe("1:02:15");
    expect(formatSessionClock(-5)).toBe("0:00");
  });

  it("formatSessionClockSpoken: odmiana jednostek", () => {
    expect(formatSessionClockSpoken(24 * 60 + 5)).toBe("24 minuty 5 sekund");
    expect(formatSessionClockSpoken(3600 + 60 + 1)).toBe("1 godzinę 1 minutę 1 sekundę");
    expect(formatSessionClockSpoken(42)).toBe("42 sekundy");
  });

  it("formatDaysAgo: dziś / wczoraj / N dni temu / brak od 7 dni", () => {
    expect(formatDaysAgo(0)).toBe("dziś");
    expect(formatDaysAgo(1)).toBe("wczoraj");
    expect(formatDaysAgo(5)).toBe("5 dni temu");
    expect(formatDaysAgo(7)).toBeNull();
    expect(formatDaysAgo(null)).toBeNull();
  });

  it("formatWeightReps i formatSignedKg: przecinek dziesiętny i znak minus", () => {
    expect(formatWeightReps(32, 6)).toBe("32 × 6");
    expect(formatWeightReps(17.5, null)).toBe("17,5");
    expect(formatSignedKg(2)).toBe("+2 kg");
    expect(formatSignedKg(-2.5)).toBe("−2,5 kg");
  });

  it("primarySetActionLabel: zawsze zapis, nigdy „Pomiń”", () => {
    expect(primarySetActionLabel(2, false)).toBe("Zapisz serię 2");
    expect(primarySetActionLabel(1, true)).toBe("Popraw serię 1");
  });

  it("primarySetActionLabel: ostatnia otwarta seria sesji zapisuje i kończy trening", () => {
    expect(primarySetActionLabel(3, false, true)).toBe(
      "Zakończ ostatnią serię i zapisz",
    );
    // Seria już zaliczona (poprawka) ma pierwszeństwo nad „ostatnia otwarta”.
    expect(primarySetActionLabel(3, true, true)).toBe("Popraw serię 3");
  });
});

/**
 * Regresja błędu z karty 004: podpowiedź była tylko `placeholder`, pole ciężaru puste,
 * więc przycisk główny pokazywał „Pomiń serię” i pomijał serię mimo widocznych „65 kg”.
 * Teraz wartość początkowa trafia do pola, a zapis jednym dotknięciem przechodzi walidację.
 */
describe("regresja: „Pomiń serię” przy wypełnionej podpowiedzi", () => {
  const exercise: WorkoutExerciseState = {
    id: "ex-1",
    name: "Wyciskanie sztangi",
    targetReps: 12,
    sets: [
      { reps: 12, weight: 0, done: false },
      { reps: 12, weight: 0, done: false },
    ],
    suggestedWeights: [65, 65],
    lastSessionSets: [
      { reps: 11, weight: 65, done: true },
      { reps: 10, weight: 65, done: true },
    ],
  };

  it("pole ciężaru dostaje wartość, przycisk to „Zapisz serię 1”, zapis bez problemu walidacji", () => {
    const setIndex = 0;
    const set = exercise.sets[setIndex]!;
    const suggestion = buildSetSuggestionView(exercise, setIndex);
    const draft = resolveInitialSetDraft({
      set,
      suggestion,
      lastSessionSet: exercise.lastSessionSets?.[setIndex] ?? null,
      previousSessionSet: findPreviousCompletedSet(exercise.sets, setIndex),
    });

    expect(draft.weightKg).not.toBeNull();
    expect(draft.weightKg!).toBeGreaterThan(0);

    const weightText = String(draft.weightKg);
    const repsText = draft.reps != null ? String(draft.reps) : "";
    const weight = parseWeightInput(weightText) ?? 0;
    const reps = parseRepsInput(repsText);

    expect(resolveSetSaveIssue(weight, reps)).toBeNull();
    expect(primarySetActionLabel(setIndex + 1, false)).toBe("Zapisz serię 1");
  });

  it("puste pole ciężaru z powtórzeniami nie blokuje zapisu (masa ciała, decyzja 005 p.7)", () => {
    expect(resolveSetSaveIssue(parseWeightInput("") ?? 0, 12)).toBeNull();
  });

  it("brak powtórzeń daje komunikat walidacji „reps”, niezależnie od ciężaru", () => {
    expect(resolveSetSaveIssue(parseWeightInput("") ?? 0, null)).toBe("reps");
  });
});
