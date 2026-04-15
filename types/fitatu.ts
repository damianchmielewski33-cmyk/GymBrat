/** Normalized nutrition snapshot for UI (provider-agnostic). */
export type FitatuMacroGrams = {
  protein: number;
  fat: number;
  carbs: number;
};

export type FitatuMealEntry = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  loggedAt: string;
};

export type FitatuDaySummary = {
  date: string;
  caloriesConsumed: number;
  caloriesGoal?: number;
  /** Gramy makro spożyte (z dziennika). */
  macros: FitatuMacroGrams;
  /** Cele dzienne w gramach — opcjonalne; jeśli brak, UI pokaże tylko spożycie. */
  macroGoals?: FitatuMacroGrams;
  meals: FitatuMealEntry[];
  source: "live" | "mock" | "error";
  /** Gdy `source === "error"` — komunikat dla użytkownika. */
  errorMessage?: string;
};
