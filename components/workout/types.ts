/**
 * Client-side workout tracking state (sent as JSON in existing API — no backend change).
 */
export type WorkoutSetState = {
  /** `null` = pole puste (użytkownik może wyczyścić wpis); liczba = powtórzenia. */
  reps: number | null;
  weight: number;
  done: boolean;
  /** Seria pominięta („Pomiń serię”) — done, ale bez realnego wykonania. */
  skipped?: boolean;
  /** Seria rozgrzewkowa — poza objętością, statystykami i podpowiedziami progresji. */
  warmup?: boolean;
  /** RPE 1–10, opcjonalnie */
  rpe?: number | null;
  /** RIR 0–3+ (w zapasie), opcjonalnie */
  rir?: number | null;
  /** Faktyczna przerwa przed tą serią (s) — z timera rest. */
  restSeconds?: number | null;
  /** Tętno przy serii (opcjonalnie). */
  heartRate?: number | null;
  /** Sekundy od startu sesji w momencie ukończenia serii (Ghost Training). */
  elapsedSecondsAtCompletion?: number | null;
};

export type WorkoutExerciseState = {
  id: string;
  name: string;
  sets: WorkoutSetState[];
  note?: string;
  /** Cele z planu — tylko do wyświetlenia w sesji prowadzonej. */
  targetSets?: number;
  targetReps?: number;
  targetRir?: number | null;
  tempo?: string | null;
  /** Wspólne id = superseria (kolejno w sesji). */
  supersetGroupId?: string | null;
  /** Sugestia ciężaru per seria (z ostatniej sesji). */
  suggestedWeights?: Array<number | null>;
  /** Ostatnia sesja tego ćwiczenia — do „Ostatnio …” i progresji. */
  lastSessionSets?: Array<WorkoutSetState | null>;
  /** Kontekst 2–4 ostatnich treningów (przerwa, stagnacja, średni top). */
  coachContext?: ExerciseCoachContext | null;
  /** Kategoria katalogu (izolacja vs compound). */
  categoryId?: string | null;
  /**
   * Krok ciężaru tego ćwiczenia w kg (np. 2 dla hantli, 5 dla stosu maszyny).
   * Gdy brak — krok wynika ze sprzętu w nazwie, a domyślnie 2,5 kg.
   */
  weightStepKg?: number | null;
  /** Link YouTube techniki (z panelu admina, po dopasowaniu katalogu). */
  techniqueYoutubeUrl?: string | null;
};

/** Jedna sesja historyczna (2–4) dla trendów e1RM / stagnacji. */
export type ExerciseRecentSessionSnap = {
  topKg: number;
  bestReps: number;
  bestE1rm: number;
  avgRir: number | null;
  volumeKg: number;
  /** Najmniej powtórzeń w seriach roboczych na ciężarze top (≥98% topu). */
  minRepsAtTop?: number;
  /** Liczba serii roboczych na ciężarze top. */
  setsAtTop?: number;
  /** Czy w tej sesji wpisano RIR/RPE do serii roboczych. */
  effortLogged?: boolean;
};

export type ExerciseE1rmContext = {
  last: number | null;
  avg: number | null;
  best: number | null;
  /** Slope e1RM po 2–4 sesjach: ujemny / płaski / dodatni. */
  trend4: "down" | "flat" | "up";
};

export type ExercisePrContext = {
  weightKg: number;
  reps: number;
  volumeKg: number;
  e1rm: number;
};

/** Agregat historii ćwiczenia dla live coach / chipów. */
export type ExerciseCoachContext = {
  daysSinceLastSession: number | null;
  recentSessionCount: number;
  avgTopSetWeightKg: number | null;
  /**
   * Stagnacja 2.0: ≥3 sesje AND brak wzrostu kg/reps/e1RM AND średni RIR ≤1.
   * Rosnący e1RM wyklucza stagnację.
   */
  stagnant: boolean;
  e1rm?: ExerciseE1rmContext | null;
  recentSessions?: ExerciseRecentSessionSnap[];
  prs?: ExercisePrContext | null;
  restingHR?: number | null;
  recoveryHR?: number | null;
};
