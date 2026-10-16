import {
  normalizeForSearch,
  type MuscleCategory,
} from "@/lib/workout-exercise-catalog";

type MuscleRegionId = MuscleCategory["id"];

/**
 * Heurystyka PL/EN gdy katalog nie trafia — zamiast domyślnych „barki”
 * z importu PDF/Excela.
 */
const RULES: Array<{ id: MuscleRegionId; tokens: string[] }> = [
  {
    id: "quads",
    tokens: [
      "przysiad",
      "squat",
      "hack",
      "leg press",
      "wyciskanie nog",
      "wyciskanie na nog",
      "wykro",
      "lunge",
      "bulgarian",
      "goblet",
      "front squat",
      "leg extension",
      "prostowanie nog",
      "prostowanie ud",
    ],
  },
  {
    id: "hamstrings",
    tokens: [
      "martwy",
      "deadlift",
      "rdl",
      "rumun",
      "uginanie nog",
      "leg curl",
      "nordic",
      "good morning",
      "uda tyl",
      "hamstring",
      "ghd",
    ],
  },
  {
    id: "glutes",
    tokens: [
      "hip thrust",
      "poslad",
      "glute",
      "mostek",
      "kickback",
      "odwodzen",
      "frog pump",
      "pull through",
    ],
  },
  {
    id: "calves",
    tokens: ["lydk", "calf", "wspie", "donkey"],
  },
  {
    id: "chest",
    tokens: [
      "klatk",
      "chest",
      "bench",
      "lawce",
      "pompki",
      "push up",
      "push-up",
      "rozpie",
      "fly",
      "pec deck",
      "dips",
    ],
  },
  {
    id: "back_upper",
    tokens: [
      "podciag",
      "pull up",
      "pull-up",
      "chin up",
      "sciaganie",
      "lat pulldown",
      "wallown",
      "face pull",
      "shrug",
      "kaptur",
    ],
  },
  {
    id: "back_mid",
    tokens: ["wiosl", "row", "pendlay", "seal row", "remada"],
  },
  {
    id: "back_lower",
    tokens: ["ledzwi", "hyperextension", "back extension", "good morning"],
  },
  {
    id: "shoulders",
    tokens: [
      "bark",
      "shoulder",
      "ohp",
      "zolnierskie",
      "military",
      "arnold",
      "lateral raise",
      "wznosy bok",
      "wznosy przod",
      "facepull",
      "upright row",
    ],
  },
  {
    id: "biceps",
    tokens: [
      "biceps",
      "uginanie przedramion",
      "uginanie ramion",
      "curl",
      "mlotkowe",
      "hammer curl",
      "preacher",
    ],
  },
  {
    id: "triceps",
    tokens: [
      "triceps",
      "francuz",
      "skull",
      "prostowanie ramion",
      "kickback triceps",
      "pushdown",
      "wyciskanie francuskie",
    ],
  },
  {
    id: "forearms",
    tokens: ["przedramion", "forearm", "wrist", "farmer"],
  },
  {
    id: "core",
    tokens: [
      "brzuch",
      "core",
      "plank",
      "deska",
      "crunch",
      "sit up",
      "russian twist",
      "ab wheel",
      "spięcia brzucha",
      "spiecia brzucha",
    ],
  },
  {
    id: "cardio",
    tokens: ["cardio", "bieg", "rower", "rowerek", "eliptic", "skakanka", "burpee"],
  },
];

/** Domysł gdy nic nie pasuje — nie „barki” (fałszywie podświetlały całą sesję). */
export const FALLBACK_MUSCLE_CATEGORY: MuscleRegionId = "core";

export function inferMuscleCategoryFromName(
  rawName: string,
): MuscleRegionId | null {
  const q = normalizeForSearch(rawName);
  if (!q) return null;
  for (const rule of RULES) {
    if (rule.tokens.some((t) => q.includes(normalizeForSearch(t)))) {
      return rule.id;
    }
  }
  return null;
}
