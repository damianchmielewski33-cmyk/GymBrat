/**
 * Agregacja RPE / RIR / tempo z ukończonych serii.
 * Tempo to cel z planu (nie pomiar wykonania).
 */

export type IntensitySetInput = {
  done?: boolean;
  skipped?: boolean;
  rir?: number | null;
  rpe?: number | null;
};

export type IntensityExerciseInput = {
  sets?: IntensitySetInput[] | null;
  targetRir?: number | null;
  tempo?: string | null;
};

export type SessionIntensity = {
  avgRir: number | null;
  avgRpe: number | null;
  setsWithRir: number;
  setsWithRpe: number;
  hardSets: number;
  scoredSets: number;
  /** Ćwiczenia z RIR i targetem: on / harder / easier */
  targetOn: number;
  targetHarder: number;
  targetEasier: number;
  targetCompared: number;
  tempos: string[];
  exercisesWithTempo: number;
  exercisesScored: number;
};

export type RirVsTarget = "on" | "harder" | "easier";

export type VolumeTrendKind = "up" | "flat" | "down";

function optionalRir(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function optionalRpe(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return safeRound1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Seria zaliczona do analizy intensywności (wykonana, nie pominięta). */
export function isIntensityEligibleSet(s: IntensitySetInput): boolean {
  return Boolean(s.done) && !Boolean(s.skipped);
}

export function isHardSet(input: {
  rir: number | null;
  rpe: number | null;
}): boolean {
  return (
    (input.rir != null && input.rir <= 1) ||
    (input.rpe != null && input.rpe >= 8)
  );
}

/**
 * Porównanie średniego RIR z celem planu.
 * Niższy RIR = trudniej (mniej zapasu).
 */
export function compareRirToTarget(
  avgRir: number,
  targetRir: number,
  tolerance = 0.75,
): RirVsTarget {
  const delta = avgRir - targetRir;
  if (delta <= -tolerance) return "harder";
  if (delta >= tolerance) return "easier";
  return "on";
}

export function rirTrendOf(prev: number, next: number): VolumeTrendKind {
  // Wyższy RIR = więcej zapasu = lżej → "up" w skali RIR
  const delta = next - prev;
  if (delta >= 0.4) return "up";
  if (delta <= -0.4) return "down";
  return "flat";
}

export function summarizeExerciseIntensity(ex: IntensityExerciseInput): {
  avgRir: number | null;
  avgRpe: number | null;
  setsWithRir: number;
  setsWithRpe: number;
  hardSets: number;
  scoredSets: number;
  targetRir: number | null;
  rirVsTarget: RirVsTarget | null;
  tempo: string | null;
} {
  const rirs: number[] = [];
  const rpes: number[] = [];
  let hardSets = 0;
  let scoredSets = 0;

  for (const s of ex.sets ?? []) {
    if (!isIntensityEligibleSet(s)) continue;
    scoredSets += 1;
    const rir = optionalRir(s.rir);
    const rpe = optionalRpe(s.rpe);
    if (rir != null) rirs.push(rir);
    if (rpe != null) rpes.push(rpe);
    if (isHardSet({ rir, rpe })) hardSets += 1;
  }

  const avgRir = avg(rirs);
  const avgRpe = avg(rpes);
  const targetRir = optionalRir(ex.targetRir);
  const tempo =
    typeof ex.tempo === "string" && ex.tempo.trim()
      ? ex.tempo.trim().slice(0, 16)
      : null;

  return {
    avgRir,
    avgRpe,
    setsWithRir: rirs.length,
    setsWithRpe: rpes.length,
    hardSets,
    scoredSets,
    targetRir,
    rirVsTarget:
      avgRir != null && targetRir != null
        ? compareRirToTarget(avgRir, targetRir)
        : null,
    tempo,
  };
}

export function summarizeSessionIntensity(
  exercises: ReadonlyArray<IntensityExerciseInput>,
): SessionIntensity {
  const rawRirs: number[] = [];
  const rawRpes: number[] = [];
  let hardSets = 0;
  let scoredSets = 0;
  let targetOn = 0;
  let targetHarder = 0;
  let targetEasier = 0;
  let targetCompared = 0;
  const tempos = new Set<string>();
  let exercisesWithTempo = 0;
  let exercisesScored = 0;

  for (const ex of exercises) {
    const summary = summarizeExerciseIntensity(ex);
    if (summary.scoredSets <= 0) continue;
    exercisesScored += 1;
    if (summary.tempo) {
      tempos.add(summary.tempo);
      exercisesWithTempo += 1;
    }
    if (summary.rirVsTarget) {
      targetCompared += 1;
      if (summary.rirVsTarget === "on") targetOn += 1;
      else if (summary.rirVsTarget === "harder") targetHarder += 1;
      else targetEasier += 1;
    }

    for (const s of ex.sets ?? []) {
      if (!isIntensityEligibleSet(s)) continue;
      scoredSets += 1;
      const rir = optionalRir(s.rir);
      const rpe = optionalRpe(s.rpe);
      if (rir != null) rawRirs.push(rir);
      if (rpe != null) rawRpes.push(rpe);
      if (isHardSet({ rir, rpe })) hardSets += 1;
    }
  }

  return {
    avgRir: avg(rawRirs),
    avgRpe: avg(rawRpes),
    setsWithRir: rawRirs.length,
    setsWithRpe: rawRpes.length,
    hardSets,
    scoredSets,
    targetOn,
    targetHarder,
    targetEasier,
    targetCompared,
    tempos: [...tempos].slice(0, 8),
    exercisesWithTempo,
    exercisesScored,
  };
}

export type ProgressIntensitySummary = {
  avgRir: number | null;
  avgRpe: number | null;
  rirSpark: number[];
  rpeSpark: number[];
  hardSetPct: number | null;
  setsWithRir: number;
  setsWithRpe: number;
  targetHitPct: number | null;
  targetComparedCount: number;
  harderThanPlanCount: number;
  easierThanPlanCount: number;
  temposUsed: string[];
  tempoExercisePct: number | null;
  sessionsWithIntensity: number;
  rirTrend: VolumeTrendKind | null;
};

export function buildProgressIntensitySummary(
  sessionsNewestLast: ReadonlyArray<SessionIntensity>,
): ProgressIntensitySummary {
  const withAny = sessionsNewestLast.filter(
    (s) => s.setsWithRir > 0 || s.setsWithRpe > 0,
  );
  const last6 = sessionsNewestLast.slice(-6);

  const rirSpark = last6
    .map((s) => s.avgRir)
    .filter((v): v is number => v != null);
  const rpeSpark = last6
    .map((s) => s.avgRpe)
    .filter((v): v is number => v != null);

  let setsWithRir = 0;
  let setsWithRpe = 0;
  let hardSets = 0;
  let scoredSets = 0;
  let targetOn = 0;
  let targetHarder = 0;
  let targetEasier = 0;
  let targetCompared = 0;
  let exercisesWithTempo = 0;
  let exercisesScored = 0;
  const tempos = new Set<string>();
  const rirs: number[] = [];
  const rpes: number[] = [];

  for (const s of last6) {
    setsWithRir += s.setsWithRir;
    setsWithRpe += s.setsWithRpe;
    hardSets += s.hardSets;
    scoredSets += s.scoredSets;
    targetOn += s.targetOn;
    targetHarder += s.targetHarder;
    targetEasier += s.targetEasier;
    targetCompared += s.targetCompared;
    exercisesWithTempo += s.exercisesWithTempo;
    exercisesScored += s.exercisesScored;
    for (const t of s.tempos) tempos.add(t);
    if (s.avgRir != null) rirs.push(s.avgRir);
    if (s.avgRpe != null) rpes.push(s.avgRpe);
  }

  const rirTrend =
    rirSpark.length >= 2
      ? rirTrendOf(rirSpark[rirSpark.length - 2]!, rirSpark[rirSpark.length - 1]!)
      : null;

  return {
    avgRir: avg(rirs),
    avgRpe: avg(rpes),
    rirSpark,
    rpeSpark,
    hardSetPct:
      scoredSets > 0 ? Math.round((hardSets / scoredSets) * 100) : null,
    setsWithRir,
    setsWithRpe,
    targetHitPct:
      targetCompared > 0
        ? Math.round((targetOn / targetCompared) * 100)
        : null,
    targetComparedCount: targetCompared,
    harderThanPlanCount: targetHarder,
    easierThanPlanCount: targetEasier,
    temposUsed: [...tempos].slice(0, 6),
    tempoExercisePct:
      exercisesScored > 0
        ? Math.round((exercisesWithTempo / exercisesScored) * 100)
        : null,
    sessionsWithIntensity: withAny.length,
    rirTrend,
  };
}
