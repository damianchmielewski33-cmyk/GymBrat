"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { calendarDateKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gymbrat:week-pulse-shown:v1";

export type WeekPulseReportStatus =
  | { kind: "missing_first" }
  | { kind: "overdue"; daysSince: number }
  | { kind: "ok"; daysLeft: number };

function resolveReportStatus(
  reportCount: number,
  daysSinceLastReport: number | null,
  reportCadenceDays: number,
): WeekPulseReportStatus {
  if (reportCount === 0 || daysSinceLastReport == null) {
    return { kind: "missing_first" };
  }
  if (daysSinceLastReport >= reportCadenceDays) {
    return { kind: "overdue", daysSince: daysSinceLastReport };
  }
  return {
    kind: "ok",
    daysLeft: Math.max(0, reportCadenceDays - daysSinceLastReport),
  };
}

function resolveCta(args: {
  report: WeekPulseReportStatus;
  workoutsThisWeek: number;
  weeklySessionsTarget: number;
  caloriesConsumed: number;
  caloriesGoal: number | null;
}): { label: string; href: string } {
  if (args.report.kind === "missing_first" || args.report.kind === "overdue") {
    return { label: "Dodaj raport", href: "/reports?new=1" };
  }
  if (args.workoutsThisWeek < args.weeklySessionsTarget) {
    return { label: "Zacznij trening", href: "/workout-plan" };
  }
  if (args.caloriesGoal == null || args.caloriesConsumed <= 0) {
    return { label: "Dodaj posiłek", href: "/meal-suggestions" };
  }
  return { label: "Kontynuuj", href: "/workout-plan" };
}

function markShownToday() {
  try {
    window.localStorage.setItem(STORAGE_KEY, calendarDateKey());
  } catch {
    /* ignore */
  }
}

function wasShownToday(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === calendarDateKey();
  } catch {
    return false;
  }
}

function ProgressRow({
  label,
  valueText,
  ratio,
  tone,
}: {
  label: string;
  valueText: string;
  ratio: number | null;
  tone: "ok" | "warn" | "muted";
}) {
  const pct =
    ratio == null ? 0 : Math.min(100, Math.max(0, Math.round(ratio * 100)));
  const bar =
    tone === "ok"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-[var(--gym-gold)]"
        : "bg-white/25";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            tone === "ok" && "text-emerald-300",
            tone === "warn" && "text-[var(--gym-gold-bright)]",
            tone === "muted" && "text-white/70",
          )}
        >
          {valueText}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type WeekPulseProps = {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  workoutsThisWeek: number;
  weeklySessionsTarget: number;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
};

/**
 * Dzienny popup „Ten tydzień” — raz na kalendarzowy dzień przy pierwszym wejściu na Start.
 */
export function WeekPulseCard(props: WeekPulseProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasShownToday()) return;
    setOpen(true);
  }, []);

  function dismiss() {
    markShownToday();
    setOpen(false);
  }

  const report = resolveReportStatus(
    props.reportCount,
    props.daysSinceLastReport,
    props.reportCadenceDays,
  );
  const cta = resolveCta({
    report,
    workoutsThisWeek: props.workoutsThisWeek,
    weeklySessionsTarget: props.weeklySessionsTarget,
    caloriesConsumed: props.caloriesConsumed,
    caloriesGoal: props.caloriesGoal,
  });

  const kcalText =
    props.caloriesGoal != null
      ? `${Math.round(props.caloriesConsumed)} / ${Math.round(props.caloriesGoal)} kcal`
      : `${Math.round(props.caloriesConsumed)} kcal · brak celu`;
  const kcalRatio =
    props.caloriesGoal != null && props.caloriesGoal > 0
      ? props.caloriesConsumed / props.caloriesGoal
      : null;
  const kcalTone: "ok" | "warn" | "muted" =
    props.caloriesGoal == null
      ? "muted"
      : props.caloriesConsumed <= 0
        ? "warn"
        : props.caloriesConsumed / props.caloriesGoal <= 1.15
          ? "ok"
          : "warn";

  const trainText = `${props.workoutsThisWeek} / ${props.weeklySessionsTarget}`;
  const trainRatio =
    props.weeklySessionsTarget > 0
      ? props.workoutsThisWeek / props.weeklySessionsTarget
      : null;
  const trainTone: "ok" | "warn" | "muted" =
    props.workoutsThisWeek >= props.weeklySessionsTarget ? "ok" : "warn";

  let reportText: string;
  let reportRatio: number | null;
  let reportTone: "ok" | "warn" | "muted";
  if (report.kind === "missing_first") {
    reportText = "Brak pierwszego raportu";
    reportRatio = 0;
    reportTone = "warn";
  } else if (report.kind === "overdue") {
    reportText = `Zaległy · ${report.daysSince} dni temu`;
    reportRatio = 1;
    reportTone = "warn";
  } else {
    reportText =
      report.daysLeft === 0
        ? "Dziś termin raportu"
        : `Za ${report.daysLeft} ${report.daysLeft === 1 ? "dzień" : "dni"}`;
    reportRatio =
      props.reportCadenceDays > 0
        ? 1 - report.daysLeft / props.reportCadenceDays
        : null;
    reportTone = report.daysLeft <= 2 ? "warn" : "ok";
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <AlertDialogContent className="max-w-[min(100%,24rem)] gap-0 border-white/12 bg-[#121212] p-5 text-white sm:rounded-2xl">
        <AlertDialogTitle className="font-heading text-xl text-white">
          Ten tydzień
        </AlertDialogTitle>
        <AlertDialogDescription className="mt-1 text-sm text-white/50">
          Szybki przegląd na dziś — kcal, treningi i rytm raportu.
        </AlertDialogDescription>

        <div className="mt-5 space-y-3.5">
          <ProgressRow
            label="Zjedzone dziś"
            valueText={kcalText}
            ratio={kcalRatio}
            tone={kcalTone}
          />
          <ProgressRow
            label="Treningi"
            valueText={trainText}
            ratio={trainRatio}
            tone={trainTone}
          />
          <ProgressRow
            label="Raport"
            valueText={reportText}
            ratio={reportRatio}
            tone={reportTone}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={cta.href}
            onClick={dismiss}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--gym-gold)] text-sm font-semibold text-black shadow-[0_4px_16px_rgba(235,196,74,0.28)]"
          >
            {cta.label}
          </Link>
          <AlertDialogClose
            onClick={dismiss}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/12 bg-transparent text-sm font-medium text-white/70"
          >
            Później
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
