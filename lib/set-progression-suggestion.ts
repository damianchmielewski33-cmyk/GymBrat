/**
 * Double progression + deload % — wspólny silnik dla Live Coach i chipów.
 *
 * - Najpierw powtórzenia do range.max (bez easy_anywhere).
 * - +kg dopiero po N kolejnych łatwych seriach (RIR ≥ 2) na górze zakresu
 *   albo — gdy użytkownik nie loguje RIR/RPE — po 2 treningach, w których
 *   wszystkie serie robocze były na górze zakresu.
 * - RIR > RPE; konflikt → brak progresji (hold).
 * - Deload: max(1 krok, 5% ciężaru), zaokrąglony do kroku ćwiczenia.
 */

import {
  easySetsRequiredForWeightBump,
  inferMovementKind,
  type MovementKind,
} from "@/lib/exercise-movement-kind";
import { resolveEffortContext } from "@/lib/live-coach/movement-profiles";
import {
  classifyEffort,
  isEasyEffort,
  isHardEffort,
  type EffortContext,
} from "@/lib/set-effort";
import {
  DEFAULT_STEP_KG,
  resolveWeightStep,
  round2,
  roundHoldKg,
  type WeightStep,
} from "@/lib/weight-step";

export type LastSetSnapshot = {
  weight: number;
  reps: number | null;
  rir?: number | null;
  rpe?: number | null;
};

export type RepRange = { min: number; max: number };

export type SetProgressionSuggestion = {
  /** Pełna linia bez ikony: „Dziś spróbuj 38,5 kg × 8 · +2,5 kg, bo …” */
  fullText: string;
  /** Fragment do podświetlenia na zielono: „38,5 kg × 8” */
  highlight: string;
  /** Prefiks przed highlight: „Dziś spróbuj ” */
  prefix: string;
  /** Sufiks po highlight: „ · +2,5 kg, bo …” */
  suffix: string;
  weightKg: number;
  reps: number;
  deltaKg: number;
  kind: "weight" | "reps";
  reason: string;
  /** Kod reguły (testy / debug). */
  rule?: string;
};

/** Kody reguł ustawiane w `rule` przez silnik progresji (do mapowania na ekranie). */
export const SET_PROGRESSION_RULES = [
  "layoff_reduce",
  "stagnation_deload",
  "below_range_or_hard",
  "in_range_add_reps",
  "top_of_range_easy",
  "top_of_range_reps_only",
] as const;

const PLATE_STEP = DEFAULT_STEP_KG;
const DELOAD_PCT = 0.05;
const STAGNATION_COMPOUND_DELOAD_PCT = 0.1;

/** Ile ostatnich treningów musi mieć wszystkie serie na górze zakresu (bez RIR/RPE). */
export const REPS_ONLY_SESSIONS_REQUIRED = 2;

export function formatKgPl(kg: number): string {
  if (!Number.isFinite(kg)) return "0";
  const r = round2(kg);
  if (Math.abs(r - Math.round(r)) < 0.005) return String(Math.round(r));
  return String(r).replace(".", ",");
}

export function roundToPlateStep(kg: number, step = PLATE_STEP): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

/**
 * Dokładnie +step kg (domyślnie 2,5; krok zależy od ćwiczenia / sprzętu).
 * Bez dodatkowego zaokrąglania do 0,5 — kroki 1,25 i 2 muszą się zachować.
 */
export function bumpWeightByPlate(kg: number, step = PLATE_STEP): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const s = Number.isFinite(step) && step > 0 ? step : PLATE_STEP;
  return round2(kg + s);
}

/** Deload: max(1 krok, 5% ciężaru roboczego) — surowa wartość przed zaokrągleniem. */
export function deloadDropKg(
  workingKg: number,
  step = PLATE_STEP,
  pct = DELOAD_PCT,
): number {
  const s = Number.isFinite(step) && step > 0 ? step : PLATE_STEP;
  if (!Number.isFinite(workingKg) || workingKg <= 0) return s;
  return Math.max(s, workingKg * pct);
}

/**
 * Deload zaokrąglony do kroku ćwiczenia, liczony od ciężaru roboczego
 * (zdejmujemy całkowitą liczbę kroków, min. 1) — wynik da się załadować,
 * jeśli ciężar roboczy dało się załadować (np. 62,5 → 60, hantle 2 kg: 20 → 18).
 */
export function applyDeload(
  workingKg: number,
  step = PLATE_STEP,
  pct = DELOAD_PCT,
): number {
  const s = Number.isFinite(step) && step > 0 ? step : PLATE_STEP;
  if (!Number.isFinite(workingKg) || workingKg <= 0) return 0;
  const drop = deloadDropKg(workingKg, s, pct);
  const steps = Math.max(1, Math.round(drop / s));
  return Math.max(0, round2(workingKg - steps * s));
}

/**
 * Zakresy: low-rep (siła) dostaje przestrzeń 3–4, 2–3, 1–2
 * zamiast sztywnego 4–4 / 3–3.
 */
export function resolveRepRange(
  targetReps: number | null | undefined,
): RepRange | null {
  if (targetReps == null || !Number.isFinite(targetReps) || targetReps <= 0) {
    return null;
  }
  const max = Math.max(1, Math.min(99, Math.round(targetReps)));
  if (max <= 1) return { min: 1, max: 1 };
  if (max === 2) return { min: 1, max: 2 };
  if (max === 3) return { min: 2, max: 3 };
  if (max === 4) return { min: 3, max: 4 };
  // Klasyczny zakres hipertroficzny ma szerokość 3 (np. 9–12), nie 2.
  return { min: Math.max(1, max - (max >= 12 ? 3 : 2)), max };
}

export function formatRepRangeLabel(range: RepRange): string {
  if (range.min === range.max) return String(range.max);
  return `${range.min}-${range.max}`;
}

export function formatLastSetLine(last: LastSetSnapshot): string | null {
  const w = Number(last.weight) || 0;
  const r =
    last.reps != null && Number.isFinite(last.reps) && last.reps > 0
      ? Math.round(last.reps)
      : null;
  if (w <= 0 && r == null) return null;
  if (w > 0 && r != null) return `Ostatnio ${formatKgPl(w)} kg × ${r}`;
  if (w > 0) return `Ostatnio ${formatKgPl(w)} kg`;
  return `Ostatnio ${r} powt.`;
}

function buildSuggestion(args: {
  weightKg: number;
  reps: number;
  deltaKg: number;
  kind: "weight" | "reps";
  reason: string;
  rule?: string;
}): SetProgressionSuggestion {
  const highlight = `${formatKgPl(args.weightKg)} kg × ${args.reps}`;
  const suffixParts: string[] = [];
  if (args.kind === "weight" && args.deltaKg > 0) {
    suffixParts.push(`+${formatKgPl(args.deltaKg)} kg`);
  }
  if (args.kind === "reps") {
    suffixParts.push("więcej powtórzeń");
  }
  suffixParts.push(`bo ${args.reason}`);
  const suffix = ` · ${suffixParts.join(", ")}`;
  return {
    prefix: "Dziś spróbuj ",
    highlight,
    suffix,
    fullText: `Dziś spróbuj ${highlight}${suffix}`,
    weightKg: args.weightKg,
    reps: args.reps,
    deltaKg: args.deltaKg,
    kind: args.kind,
    reason: args.reason,
    rule: args.rule,
  };
}

export function countTrailingEasySets(
  sets: LastSetSnapshot[],
  ctx?: EffortContext,
): number {
  let n = 0;
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (
      s.reps == null ||
      !Number.isFinite(s.reps) ||
      s.reps < 1 ||
      !isEasyEffort(s, ctx)
    ) {
      break;
    }
    n += 1;
  }
  return n;
}

export type SessionTrend = {
  bestReps: number;
  avgReps: number;
  repsDrop: number;
  setCount: number;
};

export function analyzeSessionTrend(sets: LastSetSnapshot[]): SessionTrend | null {
  const reps = sets
    .map((s) =>
      s.reps != null && Number.isFinite(s.reps) && s.reps > 0
        ? Math.round(s.reps)
        : null,
    )
    .filter((r): r is number => r != null);
  if (reps.length === 0) return null;
  const bestReps = Math.max(...reps);
  const avgReps = reps.reduce((a, b) => a + b, 0) / reps.length;
  const repsDrop = Math.max(0, reps[0]! - reps[reps.length - 1]!);
  return { bestReps, avgReps, repsDrop, setCount: sets.length };
}

/** Skrót sesji historycznej potrzebny do progresji „z samych powtórzeń”. */
export type RepsOnlySessionSnap = {
  topKg: number;
  /** Najmniej powtórzeń w seriach roboczych na ciężarze top (≥98% topu). */
  minRepsAtTop?: number;
  /** Liczba serii roboczych na ciężarze top. */
  setsAtTop?: number;
  /**
   * Czy w tej sesji wpisano realny RIR/RPE do serii roboczych
   * (RIR równy domyślnemu celowi z planu nie liczy się jako wpis).
   */
  effortLogged?: boolean;
};

const REPS_ONLY_WEIGHT_TOLERANCE = 0.02;
const REPS_ONLY_MIN_SETS = 2;

/**
 * Progresja bez realnie logowanego RIR/RPE: ostatnie `REPS_ONLY_SESSIONS_REQUIRED` treningi miały
 * wszystkie serie robocze (≥ 2) na górze zakresu przy tym samym ciężarze,
 * a użytkownik nie loguje wysiłku. Sesje: od najnowszej.
 */
export function qualifiesRepsOnlyBump(
  sessionsNewestFirst: RepsOnlySessionSnap[] | null | undefined,
  range: RepRange | null,
): boolean {
  if (!range || !sessionsNewestFirst) return false;
  if (sessionsNewestFirst.length < REPS_ONLY_SESSIONS_REQUIRED) return false;
  const recent = sessionsNewestFirst.slice(0, REPS_ONLY_SESSIONS_REQUIRED);
  const newestTop = recent[0]!.topKg;
  if (!Number.isFinite(newestTop) || newestTop <= 0) return false;
  for (const s of recent) {
    if (s.effortLogged) return false;
    if ((s.setsAtTop ?? 0) < REPS_ONLY_MIN_SETS) return false;
    if ((s.minRepsAtTop ?? 0) < range.max) return false;
    if (Math.abs(s.topKg - newestTop) > newestTop * REPS_ONLY_WEIGHT_TOLERANCE) {
      return false;
    }
  }
  return true;
}

export type BuildProgressionArgs = {
  last: LastSetSnapshot | null | undefined;
  targetReps?: number | null;
  /** Serie przed `last` (ta sama sesja / historia). */
  priorSets?: LastSetSnapshot[];
  movementKind?: MovementKind;
  exerciseName?: string;
  categoryId?: string | null;
  /** Cel RIR z planu (ma pierwszeństwo przed profilem ruchu). */
  targetRir?: number | null;
  /** Gotowy kontekst wysiłku (gdy caller już go policzył). */
  effortContext?: EffortContext;
  /** Krok ciężaru ćwiczenia / sprzętu; domyślnie z nazwy ćwiczenia. */
  weightStep?: WeightStep;
  /** Jawny krok ćwiczenia (kg) — gdy brak `weightStep`. */
  weightStepKg?: number | null;
  /**
   * Historia pozwala na +kg z samych powtórzeń (`qualifiesRepsOnlyBump`):
   * 2 treningi ze wszystkimi seriami na górze zakresu, bez realnie
   * zalogowanego RIR/RPE. Twarda seria i konflikt nadal blokują dokładkę.
   */
  repsOnlyBumpOk?: boolean;
  setIndex?: number;
  sessionVolumeKg?: number;
  daysSinceLastSession?: number | null;
  stagnant?: boolean;
  avgRecentTopWeightKg?: number | null;
  /**
   * Gdy true — zwraca też deload jako kind=reps z niższym ciężarem
   * (live coach używa osobnych tipów; chipy wolą null + hold).
   */
  includeDeload?: boolean;
  /** Autoregulated bump (v3); domyślnie = krok ćwiczenia. */
  plateStepKg?: number;
  /** Przerwa przed ostatnią serią — rest-aware fatigue drop. */
  restSeconds?: number | null;
  /** 0–1+ z rest-awareness; domyślnie 1. */
  fatigueDropSensitivity?: number;
};

const LAYOFF_DAYS = 14;
const HIGH_VOLUME_SETS_FACTOR = 2.5;

/** Wysoka objętość w sesji / od 4. serii — nie dokładamy ciężaru. */
export function isHighSessionVolume(
  volumeKg: number | undefined,
  weightKg: number,
  targetReps: number | null | undefined,
  setIndex: number,
): boolean {
  // Od 5. serii — przy planach 4-seriowych nie blokujemy dokładki na ostatniej serii.
  if (setIndex >= 4) return true;
  if (volumeKg == null || !Number.isFinite(volumeKg) || volumeKg <= 0) {
    return false;
  }
  const midReps =
    targetReps != null && Number.isFinite(targetReps)
      ? Math.max(1, targetReps)
      : 8;
  return volumeKg >= weightKg * midReps * HIGH_VOLUME_SETS_FACTOR;
}

/**
 * Buduje propozycję „Dziś spróbuj…”, gdy warto zwiększyć ciężar lub powtórzenia.
 * Hold / konflikt / „za mało easy” → null (caller pokazuje hold).
 */
export function buildSetProgressionSuggestion(
  args: BuildProgressionArgs,
): SetProgressionSuggestion | null {
  const last = args.last;
  if (!last) return null;
  const weight = Math.max(0, Number(last.weight) || 0);
  if (weight <= 0) return null;
  const reps =
    last.reps != null && Number.isFinite(last.reps) && last.reps > 0
      ? Math.round(last.reps)
      : null;
  if (reps == null) return null;

  const kind =
    args.movementKind ??
    inferMovementKind(args.exerciseName ?? "", args.categoryId);
  const easyNeeded = easySetsRequiredForWeightBump(kind);
  const range = resolveRepRange(args.targetReps);
  const effortCtx =
    args.effortContext ??
    resolveEffortContext(
      args.exerciseName ?? "",
      args.categoryId,
      args.targetRir,
    );
  const step =
    args.weightStep ??
    resolveWeightStep({
      name: args.exerciseName,
      explicitStepKg: args.weightStepKg,
    });
  const effort = classifyEffort(last, effortCtx);
  const setIndex = args.setIndex ?? 0;
  const prior = args.priorSets ?? [];
  const trail = [...prior, last];
  const trailingEasy = countTrailingEasySets(trail, effortCtx);
  const trend = analyzeSessionTrend(trail);
  const highVol = isHighSessionVolume(
    args.sessionVolumeKg,
    weight,
    args.targetReps,
    setIndex,
  );

  if (effort === "conflict") return null;

  // Layoff / stagnacja — deload tylko gdy includeDeload (live coach ma własne tipy)
  if (
    args.includeDeload &&
    setIndex === 0 &&
    args.daysSinceLastSession != null &&
    args.daysSinceLastSession >= LAYOFF_DAYS
  ) {
    const base =
      args.avgRecentTopWeightKg != null &&
      Number.isFinite(args.avgRecentTopWeightKg) &&
      args.avgRecentTopWeightKg > 0
        ? args.avgRecentTopWeightKg
        : weight;
    const nextW = applyDeload(base, step.stepKg);
    if (nextW < weight) {
      return buildSuggestion({
        weightKg: nextW,
        reps: range?.min ?? Math.max(1, reps - 1),
        deltaKg: 0,
        kind: "reps",
        reason: "długa przerwa — zejdź z ciężarem",
        rule: "layoff_reduce",
      });
    }
  }

  if (args.includeDeload && args.stagnant && setIndex === 0) {
    // Compound po stagnacji schodzi głębiej (10%) niż izolacja (5%).
    const nextW = applyDeload(
      weight,
      step.stepKg,
      kind === "isolation" ? DELOAD_PCT : STAGNATION_COMPOUND_DELOAD_PCT,
    );
    if (nextW < weight) {
      return buildSuggestion({
        weightKg: nextW,
        reps: range?.min ?? reps,
        deltaKg: 0,
        kind: "reps",
        reason: "stagnacja — deload i reset zakresu",
        rule: "stagnation_deload",
      });
    }
  }

  // Spadek powtórzeń między seriami → nie bumpuj (rest-aware)
  const dropSens =
    args.fatigueDropSensitivity != null &&
    Number.isFinite(args.fatigueDropSensitivity)
      ? args.fatigueDropSensitivity
      : 1;
  const effectiveDrop =
    trend && trend.setCount >= 2 ? trend.repsDrop * dropSens : 0;
  if (effectiveDrop >= 2 && setIndex >= 1) {
    return null;
  }

  if (effort === "hard" || isHardEffort(last, effortCtx)) {
    if (args.includeDeload) {
      const nextW = applyDeload(weight, step.stepKg);
      if (nextW < weight) {
        return buildSuggestion({
          weightKg: nextW,
          reps: range?.min ?? Math.max(1, reps - 1),
          deltaKg: 0,
          kind: "reps",
          reason: "ostatnio było na styk — zejdź i domknij czysto",
          rule: "below_range_or_hard",
        });
      }
    }
    if (range && reps < range.max) {
      const nextReps = Math.min(range.max, reps + 1);
      if (nextReps > reps) {
        return buildSuggestion({
          weightKg: weight,
          reps: nextReps,
          deltaKg: 0,
          kind: "reps",
          reason: "ostatnio było na styk — najpierw domknij zakres",
          rule: "in_range_add_reps",
        });
      }
    }
    return null;
  }

  if (!range) return null;

  if (reps < range.min) {
    // Poniżej dolnej granicy na pierwszej serii ciężar jest za duży — zejdź o krok.
    if (args.includeDeload && setIndex === 0) {
      const lighter = round2(weight - step.stepKg);
      if (lighter > 0) {
        return buildSuggestion({
          weightKg: lighter,
          reps: range.min,
          deltaKg: 0,
          kind: "reps",
          reason: "ostatnio poniżej zakresu — zejdź o krok i domknij zakres",
          rule: "below_range_or_hard",
        });
      }
    }
    return null;
  }

  // W zakresie poniżej max → zawsze +reps (nigdy +kg / easy_anywhere)
  if (reps < range.max) {
    if (kind === "isolation" && effort === "warn") return null;
    const nextReps = Math.min(range.max, reps + 1);
    if (nextReps <= reps) return null;
    return buildSuggestion({
      weightKg: weight,
      reps: nextReps,
      deltaKg: 0,
      kind: "reps",
      reason:
        reps <= range.min
          ? "ostatnio był dół zakresu"
          : "ostatnio było poniżej góry zakresu",
      rule: "in_range_add_reps",
    });
  }

  // Na górze zakresu — +kg po N łatwych z rzędu (RIR ≥ 2) albo, bez danych
  // o wysiłku, po 2 treningach ze wszystkimi seriami na górze zakresu.
  if (reps >= range.max) {
    if (highVol) return null;
    const effortOk = isEasyEffort(last, effortCtx) && trailingEasy >= easyNeeded;
    // RIR w sesji bywa tylko domyślnym celem z planu — caller (historia sesji)
    // ręczuje, że wysiłek nie był realnie logowany (`qualifiesRepsOnlyBump`).
    const repsOnlyOk = args.repsOnlyBumpOk === true;
    if (!effortOk && !repsOnlyOk) return null;
    const bumpStep =
      args.plateStepKg != null &&
      Number.isFinite(args.plateStepKg) &&
      args.plateStepKg > 0
        ? args.plateStepKg
        : step.stepKg;
    const nextW = bumpWeightByPlate(weight, bumpStep);
    if (nextW <= weight) return null;
    return buildSuggestion({
      weightKg: nextW,
      reps: range.min,
      deltaKg: round2(nextW - weight),
      kind: "weight",
      reason: effortOk
        ? "góra zakresu po kolejnych łatwych seriach"
        : "wszystkie serie na górze zakresu przez 2 treningi",
      rule: effortOk ? "top_of_range_easy" : "top_of_range_reps_only",
    });
  }

  return null;
}

/** Ciężar do chipa / placeholder — z progresji albo bez zmian. */
export function suggestedWeightFromProgression(
  args: Omit<
    BuildProgressionArgs,
    | "includeDeload"
    | "stagnant"
    | "daysSinceLastSession"
    | "avgRecentTopWeightKg"
    | "plateStepKg"
    | "restSeconds"
    | "fatigueDropSensitivity"
  >,
): number | null {
  const suggestion = buildSetProgressionSuggestion(args);
  if (suggestion) return suggestion.weightKg;
  const last = args.last;
  if (!last) return null;
  const w = Math.max(0, Number(last.weight) || 0);
  // Hold: zachowaj ciężar roboczy (bez zaokrąglania do pełnych talerzy: 36 → 35).
  return w > 0 ? roundHoldKg(w) : null;
}

export { classifyEffort, isEasyEffort, isHardEffort };
