"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Flame,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { WorkoutPlanComparePayload } from "@/lib/workout-plan-compare";
import { formatHistoryShortDate, formatTonnes } from "@/lib/workout-history-overview";
import {
  formatProgressDelta,
  progressDeltaTone,
  readProgressDeltaUnitLocal,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";

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
  planCompare?: WorkoutPlanComparePayload | null;
  newMaxHits?: NewMaxHit[];
};

const STORAGE_KEY = "workout:completedSummary";
const TOAST_KEY = "gymbrat:newMaxToast";

const dialogShell =
  "app-dialog max-h-[min(92vh,820px)] w-[min(92vw,420px)] overflow-y-auto p-5 text-white sm:p-6";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatExerciseDelta(
  unit: ProgressDeltaUnit,
  ex: WorkoutPlanComparePayload["exercises"][number],
) {
  const absolute =
    ex.previousVolumeKg != null
      ? ex.currentVolumeKg - ex.previousVolumeKg
      : null;
  return formatProgressDelta({
    unit,
    percent: ex.deltaPercent,
    absolute,
  });
}

function PlanCompareDialog({
  open,
  onOpenChange,
  compare,
  title,
  progressDeltaUnit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compare: WorkoutPlanComparePayload;
  title: string;
  progressDeltaUnit: ProgressDeltaUnit;
}) {
  const volumeAbs =
    compare.previousVolumeKg != null
      ? compare.currentVolumeKg - compare.previousVolumeKg
      : null;
  const volumeLabel = formatProgressDelta({
    unit: progressDeltaUnit,
    percent: compare.volumeDeltaPercent,
    absolute: volumeAbs,
  });
  const tone = progressDeltaTone(
    progressDeltaUnit,
    compare.volumeDeltaPercent,
    volumeAbs,
  );
  const planName = compare.planLabel?.trim() || title;
  const hasPrev = compare.previousVolumeKg != null;
  const volUp = tone === "up";
  const volDown = tone === "down";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={dialogShell}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
            <TrendingUp className="h-5 w-5 text-[var(--gym-gold)]" />
          </div>
          <div className="min-w-0">
            <p className="app-label text-[var(--gym-gold)]">Ten sam plan</p>
            <AlertDialogTitle className="mt-1 font-heading text-[22px] font-semibold leading-tight text-white">
              Postęp vs poprzedni
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-[13px] text-white/45">
              {planName}
              {compare.previousDate ? (
                <>
                  {" "}
                  · {formatHistoryShortDate(compare.previousDate)} → dziś
                </>
              ) : null}
            </AlertDialogDescription>
          </div>
        </div>

        {!hasPrev ? (
          <div className="app-card mt-5 p-4 text-sm leading-relaxed text-white/55">
            To pierwsza zapisana sesja tego planu — nie ma jeszcze z czym porównać.
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="app-card p-3.5 text-center">
                <p className="app-label">Tonaż</p>
                <p className="mt-2 font-display text-[1.85rem] leading-none tabular-nums text-[var(--gym-gold)]">
                  {formatTonnes(compare.currentVolumeKg)}
                </p>
                <p className="mt-1.5 text-[11px] text-white/45">
                  wcześniej {formatTonnes(compare.previousVolumeKg ?? 0)}
                </p>
              </div>
              <div className="app-card p-3.5 text-center">
                <p className="app-label">Zmiana objętości</p>
                <p
                  className={cn(
                    "mt-2 inline-flex items-center justify-center gap-1 font-display text-[1.85rem] leading-none tabular-nums",
                    volUp
                      ? "text-emerald-300"
                      : volDown
                        ? "text-red-300"
                        : "text-white/70",
                  )}
                >
                  {volUp ? (
                    <TrendingUp className="h-5 w-5" aria-hidden />
                  ) : volDown ? (
                    <TrendingDown className="h-5 w-5" aria-hidden />
                  ) : null}
                  {volumeLabel ?? "—"}
                </p>
                {compare.compare ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                    <span className="text-emerald-400">{compare.compare.up} w górę</span>
                    <span className="text-white/25">, </span>
                    <span className="text-red-400">{compare.compare.down} w dół</span>
                    <span className="text-white/25">, </span>
                    <span className="text-white/70">
                      {compare.compare.skipped} pominiętych
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <p className="app-label px-0.5">Ćwiczenia</p>
              <ul className="mt-2.5 max-h-[42vh] space-y-2 overflow-y-auto pr-0.5">
                {compare.exercises.map((ex) => {
                  const delta = formatExerciseDelta(progressDeltaUnit, ex);
                  return (
                    <li key={ex.name} className="app-card px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-white">
                            {ex.name}
                          </p>
                          <p className="mt-1 text-[12px] tabular-nums text-white/45">
                            {Math.round(ex.currentVolumeKg)} kg
                            {ex.previousVolumeKg != null
                              ? ` · wcześniej ${Math.round(ex.previousVolumeKg)} kg`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-semibold tabular-nums">
                          {ex.status === "up" ? (
                            <>
                              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-300">{delta}</span>
                            </>
                          ) : ex.status === "down" ? (
                            <>
                              <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                              <span className="text-red-300">{delta}</span>
                            </>
                          ) : ex.status === "skipped" ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                              pominięte
                            </span>
                          ) : ex.status === "new" ? (
                            <span className="rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--gym-gold)]">
                              nowe
                            </span>
                          ) : (
                            <>
                              <Minus className="h-3.5 w-3.5 text-white/35" />
                              <span className="text-white/50">{delta ?? "0"}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <div className="mt-5">
          <AlertDialogClose
            render={
              <Button type="button" className="gym-btn-primary h-12 w-full" />
            }
          >
            Zamknij
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WorkoutCompletePopup() {
  const [open, setOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [summary, setSummary] = useState<WorkoutCompleteSummary | null>(null);
  const [toastLabel, setToastLabel] = useState<string | null>(null);
  const [progressDeltaUnit, setProgressDeltaUnit] =
    useState<ProgressDeltaUnit>("percent");

  useEffect(() => {
    setProgressDeltaUnit(readProgressDeltaUnitLocal("percent"));
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
  const planCompare = summary?.planCompare ?? null;

  if (!summary) return null;

  const volumeAbs =
    planCompare?.previousVolumeKg != null
      ? planCompare.currentVolumeKg - planCompare.previousVolumeKg
      : null;
  const volumeDeltaPercent =
    planCompare?.volumeDeltaPercent ?? summary.strengthDeltaPercent;
  const strengthLabel = formatProgressDelta({
    unit: progressDeltaUnit,
    percent: volumeDeltaPercent,
    absolute: volumeAbs,
  });
  const volumeTone = progressDeltaTone(
    progressDeltaUnit,
    volumeDeltaPercent,
    volumeAbs,
  );

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className={dialogShell}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
              <CheckCircle2 className="h-5 w-5 text-[var(--gym-gold)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="app-label text-[var(--gym-gold)]">Sesja</p>
              <AlertDialogTitle className="mt-1 font-heading text-[22px] font-semibold leading-tight text-white">
                Trening zapisany
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-[13px] text-white/45">
                {summary.title?.trim() ? (
                  <>
                    <span className="font-medium text-white/85">{summary.title.trim()}</span>
                    {endedLabel ? <span> · {endedLabel}</span> : null}
                  </>
                ) : (
                  <>Sesja została zapisana{endedLabel ? ` · ${endedLabel}` : ""}.</>
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
            <div className="app-card mt-4 flex items-start gap-3 border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 p-4">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gym-gold)]" />
              <div className="min-w-0">
                <p className="app-label text-[var(--gym-gold)]">NOWY MAX</p>
                <p className="mt-1 text-sm text-white/90">{toastLabel}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <div className="app-card p-4 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Dumbbell className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
                <p className="app-label text-[var(--gym-gold)]">Tonaż</p>
              </div>
              <p className="mt-2 font-display text-[1.85rem] leading-none tabular-nums text-[var(--gym-gold)]">
                {formatVolumeKg(summary.totalVolume)}
                <span className="ml-1 text-base text-white/45">kg</span>
              </p>
              <p className="mt-1.5 text-[11px] text-white/45">
                vs poprzedni plan:{" "}
                {strengthLabel ? (
                  <span
                    className={cn(
                      "font-semibold",
                      volumeTone === "up"
                        ? "text-emerald-300"
                        : volumeTone === "down"
                          ? "text-red-300"
                          : "text-white/70",
                    )}
                  >
                    {strengthLabel}
                  </span>
                ) : (
                  "—"
                )}
              </p>
            </div>

            <div className="app-card p-4 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Clock3 className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
                <p className="app-label text-[var(--gym-gold)]">Czas</p>
              </div>
              <p className="mt-2 font-display text-[1.85rem] leading-none tabular-nums text-white">
                {formatDuration(summary.durationSeconds)}
              </p>
              <p className="mt-1.5 text-[11px] text-white/45">
                Serie {summary.setsDone}/{summary.setsTotal} · {summary.exercisesCount} ćw.
              </p>
            </div>
          </div>

          {planCompare?.compare ? (
            <div className="app-card mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                {planCompare.compare.up} w górę
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-300">
                <TrendingDown className="h-3.5 w-3.5" />
                {planCompare.compare.down} w dół
              </span>
              <span className="text-white/50">
                {planCompare.compare.skipped} pominiętych
              </span>
            </div>
          ) : null}

          <div className="app-card mt-2.5 p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
              <p className="app-label text-[var(--gym-gold)]">Cardio</p>
            </div>
            <p className="mt-2 font-display text-2xl tabular-nums text-white">
              {summary.cardioMinutes}
              <span className="ml-1 text-sm text-white/45">min</span>
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {planCompare ? (
              <Button
                type="button"
                className="gym-btn-primary h-12 w-full"
                onClick={() => setProgressOpen(true)}
              >
                Zobacz postęp
              </Button>
            ) : null}
            <AlertDialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full border-white/15"
                />
              }
            >
              OK
            </AlertDialogClose>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {planCompare ? (
        <PlanCompareDialog
          open={progressOpen}
          onOpenChange={setProgressOpen}
          compare={planCompare}
          title={summary.title}
          progressDeltaUnit={progressDeltaUnit}
        />
      ) : null}
    </>
  );
}
