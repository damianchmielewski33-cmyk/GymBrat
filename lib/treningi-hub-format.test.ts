import { describe, expect, it } from "vitest";
import {
  formatCardioSessions,
  formatExerciseCount,
  formatLastDoneWithRelative,
  formatLastLoad,
  formatLastLoadAria,
  formatMoreExercises,
  formatMusclesSentence,
  formatNextWorkoutMeta,
  formatPlanDayAriaLabel,
  formatPlanDayCaption,
  formatPlanTarget,
  formatPlanTargetAria,
  formatSetsReps,
  formatShortDate,
  formatStreakWeeks,
  formatStreakWeeksAria,
  formatWeekRange,
  formatWeekRangeAria,
  formatWeekSegmentLabel,
  planDayDisplayName,
  type PlanDayAriaInput,
} from "@/lib/treningi-hub-format";

const TODAY = "2026-10-23";

describe("odmiany (BR-12)", () => {
  it.each([
    [1, "1 ćwiczenie"],
    [2, "2 ćwiczenia"],
    [4, "4 ćwiczenia"],
    [5, "5 ćwiczeń"],
    [12, "12 ćwiczeń"],
    [14, "14 ćwiczeń"],
    [21, "21 ćwiczeń"],
    [22, "22 ćwiczenia"],
    [25, "25 ćwiczeń"],
  ])("formatExerciseCount(%i)", (n, expected) => {
    expect(formatExerciseCount(n)).toBe(expected);
  });

  it.each([
    [1, "+ 1 kolejne ćwiczenie"],
    [2, "+ 2 kolejne ćwiczenia"],
    [4, "+ 4 kolejne ćwiczenia"],
    [5, "+ 5 kolejnych ćwiczeń"],
    [12, "+ 12 kolejnych ćwiczeń"],
    [14, "+ 14 kolejnych ćwiczeń"],
    [21, "+ 21 kolejnych ćwiczeń"],
    [22, "+ 22 kolejne ćwiczenia"],
    [25, "+ 25 kolejnych ćwiczeń"],
  ])("formatMoreExercises(%i)", (n, expected) => {
    expect(formatMoreExercises(n)).toBe(expected);
  });

  it.each([
    [1, "1 tydzień z rzędu z treningiem"],
    [2, "2 tygodnie z rzędu z treningiem"],
    [4, "4 tygodnie z rzędu z treningiem"],
    [5, "5 tygodni z rzędu z treningiem"],
    [12, "12 tygodni z rzędu z treningiem"],
    [14, "14 tygodni z rzędu z treningiem"],
    [21, "21 tygodni z rzędu z treningiem"],
    [22, "22 tygodnie z rzędu z treningiem"],
    [25, "25 tygodni z rzędu z treningiem"],
  ])("formatStreakWeeksAria(%i)", (n, expected) => {
    expect(formatStreakWeeksAria(n)).toBe(expected);
  });

  it.each([
    [0, "brak sesji"],
    [1, "1 sesja"],
    [2, "2 sesje"],
    [4, "4 sesje"],
    [5, "5 sesji"],
    [12, "12 sesji"],
    [14, "14 sesji"],
    [21, "21 sesji"],
    [22, "22 sesje"],
    [25, "25 sesji"],
  ])("formatCardioSessions(%i)", (n, expected) => {
    expect(formatCardioSessions(n)).toBe(expected);
  });
});

describe("chip serii", () => {
  it("ukryty przy zerze i wartościach ujemnych", () => {
    expect(formatStreakWeeks(0)).toBeNull();
    expect(formatStreakWeeks(-2)).toBeNull();
  });
  it("skrót tyg. dla każdej liczby", () => {
    expect(formatStreakWeeks(1)).toBe("1 tyg. z rzędu");
    expect(formatStreakWeeks(12)).toBe("12 tyg. z rzędu");
  });
});

describe("formatLastLoad / formatPlanTarget", () => {
  it("ciężar całkowity i dziesiętny z przecinkiem", () => {
    expect(formatLastLoad({ weightKg: 80, reps: 8 })).toBe("80 kg × 8");
    expect(formatLastLoad({ weightKg: 27.5, reps: 10 })).toBe("27,5 kg × 10");
    expect(formatLastLoad({ weightKg: 52.5, reps: 6 })).toBe("52,5 kg × 6");
  });
  it("masa ciała bez „0 kg”", () => {
    const text = formatLastLoad({ weightKg: 0, reps: 12 });
    expect(text).toBe("× 12 powt.");
    expect(text).not.toContain("kg");
  });
  it("teksty dla czytnika", () => {
    expect(formatLastLoadAria("Wyciskanie sztangi leżąc", { weightKg: 80, reps: 8 })).toBe(
      "Wyciskanie sztangi leżąc: ostatnio 80 kg, 8 powtórzeń",
    );
    expect(formatLastLoadAria("Pompki", { weightKg: 0, reps: 12 })).toBe(
      "Pompki: ostatnio 12 powtórzeń, bez obciążenia",
    );
    expect(formatPlanTargetAria("Przysiad", 3, 10)).toBe(
      "Przysiad: w planie 3 serie po 10 powtórzeń",
    );
    expect(formatPlanTargetAria("Przysiad", 0, 10)).toBe(
      "Przysiad: nowe ćwiczenie, bez historii",
    );
  });
  it("cel planu albo „nowe”, nigdy NaN", () => {
    expect(formatPlanTarget(3, 10)).toBe("plan 3 × 10");
    expect(formatPlanTarget(0, 10)).toBe("nowe");
    expect(formatPlanTarget(3, 0)).toBe("nowe");
    expect(formatPlanTarget(Number.NaN, 10)).toBe("nowe");
    expect(formatSetsReps(3, 10)).toBe("3 × 10");
    expect(formatSetsReps(0, 0)).toBe("");
  });
});

describe("zakres tygodnia", () => {
  it.each([
    ["2026-10-19", "2026-10-25", "Tydzień 19–25.10", "Tydzień od 19 do 25 października"],
    ["2026-10-26", "2026-11-01", "Tydzień 26.10–01.11", "Tydzień od 26 października do 1 listopada"],
    ["2025-12-29", "2026-01-04", "Tydzień 29.12–04.01", "Tydzień od 29 grudnia do 4 stycznia"],
    ["2026-11-02", "2026-11-08", "Tydzień 02–08.11", "Tydzień od 2 do 8 listopada"],
  ])("%s – %s", (start, end, visible, aria) => {
    expect(formatWeekRange(start, end)).toBe(visible);
    expect(formatWeekRangeAria(start, end)).toBe(aria);
  });
  it("nieprawidłowy klucz nie rzuca", () => {
    expect(formatWeekRange("x", "y")).toBe("Tydzień");
  });
});

describe("daty ostatniego treningu", () => {
  it("krótka data z rokiem tylko dla innego roku", () => {
    expect(formatShortDate("2026-10-22", TODAY)).toBe("22.10");
    expect(formatShortDate("2025-10-22", TODAY)).toBe("22.10.2025");
  });
  it.each([
    [null, "pierwszy raz"],
    ["2026-10-23", "ostatnio 23.10 (dziś)"],
    ["2026-10-22", "ostatnio 22.10 (wczoraj)"],
    ["2026-10-21", "ostatnio 21.10 (2 dni temu)"],
    ["2026-10-14", "ostatnio 14.10 (9 dni temu)"],
    ["2026-10-10", "ostatnio 10.10 (13 dni temu)"],
    ["2026-10-09", "ostatnio 09.10"],
    ["2025-09-02", "ostatnio 02.09.2025"],
  ])("formatLastDoneWithRelative(%s)", (ymd, expected) => {
    expect(formatLastDoneWithRelative(ymd, TODAY)).toBe(expected);
  });
  it("linia meta karty Następny", () => {
    expect(formatNextWorkoutMeta(6, "2026-10-14", TODAY)).toBe(
      "6 ćwiczeń · ostatnio 14.10 (9 dni temu)",
    );
    expect(formatNextWorkoutMeta(1, null, TODAY)).toBe("1 ćwiczenie · pierwszy raz");
  });
});

describe("wiersz dnia planu", () => {
  it("nazwa zastępcza", () => {
    expect(planDayDisplayName("  ", 4)).toBe("Dzień 4");
    expect(planDayDisplayName(" Nogi ", 2)).toBe("Nogi");
  });
  it("podpis", () => {
    expect(formatPlanDayCaption(2, 5, "2026-10-22", TODAY)).toBe("Dzień 2 · 5 ćw. · 22.10");
    expect(formatPlanDayCaption(2, 5, "2025-10-22", TODAY)).toBe(
      "Dzień 2 · 5 ćw. · 22.10.2025",
    );
    expect(formatPlanDayCaption(4, 3, null, TODAY)).toBe("Dzień 4 · 3 ćw. · jeszcze nie robiony");
    expect(formatPlanDayCaption(5, 0, "2026-10-01", TODAY)).toBe("Dzień 5 · 0 ćw. · uzupełnij plan");
  });

  const base: PlanDayAriaInput = {
    dayNumber: 3,
    planName: "Push",
    exerciseCount: 6,
    muscleLabels: ["Klatka", "Barki", "Ramiona"],
    doneThisWeek: false,
    isNext: true,
    lastWorkoutDate: "2026-10-14",
    todayKey: TODAY,
  };

  it("aria-label: następny z datą", () => {
    expect(formatPlanDayAriaLabel(base)).toBe(
      "Rozpocznij: Dzień 3, Push. Partie: klatka, barki, ramiona. Następny. Ostatnio 14 października.",
    );
  });
  it("aria-label: wykonany w tym tygodniu", () => {
    expect(
      formatPlanDayAriaLabel({
        ...base,
        dayNumber: 2,
        planName: "Nogi",
        muscleLabels: ["Nogi", "Łydki", "Brzuch"],
        doneThisWeek: true,
        isNext: false,
        lastWorkoutDate: "2026-10-22",
      }),
    ).toBe("Rozpocznij: Dzień 2, Nogi. Partie: nogi, łydki, brzuch. Wykonany w tym tygodniu.");
  });
  it("aria-label: nierozpoznane partie, nigdy nie robiony", () => {
    expect(
      formatPlanDayAriaLabel({
        ...base,
        dayNumber: 4,
        planName: "Mobilność",
        muscleLabels: null,
        isNext: false,
        lastWorkoutDate: null,
      }),
    ).toBe("Rozpocznij: Dzień 4, Mobilność. Partie nierozpoznane. Jeszcze nie robiony.");
  });
  it("aria-label: pusty dzień i pusta nazwa", () => {
    expect(formatPlanDayAriaLabel({ ...base, dayNumber: 5, planName: "", exerciseCount: 0 })).toBe(
      "Uzupełnij plan: Dzień 5, brak ćwiczeń.",
    );
  });
  it("aria-label: data z innego roku z rokiem", () => {
    expect(
      formatPlanDayAriaLabel({ ...base, isNext: false, lastWorkoutDate: "2025-12-30" }),
    ).toContain("Ostatnio 30 grudnia 2025.");
  });
  it("zdanie o partiach", () => {
    expect(formatMusclesSentence([])).toBe("Partie nierozpoznane.");
    expect(formatMusclesSentence(["Plecy", "Pośladki"])).toBe("Partie: plecy, pośladki.");
  });
});

describe("segmenty tygodnia", () => {
  it.each([
    [false, false, "Dzień 2: jeszcze nie w tym tygodniu"],
    [true, false, "Dzień 2: wykonany w tym tygodniu"],
    [false, true, "Dzień 2: następny"],
    [true, true, "Dzień 2: wykonany w tym tygodniu, następny"],
  ])("done=%s next=%s", (done, next, expected) => {
    expect(formatWeekSegmentLabel(2, done, next)).toBe(expected);
  });
});
