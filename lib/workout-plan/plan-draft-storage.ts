import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";

const PREFIX = "gymbrat:plan-draft:v1:";

function key(planId: string): string {
  return `${PREFIX}${planId || "new"}`;
}

export function readPlanDraft(planId: string): WorkoutPlanPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkoutPlanPayload;
    if (parsed?.version !== 2 || parsed.path !== "custom") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlanDraft(planId: string, plan: WorkoutPlanPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(planId), JSON.stringify(plan));
  } catch {
    // quota / private mode — ignorujemy
  }
}

export function clearPlanDraft(planId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(planId));
  } catch {
    // ignore
  }
}
