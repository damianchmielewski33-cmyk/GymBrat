import { type ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";

export type HomeStartWeightPoint = { date: string; kg: number };

export type HomeStartWaistPoint = { date: string; cm: number };

export type HomeStartSpark = { date: string; value: number };

export type HomeStartMacroPoint = {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  remainingKcal: number | null;
};

/** Pozostałe B/W/T do spożycia w bieżącym dniu względem celu z profilu. */
export type HomeStartTodayMacros = {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
  proteinRemaining: number | null;
  carbsRemaining: number | null;
  fatRemaining: number | null;
};

/** Sumaryczne B/W/T w bieżącym tygodniu (pon→dziś) vs suma celów tych dni. */
export type HomeStartWeekMacros = HomeStartTodayMacros;

export type HomeStartDashboard = {
  firstName: string | null;
  lastName: string | null;
  nextWorkout: {
    planId: string;
    planName: string;
    exerciseCount: number;
    lastWorkoutDate: string | null;
    exerciseNames: string[];
    firstTime: boolean;
  } | null;
  workoutsThisWeek: number;
  /** Cel treningów w tygodniu (profil); domyślnie 4. */
  weeklySessionsTarget: number;
  cardioThisWeekMinutes: number;
  cardioWeeklyGoal: number;
  /** Postęp pn–nd do arkusza „Dodaj cardio” (ADR 0009) — niezależny od rolling kafelka. */
  cardioSheetWeek: {
    minutesCompleted: number;
    goalMinutes: number;
    weekLabel: string;
  };
  /** Dodatkowe cardio przy nadwyżce makro (pasek na Pulpicie). */
  extraCardio: ExtraCardioAdvice;
  /** Kolejne tygodnie kalendarzowe (pon–niedz.) z ≥1 treningiem. */
  workoutStreakWeeks: number;
  daysInProgram: number | null;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
  currentWeightKg: number | null;
  weightFromStartKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  macroSeries: HomeStartMacroPoint[];
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
  formToday: {
    energy: number | null;
    sleep: number | null;
    digestion: number | null;
    training: number | null;
  };
  /** Notatka / feedback z ostatniego raportu (sekcja „Od Damiana”). */
  coachNote: {
    text: string;
    dateKey: string;
  } | null;
  compliance: {
    dietPct: number | null;
    trainingPct: number | null;
    cardioPct: number | null;
    lastN: number;
    doneN: number;
    historyWindow: number;
    dietHistory: Array<"tak" | "nie" | null>;
    trainingHistory: Array<"tak" | "nie" | null>;
    cardioHistory: Array<"tak" | "nie" | null>;
  };
  transformation: {
    firstPhotoUrl: string | null;
    latestPhotoUrl: string | null;
    latestPhotoDate: string | null;
  };
  dimensions: {
    weightKg: number | null;
    waistCm: number | null;
    armCm: number | null;
    abdomenCm: number | null;
    chestCm: number | null;
    thighCm: number | null;
    waistSpark: HomeStartSpark[];
    thighSpark: HomeStartSpark[];
    chestSpark: HomeStartSpark[];
    armSpark: HomeStartSpark[];
  };
};
