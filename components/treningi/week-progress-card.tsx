import type { TreningiHubDay } from "@/lib/treningi-hub-data";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import {
  formatCardioSessions,
  formatWeekSegmentLabel,
} from "@/lib/treningi-hub-format";
import { cn } from "@/lib/utils";

/** Powyżej tylu dni segmenty mają węższy odstęp (mieszczą się w 320 px). */
const WIDE_GAP_MAX_DAYS = 12;

const metricLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60";
const metricValueClass =
  "font-metric text-[26px] leading-none tabular-nums text-white";

function segmentClass(done: boolean, next: boolean): string {
  if (done && next) {
    return "bg-[var(--gym-gold)] ring-[1.5px] ring-[var(--gym-gold)]/60 ring-offset-2 ring-offset-[var(--gym-surface)]";
  }
  if (done) return "bg-[var(--gym-gold)]";
  if (next) return "bg-transparent shadow-[inset_0_0_0_1.5px_var(--gym-gold)]";
  return "bg-white/10";
}

export function WeekProgressCard({
  days,
  nextPlanId,
  cardioMinutes,
  cardioSessions,
}: {
  days: readonly TreningiHubDay[];
  nextPlanId: string | null;
  cardioMinutes: number;
  cardioSessions: number;
}) {
  const total = days.length;
  const done = days.filter((d) => d.doneThisWeek).length;
  const hasPlan = total > 0;

  return (
    <section className="app-card p-4" aria-labelledby="week-card-title">
      <h2 id="week-card-title" className="sr-only">
        Ten tydzień
      </h2>
      <div className={cn("grid gap-3", hasPlan ? "grid-cols-2" : "grid-cols-1")}>
        {hasPlan ? (
          <div>
            <p className={metricLabelClass}>Siłownia</p>
            <p className="mt-2">
              <AnimatedMetric value={done} className={metricValueClass} />{" "}
              <span className="text-[17px] tabular-nums text-white/60">
                / {total}
              </span>
            </p>
          </div>
        ) : null}
        <div className={hasPlan ? "border-l border-white/[0.06] pl-3" : undefined}>
          <p className={metricLabelClass}>Cardio</p>
          <p className="mt-2">
            <AnimatedMetric value={cardioMinutes} className={metricValueClass} />{" "}
            <span className="text-[17px] text-white/60">min</span>
          </p>
          <p className="mt-1 text-[13px] tabular-nums text-white/60">
            {formatCardioSessions(cardioSessions)}
          </p>
        </div>
      </div>
      {hasPlan ? (
        <ol
          className={cn(
            "mt-4 flex",
            total > WIDE_GAP_MAX_DAYS ? "gap-1" : "gap-1.5",
          )}
          aria-label="Dni planu w tym tygodniu"
        >
          {days.map((d) => {
            const next = d.row.id === nextPlanId;
            return (
              <li
                key={d.row.id}
                className={cn(
                  "h-2 min-w-[6px] flex-1 rounded-full",
                  segmentClass(d.doneThisWeek, next),
                )}
              >
                <span className="sr-only">
                  {formatWeekSegmentLabel(d.row.dayNumber, d.doneThisWeek, next)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
