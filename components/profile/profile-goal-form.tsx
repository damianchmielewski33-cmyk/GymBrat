import { updateWeeklyCardioGoalForm } from "@/actions/workout";
import { ProfileGoalFormFields } from "@/components/profile/profile-goal-form-fields";

export function ProfileGoalForm({ initialGoal }: { initialGoal: number }) {
  return (
    <form className="space-y-3" action={updateWeeklyCardioGoalForm}>
      <ProfileGoalFormFields initialGoal={initialGoal} />
    </form>
  );
}
