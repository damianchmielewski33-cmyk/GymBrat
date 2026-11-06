import { parseFitnessGoalsJson, STREAK_WEEKS_GOAL_DEFAULT, TONNAGE_GOAL_KG_DEFAULT, WAIST_GOAL_CM_DEFAULT } from "@/lib/fitness-goals";
import { goalStatusLabel, projectToTarget, targetE1rm } from "@/lib/goal-projection";
import { daysBetweenDateKeys } from "@/lib/local-date";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import { safeRound1 } from "@/lib/progress-hub-helpers";
import type { ProgressGoalBar, ProgressWeightPoint } from "@/lib/progress-hub-types";
import type { ExAgg } from "@/lib/progress-hub-exercises";

/** Cele Postępów (Z88a). */
/** Paski celów: pas, tonaż, seria tygodni, waga docelowa i cele ćwiczeń. */
export function buildGoalBars(args: {
  goals: ReturnType<typeof parseFitnessGoalsJson>;
  waistDeltaCm: number | null;
  totalTonnageKg: number;
  streakWeeks: number;
  currentKg: number | null;
  weights: ProgressWeightPoint[];
  byExercise: Map<string, ExAgg>;
  today: string;
}): ProgressGoalBar[] {
  const { goals, waistDeltaCm, totalTonnageKg, streakWeeks, currentKg, weights, byExercise, today } = args;
  const waistLostCm =
    waistDeltaCm != null && waistDeltaCm < 0
      ? Math.abs(waistDeltaCm)
      : 0;
  const waistGoalCm = goals.waistGoalCm ?? WAIST_GOAL_CM_DEFAULT;
  const waistRemain = Math.max(0, safeRound1(waistGoalCm - waistLostCm));
  const tonnageGoalKg = goals.tonnageGoalKg ?? TONNAGE_GOAL_KG_DEFAULT;
  const tonnageRemainKg = Math.max(0, tonnageGoalKg - totalTonnageKg);
  const streakGoal = goals.streakWeeksGoal ?? STREAK_WEEKS_GOAL_DEFAULT;
  const streakRemain = Math.max(0, streakGoal - streakWeeks);

  // Cele pasa i tonażu pokazujemy tylko, gdy użytkownik je ustawił — domyślne
  // „−15 cm” nie pasuje np. do osoby na masie.
  const goalBars: ProgressGoalBar[] = [
    {
      id: "waist-goal",
      label: `−${waistGoalCm} cm w pasie`,
      remainingLabel:
        waistRemain <= 0 ? "cel osiągnięty" : `jeszcze ${waistRemain} cm`,
      progressPct: Math.min(
        100,
        Math.round((waistLostCm / waistGoalCm) * 100),
      ),
    },
    {
      id: "tonnage-goal",
      label: `${safeRound1(tonnageGoalKg / 1000)} t podniesione`,
      remainingLabel:
        tonnageRemainKg <= 0
          ? "cel osiągnięty"
          : `jeszcze ${safeRound1(tonnageRemainKg / 1000)} t`,
      progressPct: Math.min(
        100,
        Math.round((totalTonnageKg / tonnageGoalKg) * 100),
      ),
    },
    {
      id: "streak-goal",
      label: `${streakGoal} ${streakGoal === 1 ? "tydzień" : "tygodnie"} z rzędu`,
      remainingLabel:
        streakRemain <= 0
          ? "cel osiągnięty"
          : streakRemain === 1
            ? "jeszcze 1 tydzień"
            : `jeszcze ${streakRemain} tygodnie`,
      progressPct: Math.min(
        100,
        Math.round((streakWeeks / streakGoal) * 100),
      ),
    },
  ].filter(
    (g) =>
      (g.id !== "waist-goal" || goals.waistGoalCm != null) &&
      (g.id !== "tonnage-goal" || goals.tonnageGoalKg != null),
  );

  // Cele z prognozą: waga docelowa (z terminem) i cele ćwiczeń (e1RM).
  if (
    typeof goals.targetWeightKg === "number" &&
    goals.targetWeightKg > 0 &&
    currentKg != null &&
    weights.length > 0
  ) {
    const recentWeights = weights.filter(
      (w) => daysBetweenDateKeys(w.date, today) <= 60,
    );
    const proj = projectToTarget({
      points: recentWeights.map((w) => ({ date: w.date, value: w.kg })),
      target: goals.targetWeightKg,
      deadline: goals.goalDeadline ?? null,
      today,
    });
    const startW = weights[0]!.kg;
    const span = Math.abs(goals.targetWeightKg - startW);
    const done = Math.abs(currentKg - startW);
    const wrongWay =
      Math.sign(goals.targetWeightKg - startW) !== Math.sign(currentKg - startW);
    goalBars.push({
      id: "weight-goal",
      label: `Waga ${goals.targetWeightKg} kg`,
      remainingLabel: goalStatusLabel(proj),
      progressPct:
        proj.status === "reached"
          ? 100
          : span > 0 && !wrongWay
            ? Math.min(100, Math.round((done / span) * 100))
            : 0,
    });
  }
  for (const t of goals.exerciseTargets ?? []) {
    if (!t.targetKg) continue;
    const key = resolveExerciseIdentity(t.name).key;
    const agg = key ? byExercise.get(key) : undefined;
    if (!agg || agg.points.length === 0) continue;
    const target = targetE1rm(t.targetKg, t.targetReps);
    const proj = projectToTarget({
      points: agg.points
        .filter((p) => p.bestE1rm > 0 && daysBetweenDateKeys(p.date, today) <= 120)
        .map((p) => ({ date: p.date, value: p.bestE1rm })),
      target,
      deadline: t.deadline ?? null,
      today,
    });
    goalBars.push({
      id: `exercise-goal-${key}`,
      label: `${agg.name} ${t.targetKg} kg${t.targetReps ? ` × ${t.targetReps}` : ""}`,
      remainingLabel: goalStatusLabel(proj),
      progressPct: Math.min(100, Math.round((agg.bestE1rm / target) * 100)),
    });
  }
  return goalBars;
}
