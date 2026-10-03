import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { WeightAverageChart } from "@/components/progress/weight-average-chart";
import type { ProgressHubData } from "@/lib/progress-hub";

function fmtDelta(n: number | null, suffix = " kg"): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}${suffix}`;
}

export function BodyTab({ data }: { data: ProgressHubData["body"] }) {
  const { weights, tempo } = data;

  return (
    <div className="space-y-5">
      <section className="app-card space-y-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Waga
            </p>
            <p className="mt-1 text-xs text-white/40">
              Kropki = raporty · linia = średnia krocząca
            </p>
          </div>
          {tempo.currentKg != null ? (
            <div className="text-right">
              <AnimatedMetric
                value={tempo.currentKg}
                decimals={1}
                className="text-3xl text-white"
              />
              <p className="text-[10px] uppercase tracking-wider text-white/35">kg</p>
            </div>
          ) : null}
        </div>
        <WeightAverageChart weights={weights} />
      </section>

      <section className="space-y-3">
        <SectionLabel index="01" title="Tempo" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="app-card px-3.5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Ostatnie 6 tyg.
            </p>
            <p className="mt-2 font-metric text-2xl tabular-nums text-white">
              {tempo.kgPerWeekLast6 != null ? (
                <>
                  <AnimatedMetric value={tempo.kgPerWeekLast6} decimals={2} />
                  <span className="ml-1 text-sm text-white/40">kg/tydz</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="app-card px-3.5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Od startu
            </p>
            <p className="mt-2 font-metric text-2xl tabular-nums text-white">
              {tempo.kgPerWeekFromStart != null ? (
                <>
                  <AnimatedMetric value={tempo.kgPerWeekFromStart} decimals={2} />
                  <span className="ml-1 text-sm text-white/40">kg/tydz</span>
                </>
              ) : (
                "—"
              )}
            </p>
            {tempo.weeksFromStart != null ? (
              <p className="mt-1 text-[11px] text-white/35">
                {tempo.weeksFromStart.toLocaleString("pl-PL")} tyg.
              </p>
            ) : null}
          </div>
          <div className="app-card px-3.5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Vs poprzedni
            </p>
            <p className="mt-2 font-metric text-2xl tabular-nums text-white">
              {fmtDelta(tempo.deltaVsPrevKg)}
            </p>
          </div>
          <div className="app-card px-3.5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Start → teraz
            </p>
            <p className="mt-2 text-sm text-white/70">
              {tempo.startKg != null ? (
                <span className="font-metric text-lg text-white">
                  {tempo.startKg.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}
                </span>
              ) : (
                "—"
              )}
              <span className="mx-1.5 text-white/30">→</span>
              {tempo.currentKg != null ? (
                <span className="font-metric text-lg text-white">
                  {tempo.currentKg.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}
                </span>
              ) : (
                "—"
              )}
              <span className="ml-1 text-white/35">kg</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
