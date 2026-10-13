/**
 * Heurystyka: ćwiczenie wielostawowe vs izolowane — osobne reguły progresji.
 */

export type MovementKind = "compound" | "isolation";

const ISOLATION_CATEGORIES = new Set([
  "biceps",
  "triceps",
  "forearms",
  "calves",
  "core",
]);

const COMPOUND_CATEGORIES = new Set([
  "chest",
  "back_upper",
  "back_mid",
  "back_lower",
  "quads",
  "glutes",
  "hamstrings",
  "shoulders",
]);

function norm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

const ISOLATION_NAME_RE =
  /fly|rozpietk|curl|uginani|prostowan|lateral|wznos|kickback|pec.?deck|face.?pull|shrug|lydk|calf|crunch|plank|leg.?extension|leg.?curl|concentration|preach|francuz|skull|triceps.?push|bicep|forearm|wrist|hip.?abduct|hip.?adduct/i;

const COMPOUND_NAME_RE =
  /squat|przysiad|deadlift|martwy|bench|wyciskan|row|wioslow|ohp|overhead|pull.?up|chin.?up|dip|thrust|hip.?thrust|rdl|good.?morning|lung|wypad|clean|snatch|press|podciagani|przysiady/i;

/**
 * Izolacja: mniejsze / wolniejsze dokładki; compound: klasyczna double progression.
 */
export function inferMovementKind(
  name: string,
  categoryId?: string | null,
): MovementKind {
  const cat = (categoryId ?? "").trim();
  if (cat && ISOLATION_CATEGORIES.has(cat)) return "isolation";

  const n = norm(name);
  if (!n) {
    if (cat && COMPOUND_CATEGORIES.has(cat)) return "compound";
    return "compound";
  }
  if (ISOLATION_NAME_RE.test(n)) return "isolation";
  if (COMPOUND_NAME_RE.test(n)) return "compound";
  if (cat && COMPOUND_CATEGORIES.has(cat)) return "compound";
  return "compound";
}

/** Minimalna liczba łatwych serii z rzędu przed +kg. */
export function easySetsRequiredForWeightBump(kind: MovementKind): number {
  return kind === "isolation" ? 3 : 2;
}
