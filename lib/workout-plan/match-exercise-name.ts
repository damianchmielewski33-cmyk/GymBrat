import {
  normalizeForSearch,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";

export type ExerciseNameMatch = {
  exercise: CatalogExercise;
  score: number;
};

function tokens(s: string): string[] {
  return normalizeForSearch(s)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** Proste dopasowanie tokenowe / overlap — bez zewnętrznych zależności. */
export function matchExerciseName(
  query: string,
  catalog: CatalogExercise[],
  limit = 5,
): ExerciseNameMatch[] {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  const qTokens = tokens(query);
  const scored: ExerciseNameMatch[] = [];

  for (const ex of catalog) {
    const nameN = normalizeForSearch(ex.name);
    const aliasNs = (ex.aliasesEn ?? []).map((a) => normalizeForSearch(a));
    let score = 0;
    if (nameN === q || aliasNs.includes(q)) score = 100;
    else if (aliasNs.some((a) => a === q || a.includes(q) || q.includes(a))) {
      score = 92;
    } else if (nameN.includes(q) || q.includes(nameN)) score = 80;
    else {
      const nameTokens = new Set(tokens(ex.name));
      for (const a of ex.aliasesEn ?? []) {
        for (const t of tokens(a)) nameTokens.add(t);
      }
      let hit = 0;
      for (const t of qTokens) {
        if (nameTokens.has(t)) hit += 1;
      }
      if (hit === 0) continue;
      score = Math.round((hit / Math.max(qTokens.length, 1)) * 70);
    }
    if (score > 0) scored.push({ exercise: ex, score });
  }

  scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "pl"));
  return scored.slice(0, limit);
}

export function bestExerciseNameMatch(
  query: string,
  catalog: CatalogExercise[],
): ExerciseNameMatch | null {
  const [best, second] = matchExerciseName(query, catalog, 2);
  if (!best) return null;
  if (best.score < 60) return null;
  if (second && second.score >= best.score - 5 && best.score < 92) return null;
  return best;
}
