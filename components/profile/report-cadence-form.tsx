"use client";

import { useActionState, useEffect } from "react";
import { updateReportCadenceForm } from "@/actions/report-cadence";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

export function ReportCadenceForm({ initialDays }: { initialDays: number }) {
  const { notifySaved, notifyError } = useSaveFeedback();
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
    <form className="space-y-3" action={formAction}>
      <label className="block space-y-2">
        <span className="text-xs text-white/55">Co ile dni dodawać raport</span>
        <input
          type="number"
          name="reportCadenceDays"
          min={3}
          max={90}
          defaultValue={initialDays}
          className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus-visible:border-[#d4af37]/55 focus-visible:ring-2 focus-visible:ring-[#d4af37]/25"
        />
      </label>
      <p className="text-xs text-white/40">
        Timer na Pulpicie i w Raportach odlicza od ostatniego zapisu. Po dodaniu raportu licznik
        startuje od nowa.
      </p>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a] px-5 text-sm font-bold text-[#0a0906]"
      >
        Zapisz cykl
      </button>
    </form>
  );
}
