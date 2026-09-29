"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Dumbbell, Flame, Trophy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatVolumeKg } from "@/lib/workout-session-calculations";
import type { NewMaxHit } from "@/lib/session-new-max";
import { PrAchievementGraphic } from "@/components/reports/pr-achievement-graphic";
import { hapticNewMax, hapticWorkoutDone } from "@/lib/haptics";
import { cn } from "@/lib/utils";

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
  newMaxHits?: NewMaxHit[];
};

const STORAGE_KEY = "workout:completedSummary";
const TOAST_KEY = "gymbrat:newMaxToast";

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
  const [toastLabel, setToastLabel] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const toast = sessionStorage.getItem(TOAST_KEY);
    if (toast?.trim()) setToastLabel(toast.trim());
    if (!raw) {
      if (toast) sessionStorage.removeItem(TOAST_KEY);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as WorkoutCompleteSummary;
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.endedAt !== "number") return;
      setSummary(parsed);
      setOpen(true);
      if (Array.isArray(parsed.newMaxHits) && parsed.newMaxHits.length > 0) {
        hapticNewMax();
      } else {
        hapticWorkoutDone();
      }
    } catch {
      // ignore malformed
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TOAST_KEY);
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

  const newMaxHits = summary?.newMaxHits ?? [];
  const primaryExercise = newMaxHits[0]?.exerciseName?.trim() || null;

  if (!summary) return null;

  const strengthLabel =
    summary.strengthDeltaPercent == null || !Number.isFinite(summary.strengthDeltaPercent)
      ? null
      : `${summary.strengthDeltaPercent > 0 ? "+" : ""}${summary.strengthDeltaPercent.toFixed(1)}%`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-h-[min(92vh,820px)] w-[min(92vw,420px)] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
            style={{
              boxShadow: "0 0 18px rgba(var(--neon-rgb),0.12)",
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

        {newMaxHits[0] ? (
          <div className="mt-4">
            <PrAchievementGraphic
              exerciseName={newMaxHits[0].exerciseName}
              valueKg={newMaxHits[0].value}
              atMs={summary.endedAt}
            />
            {newMaxHits.length > 1 ? (
              <p className="mt-2 text-center text-xs text-white/50">
                +{newMaxHits.length - 1}{" "}
                {newMaxHits.length - 1 === 1 ? "kolejny rekord" : "kolejne rekordy"} w tej sesji
              </p>
            ) : null}
          </div>
        ) : toastLabel ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-4 py-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gym-gold)]" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
                NOWY MAX
              </p>
              <p className="mt-1 text-sm text-white/90">{toastLabel}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-white/60">
              <Dumbbell className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Tonaż</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
              {formatVolumeKg(summary.totalVolume)}{" "}
              <span className="text-base font-semibold text-white/45">kg</span>
            </p>
            <p className="mt-1 text-xs text-white/45">
              Wskaźnik siły vs poprzedni (plan):{" "}
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

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {primaryExercise ? (
            <Link
              href={`/progress-analysis?q=${encodeURIComponent(primaryExercise)}`}
              className={cn(buttonVariants({ variant: "outline" }))}
              onClick={() => setOpen(false)}
            >
              Zobacz postęp
            </Link>
          ) : null}
          <AlertDialogClose
            render={
              <Button type="button" />
            }
          >
            OK
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
