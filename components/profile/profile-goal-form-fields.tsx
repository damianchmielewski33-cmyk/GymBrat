"use client";

import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileGoalFormFields({ initialGoal }: { initialGoal: number }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="weeklyGoal">Tygodniowy cel cardio (minuty)</Label>
        <Input
          id="weeklyGoal"
          name="weeklyGoal"
          type="number"
          min={1}
          defaultValue={initialGoal}
          className="max-w-xs border-white/15 bg-black/30"
        />
        <p className="text-xs text-white/45">
          Zapisane w Turso. Postęp na stronie Start = suma cardio z ostatnich 7 dni ÷ ten
          cel × 100%.
        </p>
      </div>
      <SubmitButton className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
        Zaktualizuj cel
      </SubmitButton>
    </>
  );
}

