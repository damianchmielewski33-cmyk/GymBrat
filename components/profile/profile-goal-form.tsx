"use client";

import { useActionState, useEffect, useState } from "react";
import { updateWeeklyCardioGoalForm } from "@/actions/workout";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import { ProfileField } from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [90, 150, 210, 300] as const;

export function ProfileGoalForm({ initialGoal }: { initialGoal: number }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [goal, setGoal] = useState(String(initialGoal));
  const [state, formAction] = useActionState(updateWeeklyCardioGoalForm, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano tygodniowy cel cardio.");
    else if (state?.ok === false && state.error) notifyError("Nie udało się zapisać celu.");
  }, [state, notifySaved, notifyError]);

  return (
    <form className="space-y-4" action={formAction}>
      <ProfileField
        label="Tygodniowy cel cardio (minuty)"
        htmlFor="weeklyGoal"
        hint="Pasek postępu na Start = suma cardio z ostatnich 7 dni względem tego celu."
      >
        <Input
          id="weeklyGoal"
          name="weeklyGoal"
          type="number"
          inputMode="numeric"
          min={1}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </ProfileField>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Szybki wybór celu">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setGoal(String(m))}
            aria-pressed={goal === String(m)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              goal === String(m)
                ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85",
            )}
          >
            {m} min
          </button>
        ))}
      </div>
      <SubmitButton>Zapisz cel cardio</SubmitButton>
    </form>
  );
}
