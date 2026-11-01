import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { planRevisions, workouts } from "@/db/schema";
import { addCalendarDays } from "@/lib/local-date";
import { computeAdherence, type PlanAdherence } from "@/lib/mesocycle";
import {
  safeNormalizeExercises,
  safeParseCompletedSession,
} from "@/lib/workout-history";

const ADHERENCE_WEEKS = 8;

export type PlanRevisionInfo = {
  id: string;
  planId: string;
  kind: string;
  summary: string | null;
  /** YYYY-MM-DD */
  date: string;
  reverted: boolean;
};

function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function loadPlanRevisions(
  userId: string,
  planIds: string[],
): Promise<PlanRevisionInfo[]> {
  if (planIds.length === 0) return [];
  const rows = await getDb()
    .select({
      id: planRevisions.id,
      planId: planRevisions.planId,
      kind: planRevisions.kind,
      summary: planRevisions.summary,
      createdAt: planRevisions.createdAt,
      revertedAt: planRevisions.revertedAt,
    })
    .from(planRevisions)
    .where(
      and(eq(planRevisions.userId, userId), inArray(planRevisions.planId, planIds)),
    )
    .orderBy(asc(planRevisions.createdAt));
  return rows.map((r) => ({
    id: r.id,
    planId: r.planId,
    kind: r.kind,
    summary: r.summary,
    date: dateKey(r.createdAt),
    reverted: r.revertedAt != null,
  }));
}

/**
 * Zaplanowane vs wykonane serie roboczych ćwiczeń (bez rozgrzewek i pominiętych)
 * w sesjach danego planu z ostatnich tygodni. Klucz: id ćwiczenia z planu.
 */
export async function loadPlanAdherence(args: {
  userId: string;
  planId: string;
  today: string;
  planExercises: Array<{ id: string; name: string; sets: number }>;
}): Promise<{ byExerciseId: Map<string, PlanAdherence>; firstDate: string | null }> {
  const from = addCalendarDays(args.today, -7 * ADHERENCE_WEEKS);
  const rows = await getDb()
    .select({ date: workouts.date, exercisesJson: workouts.exercises })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, args.userId),
        eq(workouts.workoutPlanId, args.planId),
        gte(workouts.date, from),
      ),
    )
    .orderBy(desc(workouts.date))
    .limit(120);

  const perExercise = new Map<string, Array<{ plannedSets: number; doneSets: number }>>();
  let firstDate: string | null = null;
  for (const r of rows) {
    const date = String(r.date);
    if (!firstDate || date < firstDate) firstDate = date;
    const parsed = safeParseCompletedSession(r.exercisesJson);
    if (!parsed) continue;
    const done = safeNormalizeExercises(parsed.exercises);
    for (const pe of args.planExercises) {
      const ex = done.find(
        (e) =>
          e.id === pe.id ||
          (e.name ?? "").trim().toLowerCase() === pe.name.trim().toLowerCase(),
      );
      const doneSets = ex
        ? (ex.sets ?? []).filter(
            (s) =>
              s.done &&
              !s.skipped &&
              !s.warmup &&
              s.reps != null &&
              s.reps > 0,
          ).length
        : 0;
      const list = perExercise.get(pe.id) ?? [];
      list.push({ plannedSets: pe.sets, doneSets });
      perExercise.set(pe.id, list);
    }
  }
  const byExerciseId = new Map<string, PlanAdherence>();
  for (const [id, list] of perExercise) byExerciseId.set(id, computeAdherence(list));
  return { byExerciseId, firstDate };
}

