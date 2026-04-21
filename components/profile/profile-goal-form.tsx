"use client";

import { useActionState, useEffect } from "react";
import { updateWeeklyCardioGoalForm } from "@/actions/workout";
import { ProfileGoalFormFields } from "@/components/profile/profile-goal-form-fields";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

export function ProfileGoalForm({ initialGoal }: { initialGoal: number }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction] = useActionState(updateWeeklyCardioGoalForm, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano tygodniowy cel cardio.");
    else if (state?.ok === false && state.error) notifyError("Nie udało się zapisać celu.");
  }, [state, notifySaved, notifyError]);

  return (
    <form className="space-y-3" action={formAction}>
      <ProfileGoalFormFields initialGoal={initialGoal} />
    </form>
  );
}
