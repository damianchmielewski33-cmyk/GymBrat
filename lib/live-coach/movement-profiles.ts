/**
 * Profile RIR per wzorzec ruchu — zamiast jednego DEFAULT_TARGET_RIR.
 */

import type { MovementProfile } from "@/lib/live-coach/types";
import type { EffortContext } from "@/lib/set-effort";

function norm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

type Rule = {
  id: string;
  re: RegExp;
  targetRirMin: number;
  targetRirMax: number;
  label: string;
};

const RULES: Rule[] = [
  {
    id: "deadlift",
    re: /deadlift|martwy|rdl|good.?morning|hinge/,
    targetRirMin: 2,
    targetRirMax: 3,
    label: "Deadlift / hinge",
  },
  {
    id: "squat",
    re: /squat|przysiad|front.?squat|hack.?squat|leg.?press/,
    targetRirMin: 1,
    targetRirMax: 2,
    label: "Squat pattern",
  },
  {
    id: "bench",
    re: /bench|wyciskan.*plask|wyciskan.*poziom|flat.?press|wyciskanie sztang/,
    targetRirMin: 1,
    targetRirMax: 1,
    label: "Bench",
  },
  {
    id: "machine_press",
    re: /machine|maszyn|smith|pec.?deck|chest.?press|shoulder.?press.*maszyn|wyciskan.*maszyn/,
    targetRirMin: 1,
    targetRirMax: 1,
    label: "Machine press",
  },
  {
    id: "ohp",
    re: /ohp|overhead|wyciskan.*nad|military|push.?press/,
    targetRirMin: 1,
    targetRirMax: 2,
    label: "Overhead press",
  },
  {
    id: "row_pull",
    re: /row|wioslow|pull.?up|chin.?up|podciagani|lat.?pulldown|ściagani/,
    targetRirMin: 1,
    targetRirMax: 2,
    label: "Row / pull",
  },
  {
    id: "biceps",
    re: /curl|uginani|bicep|preach|concentration/,
    targetRirMin: 0,
    targetRirMax: 1,
    label: "Biceps curl",
  },
  {
    id: "triceps",
    re: /triceps|prostowan|kickback|skull|francuz|pushdown/,
    targetRirMin: 0,
    targetRirMax: 1,
    label: "Triceps",
  },
  {
    id: "calves",
    re: /calf|lydk|wypychani.*lydek/,
    targetRirMin: 0,
    targetRirMax: 0,
    label: "Calves",
  },
  {
    id: "isolation_misc",
    re: /fly|rozpietk|lateral|wznos|shrug|crunch|plank|leg.?curl|leg.?extension|abduct|adduct/,
    targetRirMin: 0,
    targetRirMax: 1,
    label: "Isolation",
  },
];

const CATEGORY_FALLBACK: Record<
  string,
  { min: number; max: number; id: string; label: string }
> = {
  calves: { min: 0, max: 0, id: "calves", label: "Calves" },
  biceps: { min: 0, max: 1, id: "biceps", label: "Biceps" },
  triceps: { min: 0, max: 1, id: "triceps", label: "Triceps" },
  forearms: { min: 0, max: 1, id: "forearms", label: "Forearms" },
  core: { min: 0, max: 1, id: "core", label: "Core" },
  quads: { min: 1, max: 2, id: "squat", label: "Quads" },
  hamstrings: { min: 2, max: 3, id: "hinge", label: "Hamstrings" },
  glutes: { min: 1, max: 2, id: "hinge", label: "Glutes" },
  chest: { min: 1, max: 1, id: "press", label: "Chest" },
  shoulders: { min: 1, max: 2, id: "ohp", label: "Shoulders" },
  back_upper: { min: 1, max: 2, id: "pull", label: "Back" },
  back_mid: { min: 1, max: 2, id: "pull", label: "Back" },
  back_lower: { min: 2, max: 3, id: "hinge", label: "Lower back" },
};

function toProfile(
  id: string,
  min: number,
  max: number,
  label: string,
): MovementProfile {
  const targetRir = Math.round((min + max) / 2);
  return {
    id,
    targetRirMin: min,
    targetRirMax: max,
    targetRir,
    label,
  };
}

const DEFAULT_PROFILE = toProfile("default", 1, 2, "Default");

export function resolveMovementProfile(
  name: string,
  categoryId?: string | null,
): MovementProfile {
  const n = norm(name);
  for (const rule of RULES) {
    if (rule.re.test(n)) {
      return toProfile(
        rule.id,
        rule.targetRirMin,
        rule.targetRirMax,
        rule.label,
      );
    }
  }
  const cat = (categoryId ?? "").trim();
  if (cat && CATEGORY_FALLBACK[cat]) {
    const f = CATEGORY_FALLBACK[cat]!;
    return toProfile(f.id, f.min, f.max, f.label);
  }
  return DEFAULT_PROFILE;
}

/**
 * Kontekst klasyfikacji wysiłku: najmniejszy zapas zgodny z celem ruchu.
 * Bazą jest profil ruchu (biceps/łydki = 0, bench = 1, martwy ciąg = 2);
 * cel z planu może ją tylko obniżyć (plan „RIR 0” = trening do upadku).
 * Plan bez własnego RIR dostaje w sesji domyślne 1, więc nie może
 * podnosić progu ponad profil.
 */
export function resolveEffortContext(
  name: string,
  categoryId?: string | null,
  planTargetRir?: number | null,
): EffortContext {
  const profileMin = resolveMovementProfile(name, categoryId).targetRirMin;
  if (
    planTargetRir != null &&
    Number.isFinite(planTargetRir) &&
    planTargetRir >= 0
  ) {
    const plan = Math.max(0, Math.min(5, Math.round(planTargetRir)));
    return { targetRirMin: Math.min(plan, profileMin) };
  }
  return { targetRirMin: profileMin };
}

/** targetRir z planu ma pierwszeństwo; inaczej profil ruchu. */
export function resolveEffectiveTargetRir(
  planTargetRir: number | null | undefined,
  name: string,
  categoryId?: string | null,
): number {
  if (
    planTargetRir != null &&
    Number.isFinite(planTargetRir) &&
    planTargetRir >= 0
  ) {
    return Math.max(0, Math.min(5, Math.round(planTargetRir)));
  }
  return resolveMovementProfile(name, categoryId).targetRir;
}
