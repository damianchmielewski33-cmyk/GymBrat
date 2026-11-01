import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getWorkoutPlans } from "@/actions/workout-plan";
import { withDbRetry } from "@/db/with-retry";
import { EmptyNote } from "@/components/progress/progress-ui";
import {
  PlanReviewClient,
  type PlanReviewCard,
} from "@/components/plany/plan-review-client";
import { regionToAnalyticsGroup } from "@/lib/analytics/muscle-groups";
import type { AnalyticsMuscleGroupId } from "@/lib/analytics/types";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import { calendarDateKey } from "@/lib/local-date";
import { buildPlanReview, type PlanReviewExercise } from "@/lib/plan-review";
import { mesocycleAt } from "@/lib/mesocycle";
import { suggestAlternatives } from "@/lib/plan-alternatives";
import { loadPlanAdherence, loadPlanRevisions } from "@/lib/plan-review-data";
import { getProgressHubData } from "@/lib/progress-hub";
import { resolveExerciseMuscles } from "@/lib/resolve-exercise-muscles";

export default async function PlanReviewPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress/przeglad-planu");

  const [data, plans] = await Promise.all([
    withDbRetry(() => getProgressHubData(userId, "sila"), {
      attempts: 3,
      label: "plan-review",
    }),
    getWorkoutPlans(),
  ]);
  const today = calendarDateKey();

  const historyByKey = new Map<string, PlanReviewExercise["history"]>();
  for (const g of data.strength.planGroups) {
    for (const e of g.exercises) {
      const key = resolveExerciseIdentity(e.name).key;
      if (key && !historyByKey.has(key)) historyByKey.set(key, e.history);
    }
  }
  const stagnationByKey = new Map(
    data.intelligence.stagnation.map((s) => [
      resolveExerciseIdentity(s.name).key || s.exerciseKey,
      s.status,
    ]),
  );
  const weeklyEffectiveSets: Partial<Record<AnalyticsMuscleGroupId, number>> =
    {};
  for (const r of data.intelligence.muscle.groups) {
    weeklyEffectiveSets[r.id] = r.days30.effectiveSets / (30 / 7);
  }

  const acuteChronicBand: Partial<
    Record<AnalyticsMuscleGroupId, "unknown" | "detraining" | "optimal" | "high" | "spike">
  > = {};
  for (const r of data.intelligence.muscle.groups) {
    acuteChronicBand[r.id] = r.acuteChronic.band;
  }
  const revisions = await loadPlanRevisions(
    userId,
    plans.map((p) => p.id),
  );

  const cards: PlanReviewCard[] = await Promise.all(plans.map(async ({ id, plan }) => {
    const { byExerciseId, firstDate } = await loadPlanAdherence({
      userId,
      planId: id,
      today,
      planExercises: plan.exercises.map((e) => ({ id: e.id, name: e.name, sets: e.sets })),
    });
    const planNames = plan.exercises.map((e) => e.name);
    const exercises: PlanReviewExercise[] = plan.exercises.map((e) => {
      const key = resolveExerciseIdentity(e.name).key;
      const primary = resolveExerciseMuscles({ name: e.name }).primary;
      return {
        id: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        muscle:
          primary && primary !== "cardio"
            ? regionToAnalyticsGroup(primary)
            : null,
        history: (key && historyByKey.get(key)) || [],
        stagnation: (key && stagnationByKey.get(key)) || null,
        adherence: byExerciseId.get(e.id) ?? null,
        alternatives: suggestAlternatives({
          name: e.name,
          categoryId: e.categoryId,
          planNames,
        }),
      };
    });
    const review = buildPlanReview({
      today,
      exercises,
      weeklyEffectiveSets,
      acuteChronicBand,
      fatigueScore: data.intelligence.fatigue.score,
      recentSessionCount: data.strength.workoutCount,
    });
    const planRevs = revisions.filter((r) => r.planId === id);
    const active = [...planRevs].reverse().find((r) => !r.reverted) ?? null;
    const meso = mesocycleAt({
      revisions: planRevs.filter((r) => !r.reverted),
      planStart: firstDate ?? today,
      today,
    });
    return {
      planId: id,
      planName: plan.planName,
      insufficientData: review.insufficientData,
      proposals: review.proposals,
      activeRevision: active
        ? { id: active.id, kind: active.kind, summary: active.summary, date: active.date }
        : null,
      mesocycleLabel: `Mezocykl ${meso.index} · tydzień ${meso.weekInBlock}`,
    };
  }));

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      <header className="px-0.5">
        <Link
          href="/progress?tab=sila"
          className="inline-flex items-center gap-1 text-[12px] text-white/55"
        >
          <ArrowLeft className="size-3.5" /> Analiza
        </Link>
        <h1 className="mt-1 font-heading text-[28px] font-semibold leading-8 tracking-tight text-white">
          Przegląd planu
        </h1>
        <p className="mt-1 text-[12px] text-white/55">
          Propozycje z Twojej historii. Nic nie zmieni się bez Twojej zgody.
        </p>
      </header>
      {cards.length === 0 ? (
        <EmptyNote>Nie masz jeszcze planów treningowych.</EmptyNote>
      ) : (
        <PlanReviewClient cards={cards} />
      )}
    </div>
  );
}
