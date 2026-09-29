/**
 * Klucz porównania sesji: Push / Nogi / Bark itd. osobno.
 * Priorytet: nazwa planu → tytuł sesji → id planu.
 */

export function normalizePlanLabel(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type PlanCompareInput = {
  workoutPlanId?: string | null;
  planName?: string | null;
  title?: string | null;
};

/**
 * Stabilny klucz do grupowania / porównań w obrębie tego samego dnia planu.
 * Np. wszystkie „Nogi” trafiają do jednej serii, niezależnie od Push.
 */
export function workoutPlanCompareKey(input: PlanCompareInput): string {
  const byPlanName = normalizePlanLabel(input.planName);
  if (byPlanName) return `name:${byPlanName}`;

  const byTitle = normalizePlanLabel(input.title);
  if (byTitle) return `name:${byTitle}`;

  const id = String(input.workoutPlanId ?? "").trim();
  if (id) return `id:${id}`;

  return "name:trening";
}

/** Etykieta do UI (planName albo tytuł). */
export function workoutPlanDisplayLabel(input: PlanCompareInput): string {
  const plan = String(input.planName ?? "").trim();
  if (plan) return plan;
  const title = String(input.title ?? "").trim();
  if (title) return title;
  return "Trening";
}

/** Czy dwie sesje należą do tego samego dnia planu (do porównań). */
export function isSameWorkoutPlanDay(a: PlanCompareInput, b: PlanCompareInput): boolean {
  return workoutPlanCompareKey(a) === workoutPlanCompareKey(b);
}
