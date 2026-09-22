"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { saveBodyReportIntervalAction } from "@/actions/body-report-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  BODY_REPORT_INTERVAL_DAYS,
  BODY_REPORT_INTERVAL_MAX,
  BODY_REPORT_INTERVAL_MIN,
  clampBodyReportIntervalDays,
  formatDaysUntilLabel,
} from "@/lib/body-report-schedule";

export function BodyReportIntervalCard({
  initialIntervalDays,
}: {
  initialIntervalDays?: number | null;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [days, setDays] = useState(() =>
    clampBodyReportIntervalDays(
      initialIntervalDays ?? BODY_REPORT_INTERVAL_DAYS,
    ),
  );

  const rangePct = useMemo(() => {
    const span = BODY_REPORT_INTERVAL_MAX - BODY_REPORT_INTERVAL_MIN;
    const pct = ((days - BODY_REPORT_INTERVAL_MIN) / span) * 100;
    return `${Math.min(100, Math.max(0, pct))}%`;
  }, [days]);

  const unit = formatDaysUntilLabel(days);

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(640px_260px_at_100%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Raporty
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">
              Cykl raportu ciała
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Ustaw, co ile dni ma powstawać kolejny raport. Odliczanie na ekranie Start
              korzysta z tej wartości.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <ClipboardList className="h-5 w-5 text-[var(--neon)]" />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="body-report-interval" className="text-sm font-medium text-white/85">
              Co ile dni raport
            </Label>
            <p className="shrink-0 tabular-nums text-sm font-semibold text-[var(--neon)]">
              {days} {unit}
            </p>
          </div>
          <input
            id="body-report-interval"
            type="range"
            min={BODY_REPORT_INTERVAL_MIN}
            max={BODY_REPORT_INTERVAL_MAX}
            step={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="score-range mt-3 block w-full"
            style={{ "--range-pct": rangePct } as CSSProperties}
            aria-label="Co ile dni tworzyć raport ciała"
            aria-valuemin={BODY_REPORT_INTERVAL_MIN}
            aria-valuemax={BODY_REPORT_INTERVAL_MAX}
            aria-valuenow={days}
            aria-valuetext={`${days} ${unit}`}
          />
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-white/35">
            <span>{BODY_REPORT_INTERVAL_MIN} dni</span>
            <span>{BODY_REPORT_INTERVAL_MAX} dni</span>
          </div>
        </div>

        <Button
          type="button"
          variant="cta"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            start(async () => {
              const r = await saveBodyReportIntervalAction({ intervalDays: days });
              if (r.ok) {
                notifySaved(`Zapisano cykl: co ${r.intervalDays} ${formatDaysUntilLabel(r.intervalDays)}.`);
                router.refresh();
              } else {
                notifyError(r.error ?? "Nie udało się zapisać cyklu raportu.");
              }
            });
          }}
        >
          {pending ? "Zapisywanie…" : "Zapisz cykl raportu"}
        </Button>
      </div>
    </section>
  );
}
