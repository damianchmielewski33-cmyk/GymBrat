"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Dumbbell, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatVolumeKg } from "@/lib/workout-session-calculations";

type WorkoutCompleteSummary = {
  title: string;
  endedAt: number;
  durationSeconds: number;
  cardioMinutes: number;
  exercisesCount: number;
  setsDone: number;
  setsTotal: number;
  totalVolume: number;
  /** % change vs previous workout from the same plan (volume proxy). */
  strengthDeltaPercent: number | null;
};

const STORAGE_KEY = "workout:completedSummary";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function WorkoutCompletePopup() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<WorkoutCompleteSummary | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WorkoutCompleteSummary;
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.endedAt !== "number") return;
      setSummary(parsed);
      setOpen(true);
    } catch {
      // ignore malformed
    } finally {
      // Always clear, so it shows only once.
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const endedLabel = useMemo(() => {
    if (!summary?.endedAt) return "";
    try {
      return new Date(summary.endedAt).toLocaleString("pl-PL", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [summary?.endedAt]);

  if (!summary) return null;

  const strengthLabel =
    summary.strengthDeltaPercent == null || !Number.isFinite(summary.strengthDeltaPercent)
      ? null
      : `${summary.strengthDeltaPercent > 0 ? "+" : ""}${summary.strengthDeltaPercent.toFixed(1)}%`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="w-[min(92vw,520px)]">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
            style={{
              boxShadow: "0 0 18px rgba(230,0,35,0.12)",
            }}
          >
            <CheckCircle2 className="h-6 w-6 text-[var(--neon)]" />
          </div>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle>Trening zapisany</AlertDialogTitle>
            <AlertDialogDescription>
              {summary.title?.trim() ? (
                <>
                  <span className="font-medium text-white/85">{summary.title.trim()}</span>
                  {endedLabel ? <span className="text-white/45"> • {endedLabel}</span> : null}
                </>
              ) : (
                <>Sesja została zapisana{endedLabel ? <span className="text-white/45"> • {endedLabel}</span> : null}.</>
              )}
            </AlertDialogDescription>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-white/60">
              <Dumbbell className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Objętość</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {formatVolumeKg(summary.totalVolume)}{" "}
              <span className="text-base font-semibold text-white/45">kg</span>
            </p>
            <p className="mt-1 text-xs text-white/45">
              Siła vs plan:{" "}
              {strengthLabel ? (
                <span
                  className={
                    summary.strengthDeltaPercent != null && summary.strengthDeltaPercent >= 0
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-red-300"
                  }
                >
                  {strengthLabel}
                </span>
              ) : (
                "—"
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-white/60">
              <Clock3 className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Czas</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {formatDuration(summary.durationSeconds)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              Serie: {summary.setsDone}/{summary.setsTotal} • Ćwiczenia: {summary.exercisesCount}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-white/60">
            <Flame className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Cardio</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-white/85">
            {summary.cardioMinutes} min
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <AlertDialogClose
            render={
              <Button
                type="button"
                className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
              />
            }
          >
            OK
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

