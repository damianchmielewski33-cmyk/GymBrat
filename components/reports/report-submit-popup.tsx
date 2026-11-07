"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { cn } from "@/lib/utils";

export type ReportSubmitPhase = "idle" | "saving" | "success";

export type ReportSubmitSummary = {
  weightKg: number | null;
  dayEnergy: number | null;
  sleepQuality: number | null;
  dietCompliance: string;
  trainingCompliance: string;
  cardioCompliance: string;
  photosCount: number;
};

type Props = {
  phase: ReportSubmitPhase;
  summary: ReportSubmitSummary | null;
  onClose: () => void;
};

export function ReportSubmitPopup({ phase, summary, onClose }: Props) {
  const open = phase === "saving" || phase === "success";
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (phase !== "success") {
      setShowCheck(false);
      return;
    }
    const t = window.setTimeout(() => setShowCheck(true), 80);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "success") onClose();
      }}
      tone="gold"
      icon={phase === "saving" ? Loader2 : CheckCircle2}
      iconClassName={
        phase === "saving" ? "animate-spin" : cn("transition-all duration-500", showCheck ? "scale-100 opacity-100" : "scale-75 opacity-0")
      }
      title={phase === "saving" ? "Zapisywanie raportu…" : "Raport zapisany"}
      description={
        phase === "saving"
          ? "Chwila — zapisuję pomiary, samopoczucie i zdjęcia."
          : "Pomiary i samopoczucie są już w historii."
      }
    >
      {phase === "saving" ? null : (
        <>
            {summary ? (
              <div className="mt-5 grid w-full grid-cols-2 gap-2 text-left">
                <SummaryTile
                  label="Waga"
                  value={
                    summary.weightKg != null
                      ? `${String(summary.weightKg).replace(".", ",")} kg`
                      : "—"
                  }
                />
                <SummaryTile
                  label="Samopoczucie"
                  value={
                    summary.dayEnergy != null && summary.sleepQuality != null
                      ? `${summary.dayEnergy}/10 · sen ${summary.sleepQuality}/10`
                      : "—"
                  }
                />
                <SummaryTile
                  label="Plan"
                  value={[
                    summary.dietCompliance && `dieta ${summary.dietCompliance}`,
                    summary.trainingCompliance && `tren. ${summary.trainingCompliance}`,
                    summary.cardioCompliance && `cardio ${summary.cardioCompliance}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                />
                <SummaryTile
                  label="Zdjęcia"
                  value={
                    summary.photosCount > 0
                      ? `${summary.photosCount} szt.`
                      : "brak"
                  }
                />
              </div>
            ) : null}

            <AppDialogActions>
              <AppDialogButton intent="primary" onClick={onClose}>
                Zamknij
              </AppDialogButton>
            </AppDialogActions>
        </>
      )}
    </AppDialog>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}
