import type { ExercisePrs } from "@/lib/exercise-progress";
import type { FitnessGoals } from "@/lib/fitness-goals";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progressPct: number;
};

/** Kamienie milowe z PR i celów profilu. */
export function buildMilestones(input: {
  goals: FitnessGoals;
  weeklySessionsDone: number;
  exercisePrsByName: Record<string, ExercisePrs>;
}): Milestone[] {
  const out: Milestone[] = [];

  const weeklyTarget = input.goals.weeklySessionsTarget ?? 3;
  const weeklyPct = Math.min(100, Math.round((input.weeklySessionsDone / weeklyTarget) * 100));
  out.push({
    id: "weekly-sessions",
    title: `${weeklyTarget} treningi / tydzień`,
    description: `W tym tygodniu: ${input.weeklySessionsDone} / ${weeklyTarget}`,
    achieved: input.weeklySessionsDone >= weeklyTarget,
    progressPct: weeklyPct,
  });

  for (const t of input.goals.exerciseTargets ?? []) {
    const target = t.targetKg;
    if (target == null || !(target > 0)) continue;
    const pr = input.exercisePrsByName[t.name];
    const current = pr?.maxWeight.value ?? 0;
    const pct = Math.min(100, Math.round((current / target) * 100));
    out.push({
      id: `ex-${t.name}`,
      title: `${t.name}: ${target} kg`,
      description:
        current > 0
          ? `Aktualny max: ${current} kg (${pct}%)`
          : "Brak zapisanych serii — zalicz trening z tym ćwiczeniem",
      achieved: current >= target,
      progressPct: pct,
    });
  }

  // Domyślne kamienie siłowe gdy brak celów ćwiczeń
  if (!(input.goals.exerciseTargets?.length)) {
    const anyPr = Object.values(input.exercisePrsByName)[0];
    if (anyPr && anyPr.maxE1rm.value > 0) {
      const tiers = [50, 80, 100, 120, 150];
      for (const tier of tiers) {
        out.push({
          id: `e1rm-${tier}`,
          title: `e1RM ${tier} kg`,
          description: `Najlepszy e1RM: ${anyPr.maxE1rm.value} kg`,
          achieved: anyPr.maxE1rm.value >= tier,
          progressPct: Math.min(100, Math.round((anyPr.maxE1rm.value / tier) * 100)),
        });
      }
    }
  }

  return out;
}
