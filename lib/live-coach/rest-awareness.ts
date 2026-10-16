/**
 * Rest awareness — jak mocno interpretować spadek powtórzeń / zmęczenie.
 */

/** 0–1: niższa wartość = mniej „karzemy” za repsDrop. */
export function fatigueDropSensitivityFromRest(
  restSeconds: number | null | undefined,
): number {
  if (restSeconds == null || !Number.isFinite(restSeconds) || restSeconds < 0) {
    return 1; // brak danych → normalna interpretacja
  }
  if (restSeconds < 60) return 0.35;
  if (restSeconds <= 90) return 0.7;
  if (restSeconds <= 180) return 1;
  if (restSeconds <= 240) return 0.85;
  // >240s — oczekujemy lepszego utrzymania; spadek jest bardziej znaczący
  return 1.15;
}

export function shouldIgnoreFatigueDrop(args: {
  repsDrop: number;
  restSeconds?: number | null;
  setIndex: number;
}): boolean {
  if (args.setIndex < 1) return true;
  if (args.repsDrop < 2) return true;
  const sens = fatigueDropSensitivityFromRest(args.restSeconds);
  // Krótka przerwa: wymagaj większego dropu (efektywnie ignoruj drop=2)
  if (sens < 0.5 && args.repsDrop < 4) return true;
  if (sens < 0.8 && args.repsDrop < 3) return true;
  return false;
}

export function classifyRestBucket(
  restSeconds: number | null | undefined,
): "short" | "normal" | "long" | "unknown" {
  if (restSeconds == null || !Number.isFinite(restSeconds)) return "unknown";
  if (restSeconds < 60) return "short";
  if (restSeconds <= 180) return "normal";
  return "long";
}
