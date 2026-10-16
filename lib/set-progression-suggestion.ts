/**
 * Double progression + deload % — wspólny silnik dla Live Coach i chipów.
 *
 * - Najpierw powtórzenia do range.max (bez easy_anywhere).
 * - +kg dopiero po N kolejnych łatwych seriach na górze zakresu.
 * - RIR > RPE; konflikt → brak progresji (hold).
 * - Deload: max(2.5 kg, 5% ciężaru).
 */

import {
  easySetsRequiredForWeightBump,
  inferMovementKind,
  type MovementKind,
} from "@/lib/exercise-movement-kind";
import {
  classifyEffort,
  isEasyEffort,
  isHardEffort,
} from "@/lib/set-effort";

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

const PLATE_STEP = 2.5;
const DELOAD_PCT = 0.05;

export function formatKgPl(kg: number): string {
  if (!Number.isFinite(kg)) return "0";
  const r = Math.round(kg * 10) / 10;
  if (Math.abs(r - Math.round(r)) < 0.05) return String(Math.round(r));
  return String(r).replace(".", ",");
}

export function roundToPlateStep(kg: number, step = PLATE_STEP): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

/**
 * Exact +step kg z precyzją 0,5 (jak steppers w sesji).
 * step domyślnie 2.5; v3 może podać minimum/aggressive.
 */
export function bumpWeightByPlate(kg: number, step = PLATE_STEP): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const s = Number.isFinite(step) && step > 0 ? step : PLATE_STEP;
  return Math.round((kg + s) * 2) / 2;
}

/** Deload: max(2.5 kg, 5% ciężaru roboczego). */
export function deloadDropKg(workingKg: number): number {
  if (!Number.isFinite(workingKg) || workingKg <= 0) return PLATE_STEP;
  return Math.max(PLATE_STEP, workingKg * DELOAD_PCT);
}

export function applyDeload(workingKg: number): number {
  const drop = deloadDropKg(workingKg);
  return Math.max(0, Math.round((workingKg - drop) * 2) / 2);
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
  return { min: Math.max(1, max - 2), max };
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

export function countTrailingEasySets(sets: LastSetSnapshot[]): number {
  let n = 0;
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (
      s.reps == null ||
      !Number.isFinite(s.reps) ||
      s.reps < 1 ||
      !isEasyEffort(s)
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

export type BuildProgressionArgs = {
  last: LastSetSnapshot | null | undefined;
  targetReps?: number | null;
  /** Serie przed `last` (ta sama sesja / historia). */
  priorSets?: LastSetSnapshot[];
  movementKind?: MovementKind;
  exerciseName?: string;
  categoryId?: string | null;
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
  /** Autoregulated bump (v3); domyślnie 2.5. */
  plateStepKg?: number;
  /** Przerwa przed ostatnią serią — rest-aware fatigue drop. */
  restSeconds?: number | null;
  /** 0–1+ z rest-awareness; domyślnie 1. */
  fatigueDropSensitivity?: number;
};

const LAYOFF_DAYS = 14;
const HIGH_VOLUME_SETS_FACTOR = 2.5;

function isHighSessionVolume(
  volumeKg: number | undefined,
  weightKg: number,
  targetReps: number | null | undefined,
  setIndex: number,
): boolean {
  if (setIndex >= 3) return true;
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
  const effort = classifyEffort(last);
  const setIndex = args.setIndex ?? 0;
  const prior = args.priorSets ?? [];
  const trail = [...prior, last];
  const trailingEasy = countTrailingEasySets(trail);
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
    const nextW = applyDeload(base);
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
    const nextW = applyDeload(weight);
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

  if (effort === "hard" || isHardEffort(last)) {
    if (args.includeDeload) {
      const nextW = applyDeload(weight);
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

  // Na górze zakresu — +kg tylko po N łatwych z rzędu
  if (reps >= range.max) {
    if (highVol) return null;
    if (!isEasyEffort(last) || trailingEasy < easyNeeded) return null;
    const step =
      args.plateStepKg != null &&
      Number.isFinite(args.plateStepKg) &&
      args.plateStepKg > 0
        ? args.plateStepKg
        : PLATE_STEP;
    const nextW = bumpWeightByPlate(weight, step);
    if (nextW <= weight) return null;
    return buildSuggestion({
      weightKg: nextW,
      reps: range.min,
      deltaKg: nextW - weight,
      kind: "weight",
      reason:
        trailingEasy >= easyNeeded
          ? "góra zakresu po kolejnych łatwych seriach"
          : "góra zakresu z zapasem",
      rule: "top_of_range_easy",
    });
  }

  return null;
}

/** Ciężar do chipa / placeholder — z progresji albo bez zmian. */
export function suggestedWeightFromProgression(args: {
  last: LastSetSnapshot | null | undefined;
  targetReps?: number | null;
  priorSets?: LastSetSnapshot[];
  movementKind?: MovementKind;
  exerciseName?: string;
  setIndex?: number;
  sessionVolumeKg?: number;
}): number | null {
  const suggestion = buildSetProgressionSuggestion(args);
  if (suggestion) return suggestion.weightKg;
  const last = args.last;
  if (!last) return null;
  const w = Math.max(0, Number(last.weight) || 0);
  // Hold: zachowaj ciężar roboczy (nie roundToPlateStep — 36 → 35).
  return w > 0 ? Math.round(w * 2) / 2 : null;
}

export { classifyEffort, isEasyEffort, isHardEffort };
