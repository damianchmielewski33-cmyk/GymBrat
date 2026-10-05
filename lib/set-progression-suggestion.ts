/**
 * Sugestia progresji serii (double progression) — teksty jak w makiecie sesji.
 * Pokazuj tylko gdy warto zwiększyć ciężar albo powtórzenia względem ostatniego treningu.
 */

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
};

const PLATE_STEP = 2.5;

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

/** +2,5 kg z precyzją 0,5 (jak steppers w sesji) — bez cofania 38,5 → 37,5. */
export function bumpWeightByPlate(kg: number, step = PLATE_STEP): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round((kg + step) * 2) / 2;
}

/**
 * Zakres powtórzeń z planu: `targetReps` traktujemy jako górę zakresu
 * (np. 10 → 8–10), szerokość 2 gdy cel ≥ 5.
 */
export function resolveRepRange(
  targetReps: number | null | undefined,
): RepRange | null {
  if (targetReps == null || !Number.isFinite(targetReps) || targetReps <= 0) {
    return null;
  }
  const max = Math.max(1, Math.min(99, Math.round(targetReps)));
  const min = max >= 5 ? Math.max(1, max - 2) : max;
  return { min, max };
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

function isHardSet(last: LastSetSnapshot): boolean {
  return (
    (last.rir != null && Number.isFinite(last.rir) && last.rir <= 1) ||
    (last.rpe != null && Number.isFinite(last.rpe) && last.rpe >= 8)
  );
}

function isEasySet(last: LastSetSnapshot): boolean {
  return (
    (last.rir != null && Number.isFinite(last.rir) && last.rir >= 3) ||
    (last.rpe != null && Number.isFinite(last.rpe) && last.rpe > 0 && last.rpe <= 6)
  );
}

function buildSuggestion(args: {
  weightKg: number;
  reps: number;
  deltaKg: number;
  kind: "weight" | "reps";
  reason: string;
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
  };
}

/**
 * Buduje propozycję „Dziś spróbuj…”, gdy warto zwiększyć ciężar lub powtórzenia.
 * Zwraca `null`, gdy brak historii albo brak sensu progresji.
 */
export function buildSetProgressionSuggestion(args: {
  last: LastSetSnapshot | null | undefined;
  targetReps?: number | null;
}): SetProgressionSuggestion | null {
  const last = args.last;
  if (!last) return null;
  const weight = Math.max(0, Number(last.weight) || 0);
  if (weight <= 0) return null;
  const reps =
    last.reps != null && Number.isFinite(last.reps) && last.reps > 0
      ? Math.round(last.reps)
      : null;
  if (reps == null) return null;

  const range = resolveRepRange(args.targetReps);
  const hard = isHardSet(last);
  const easy = isEasySet(last);

  // Góra zakresu → +ciężar, zejdź do dołu zakresu (albo zostaw te same powt. gdy brak zakresu).
  if (range && reps >= range.max) {
    const nextW = bumpWeightByPlate(weight);
    if (nextW <= weight) return null;
    return buildSuggestion({
      weightKg: nextW,
      reps: range.min,
      deltaKg: nextW - weight,
      kind: "weight",
      reason: "ostatnio była góra zakresu",
    });
  }

  // Duży zapas → też +ciężar (nawet poniżej góry).
  if (easy) {
    const nextW = bumpWeightByPlate(weight);
    if (nextW <= weight) return null;
    const nextReps = range ? Math.min(Math.max(reps, range.min), range.max) : reps;
    return buildSuggestion({
      weightKg: nextW,
      reps: nextReps,
      deltaKg: nextW - weight,
      kind: "weight",
      reason: "ostatnio był duży zapas",
    });
  }

  // W zakresie, ale poniżej góry → dobij powtórzenia przy tym samym ciężarze.
  if (range && reps < range.max) {
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
    });
  }

  // Twarda seria bez jasnego zakresu → +ciężar (jak dotychczasowa sugestia RIR).
  if (hard) {
    const nextW = bumpWeightByPlate(weight);
    if (nextW <= weight) return null;
    return buildSuggestion({
      weightKg: nextW,
      reps,
      deltaKg: nextW - weight,
      kind: "weight",
      reason: "ostatnio seria była twarda",
    });
  }

  return null;
}

/** Ciężar do chipa / placeholder — z progresji albo bez zmian. */
export function suggestedWeightFromProgression(args: {
  last: LastSetSnapshot | null | undefined;
  targetReps?: number | null;
}): number | null {
  const suggestion = buildSetProgressionSuggestion(args);
  if (suggestion) return suggestion.weightKg;
  const last = args.last;
  if (!last) return null;
  const w = Math.max(0, Number(last.weight) || 0);
  return w > 0 ? roundToPlateStep(w) : null;
}
