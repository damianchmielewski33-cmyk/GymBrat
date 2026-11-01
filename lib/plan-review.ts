import { WEEKLY_SET_TARGETS } from "@/lib/analytics/volume-landmarks";
import { daysBetweenDateKeys } from "@/lib/local-date";
import type { ExerciseAlternative } from "@/lib/plan-alternatives";
import type { PlanAdherence } from "@/lib/mesocycle";
import type {
  AnalyticsMuscleGroupId,
  MuscleAcuteChronic,
  ExerciseSessionPoint,
  StagnationStatus,
} from "@/lib/analytics/types";

/**
 * Przegląd planu: propozycje zmian na podstawie historii. Nic nie jest stosowane
 * automatycznie — użytkownik zatwierdza każdą propozycję osobno.
 */

export type PlanReviewExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  muscle: AnalyticsMuscleGroupId | null;
  /** Historia sesji tego ćwiczenia, rosnąco po dacie. */
  history: ExerciseSessionPoint[];
  stagnation: StagnationStatus | null;
  /** Zaplanowane vs wykonane serie w sesjach tego planu. */
  adherence?: PlanAdherence | null;
  /** Gotowe zamienniki z katalogu (ta sama kategoria). */
  alternatives?: ExerciseAlternative[];
};

export type PlanReviewInput = {
  today: string;
  exercises: PlanReviewExercise[];
  /** Średnia tygodniowa liczba serii efektywnych na grupę (z 30 dni). */
  weeklyEffectiveSets: Partial<Record<AnalyticsMuscleGroupId, number>>;
  fatigueScore: number;
  /** Pasmo obciążenia ostrego do przewlekłego per grupa. */
  acuteChronicBand?: Partial<Record<AnalyticsMuscleGroupId, MuscleAcuteChronic["band"]>>;
  /** Łączna liczba sesji siłowych w ostatnich 8 tygodniach. */
  recentSessionCount: number;
};

export type PlanProposalKind =
  | "add_set"
  | "remove_set"
  | "change_reps"
  | "swap_exercise"
  | "deload_week";

export type PlanProposal = {
  id: string;
  kind: PlanProposalKind;
  exerciseId: string | null;
  title: string;
  reason: string;
  /** Zmiana stosowana do planu; brak = rada ręczna (swap, deload). */
  change?: { sets?: number; reps?: number };
  /** Zmiana wielu ćwiczeń naraz (tydzień odciążenia). */
  bulk?: Array<{ exerciseId: string; sets: number }>;
  /** Wybór zamiennika (wymiana ćwiczenia). */
  replaceOptions?: ExerciseAlternative[];
};

export const MIN_SESSIONS_FOR_REVIEW = 8;
export const MAX_SETS_PER_EXERCISE = 6;
export const MIN_SETS_PER_EXERCISE = 2;
const MAX_PROPOSALS = 5;
const SWAP_MIN_SESSIONS = 6;
const SWAP_MIN_DAYS = 42;
const HIGH_FATIGUE = 70;
const DELOAD_SET_FACTOR = 0.6;
const ADHERENCE_MIN_SESSIONS = 4;
const ADHERENCE_LOW = 0.7;
const STAGNATION_TARGET_REPS = 8;

export type PlanReviewResult = {
  proposals: PlanProposal[];
  /** Za mało danych, by cokolwiek proponować. */
  insufficientData: boolean;
};

function hasNewBestRecently(
  h: ExerciseSessionPoint[],
  today: string,
  days: number,
): boolean {
  if (h.length < 2) return true;
  const best = Math.max(...h.map((p) => p.bestE1rm));
  return h.some(
    (p) => p.bestE1rm >= best && daysBetweenDateKeys(p.date, today) <= days,
  );
}

export function buildPlanReview(input: PlanReviewInput): PlanReviewResult {
  if (input.recentSessionCount < MIN_SESSIONS_FOR_REVIEW) {
    return { proposals: [], insufficientData: true };
  }
  const proposals: PlanProposal[] = [];
  const touched = new Set<string>();
  const push = (p: PlanProposal) => {
    if (p.exerciseId) {
      if (touched.has(p.exerciseId)) return;
      touched.add(p.exerciseId);
    }
    proposals.push(p);
  };

  const fatigued = input.fatigueScore >= HIGH_FATIGUE;
  if (fatigued) {
    push({
      id: "deload-week",
      kind: "deload_week",
      exerciseId: null,
      title: "Zaplanuj tydzień odciążenia",
      reason: `Zmęczenie ${Math.round(input.fatigueScore)}/100 — zmniejszamy liczbę serii o ok. 40% na ten tydzień. Plan możesz przywrócić jednym kliknięciem.`,
      bulk: input.exercises.map((e) => ({
        exerciseId: e.id,
        sets: Math.max(MIN_SETS_PER_EXERCISE, Math.round(e.sets * DELOAD_SET_FACTOR)),
      })),
    });
  }

  // Stagnacja: wymiana ćwiczenia albo zmiana zakresu powtórzeń.
  for (const ex of input.exercises) {
    const h = ex.history;
    if (h.length === 0) continue;
    const spanDays = daysBetweenDateKeys(h[0]!.date, input.today);
    const stuck = ex.stagnation === "stagnating" || ex.stagnation === "regressing";
    if (
      h.length >= SWAP_MIN_SESSIONS &&
      spanDays >= SWAP_MIN_DAYS &&
      stuck &&
      !hasNewBestRecently(h, input.today, SWAP_MIN_DAYS)
    ) {
      push({
        id: `swap-${ex.id}`,
        kind: "swap_exercise",
        exerciseId: ex.id,
        title: `Wymień: ${ex.name}`,
        reason: `Brak postępu e1RM od ${SWAP_MIN_DAYS}+ dni mimo ${h.length} sesji. Wybierz wariant z tej samej grupy.`,
        replaceOptions: ex.alternatives ?? [],
      });
      continue;
    }
    const ad = ex.adherence;
    if (
      ad &&
      ad.completion != null &&
      ad.sessions >= ADHERENCE_MIN_SESSIONS &&
      ad.completion < ADHERENCE_LOW &&
      ex.sets > MIN_SETS_PER_EXERCISE
    ) {
      push({
        id: `adherence-${ex.id}`,
        kind: "remove_set",
        exerciseId: ex.id,
        title: `${ex.name}: −1 seria`,
        reason: `Wykonujesz ${Math.round(ad.completion * 100)}% zaplanowanych serii (${ad.doneSets}/${ad.plannedSets}) — dopasuj plan do realnej objętości.`,
        change: { sets: ex.sets - 1 },
      });
      continue;
    }
    if (
      ex.stagnation === "stagnating" &&
      h.length >= 3 &&
      (ex.reps >= 12 || ex.reps <= 5)
    ) {
      push({
        id: `reps-${ex.id}`,
        kind: "change_reps",
        exerciseId: ex.id,
        title: `${ex.name}: zakres ${STAGNATION_TARGET_REPS} powt.`,
        reason: `Stagnacja przy ${ex.reps} powt. — zmiana zakresu odświeży bodziec.`,
        change: { reps: STAGNATION_TARGET_REPS },
      });
    }
  }

  // Objętość per mięsień.
  const byMuscle = new Map<AnalyticsMuscleGroupId, PlanReviewExercise[]>();
  for (const ex of input.exercises) {
    if (!ex.muscle) continue;
    byMuscle.set(ex.muscle, [...(byMuscle.get(ex.muscle) ?? []), ex]);
  }
  for (const [muscle, list] of byMuscle) {
    const weekly = input.weeklyEffectiveSets[muscle] ?? 0;
    const t = WEEKLY_SET_TARGETS[muscle];
    const acBand = input.acuteChronicBand?.[muscle];
    const loadSpike = acBand === "spike" || acBand === "high";
    if (weekly < t.min && !fatigued && !loadSpike) {
      const cand = list
        .filter(
          (e) =>
            e.sets < MAX_SETS_PER_EXERCISE &&
            e.stagnation !== "regressing" &&
            e.history.length >= 3,
        )
        .sort((a, b) => a.sets - b.sets)[0];
      if (cand) {
        push({
          id: `add-${cand.id}`,
          kind: "add_set",
          exerciseId: cand.id,
          title: `${cand.name}: +1 seria`,
          reason: `Ok. ${Math.round(weekly)} serii/tydz. na tę grupę (zakres ${t.min}–${t.max}).`,
          change: { sets: cand.sets + 1 },
        });
      }
    } else if (weekly > t.max || (acBand === "spike" && weekly > t.min)) {
      const cand = list
        .filter(
          (e) =>
            e.sets > MIN_SETS_PER_EXERCISE &&
            (e.stagnation === "stagnating" ||
              e.stagnation === "regressing" ||
              fatigued ||
              acBand === "spike"),
        )
        .sort((a, b) => b.sets - a.sets)[0];
      if (cand) {
        push({
          id: `remove-${cand.id}`,
          kind: "remove_set",
          exerciseId: cand.id,
          title: `${cand.name}: −1 seria`,
          reason: `Ok. ${Math.round(weekly)} serii/tydz. (powyżej ${t.max}) i brak postępu.`,
          change: { sets: cand.sets - 1 },
        });
      }
    }
  }

  return {
    proposals: proposals.slice(0, MAX_PROPOSALS),
    insufficientData: false,
  };
}

/** Stosuje zatwierdzone zmiany do ćwiczeń planu (z limitami serii i powtórzeń). */
export function applyPlanChanges<
  T extends { id: string; sets: number; reps: number },
>(
  exercises: T[],
  changes: Array<{ exerciseId: string; sets?: number; reps?: number }>,
): T[] {
  const byId = new Map(changes.map((c) => [c.exerciseId, c]));
  return exercises.map((e) => {
    const c = byId.get(e.id);
    if (!c) return e;
    const sets =
      c.sets != null
        ? Math.min(
            MAX_SETS_PER_EXERCISE,
            Math.max(MIN_SETS_PER_EXERCISE, Math.round(c.sets)),
          )
        : e.sets;
    const reps =
      c.reps != null ? Math.min(30, Math.max(1, Math.round(c.reps))) : e.reps;
    return { ...e, sets, reps };
  });
}

/** Zamienia ćwiczenie planu na zamiennik z NOWYM id (historia starego zostaje nietknięta). */
export function replaceExerciseInPlan<
  T extends { id: string; name: string; categoryId: string },
>(
  exercises: T[],
  exerciseId: string,
  alt: { id: string; name: string; categoryId: string },
  newId: string,
): T[] {
  return exercises.map((e) =>
    e.id === exerciseId
      ? { ...e, id: newId, name: alt.name, categoryId: alt.categoryId }
      : e,
  );
}
