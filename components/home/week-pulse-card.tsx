import Link from "next/link";
import { cn } from "@/lib/utils";

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

/**
 * Sticky podsumowanie tygodnia na Pulpicie: kcal dziś, treningi, raport + jeden CTA.
 */
export function WeekPulseCard({
  caloriesConsumed,
  caloriesGoal,
  workoutsThisWeek,
  weeklySessionsTarget,
  reportCount,
  daysSinceLastReport,
  reportCadenceDays,
}: {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  workoutsThisWeek: number;
  weeklySessionsTarget: number;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
}) {
  const report = resolveReportStatus(
    reportCount,
    daysSinceLastReport,
    reportCadenceDays,
  );
  const cta = resolveCta({
    report,
    workoutsThisWeek,
    weeklySessionsTarget,
    caloriesConsumed,
    caloriesGoal,
  });

  const kcalText =
    caloriesGoal != null
      ? `${Math.round(caloriesConsumed)} / ${Math.round(caloriesGoal)} kcal`
      : `${Math.round(caloriesConsumed)} kcal · brak celu`;
  const kcalRatio =
    caloriesGoal != null && caloriesGoal > 0
      ? caloriesConsumed / caloriesGoal
      : null;
  const kcalTone: "ok" | "warn" | "muted" =
    caloriesGoal == null
      ? "muted"
      : caloriesConsumed <= 0
        ? "warn"
        : caloriesConsumed / caloriesGoal <= 1.15
          ? "ok"
          : "warn";

  const trainText = `${workoutsThisWeek} / ${weeklySessionsTarget}`;
  const trainRatio =
    weeklySessionsTarget > 0
      ? workoutsThisWeek / weeklySessionsTarget
      : null;
  const trainTone: "ok" | "warn" | "muted" =
    workoutsThisWeek >= weeklySessionsTarget ? "ok" : "warn";

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
      reportCadenceDays > 0
        ? 1 - report.daysLeft / reportCadenceDays
        : null;
    reportTone = report.daysLeft <= 2 ? "warn" : "ok";
  }

  return (
    <section className="rounded-[18px] border border-white/10 bg-[#161616] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Pulpit
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Ten tydzień</h2>
        </div>
      </div>

      <div className="mt-4 space-y-3.5">
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

      <Link
        href={cta.href}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--gym-gold)] text-sm font-semibold text-black shadow-[0_4px_16px_rgba(235,196,74,0.28)]"
      >
        {cta.label}
      </Link>
    </section>
  );
}
