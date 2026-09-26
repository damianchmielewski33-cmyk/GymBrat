"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && phase === "success") onClose();
      }}
    >
      <AlertDialogContent className="w-[min(92vw,420px)] overflow-hidden border-white/10 bg-[#121214]">
        {phase === "saving" ? (
          <div className="flex flex-col items-center px-2 py-6 text-center">
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#d4af37]/35 bg-[#d4af37]/10"
              style={{ boxShadow: "0 0 28px rgba(212,175,55,0.28)" }}
            >
              <Loader2
                className="h-8 w-8 animate-spin text-[#e8c547]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#d4af37]/15"
                aria-hidden
              />
            </div>
            <AlertDialogTitle className="mt-5 text-lg text-white">
              Zapisywanie raportu…
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm text-white/50">
              Chwila — zapisuję pomiary, samopoczucie i zdjęcia.
            </AlertDialogDescription>
          </div>
        ) : (
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 transition-all duration-500",
                showCheck ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
              style={{ boxShadow: "0 0 28px rgba(125,222,160,0.28)" }}
            >
              <CheckCircle2 className="h-9 w-9 text-[#7ddea0]" aria-hidden />
            </div>
            <AlertDialogTitle className="mt-5 text-lg text-white">
              Raport dodany
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm text-white/50">
              Pomiary i samopoczucie są już w historii.
            </AlertDialogDescription>

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

            <div className="mt-6 flex w-full justify-center">
              <AlertDialogClose
                render={
                  <Button
                    type="button"
                    className="h-11 min-w-[8rem] rounded-2xl bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a] font-bold text-[#0a0906] hover:brightness-110"
                  />
                }
              >
                OK
              </AlertDialogClose>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-white/85">{value}</p>
    </div>
  );
}
