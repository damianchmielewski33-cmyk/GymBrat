"use client";

import { useActionState, useEffect, useState } from "react";
import { updateReportCadenceForm } from "@/actions/report-cadence";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SubmitButton } from "@/components/home/submit-button";
import { ProfileField } from "@/components/profile/profile-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [7, 14, 30] as const;

export function ReportCadenceForm({ initialDays }: { initialDays: number }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [days, setDays] = useState(String(initialDays));
  const [state, formAction] = useActionState(updateReportCadenceForm, {} as {
    ok?: boolean;
    error?: string;
    days?: number;
  });

  useEffect(() => {
    if (state?.ok === true) notifySaved("Zapisano cykl raportów.");
    else if (state?.ok === false && state.error) notifyError(state.error);
  }, [state, notifySaved, notifyError]);

  return (
    <form className="space-y-4" action={formAction}>
      <ProfileField
        label="Co ile dni dodawać raport (3–90)"
        htmlFor="reportCadenceDays"
        hint="Timer na Start i w Raportach odlicza od ostatniego raportu — po dodaniu nowego liczy od zera."
      >
        <Input
          id="reportCadenceDays"
          name="reportCadenceDays"
          type="number"
          inputMode="numeric"
          min={3}
          max={90}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </ProfileField>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Szybki wybór cyklu">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(String(d))}
            aria-pressed={days === String(d)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              days === String(d)
                ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85",
            )}
          >
            {d === 7 ? "Co tydzień" : d === 14 ? "Co 2 tygodnie" : "Co miesiąc"}
          </button>
        ))}
      </div>
      <SubmitButton>Zapisz cykl raportów</SubmitButton>
    </form>
  );
}
