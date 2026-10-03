"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { WeightAverageChart } from "@/components/progress/weight-average-chart";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import { saveFitnessGoalsAction } from "@/actions/fitness-goals";
import type { ProgressHubData } from "@/lib/progress-hub";
import { calendarWeekdaySun0 } from "@/lib/local-date";
import { cn } from "@/lib/utils";

const WEEKDAY = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"] as const;

const MEASURE_COLORS: Record<string, string> = {
  waist: "#4ade80",
  thigh: "#c9a84a",
  chest: "rgba(255,255,255,0.75)",
  arm: "rgba(255,255,255,0.75)",
};

function fmtKg(n: number | null, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtSigned(n: number | null, suffix: string, digits = 1): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n).toLocaleString("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}${abs}${suffix}`;
}

function formatDayMonth(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function raportowLabel(n: number): string {
  if (n === 1) return "1 raport";
  if (n >= 2 && n <= 4) return `${n} raporty`;
  return `${n} raportów`;
}

function etaLabel(input: {
  currentKg: number | null;
  targetKg: number;
  kgPerWeek: number | null;
}): string | null {
  const { currentKg, targetKg, kgPerWeek } = input;
  if (currentKg == null || kgPerWeek == null || Math.abs(kgPerWeek) < 0.01) {
    return null;
  }
  const delta = targetKg - currentKg;
  // Tempo musi iść w stronę celu.
  if (delta === 0) return "Cel osiągnięty";
  if ((delta < 0 && kgPerWeek >= 0) || (delta > 0 && kgPerWeek <= 0)) {
    return "Przy obecnym tempie cel się oddala";
  }
  const weeks = Math.abs(delta / kgPerWeek);
  if (!Number.isFinite(weeks) || weeks > 520) return null;
  const days = Math.round(weeks * 7);
  const when = new Date();
  when.setDate(when.getDate() + days);
  const dateStr = when.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (weeks < 1.5) return `Około ${days} dni (${dateStr})`;
  const w = Math.round(weeks);
  return `Za ok. ${w} tyg. · ${dateStr}`;
}

export function BodyTab({ data }: { data: ProgressHubData["body"] }) {
  const { weights, tempo, measures, targetWeightKg } = data;
  const router = useRouter();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(
    targetWeightKg != null ? String(targetWeightKg).replace(".", ",") : "",
  );
  const [goalError, setGoalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pace = tempo.kgPerWeekLast6 ?? tempo.kgPerWeekFromStart;
  const eta = useMemo(
    () =>
      targetWeightKg != null
        ? etaLabel({
            currentKg: tempo.currentKg,
            targetKg: targetWeightKg,
            kgPerWeek: pace,
          })
        : null,
    [targetWeightKg, tempo.currentKg, pace],
  );

  const lastLine = useMemo(() => {
    if (!tempo.lastReportDate || tempo.currentKg == null) return null;
    const dow = WEEKDAY[calendarWeekdaySun0(tempo.lastReportDate)] ?? "";
    const avg =
      tempo.lastAvgKg != null
        ? ` · średnia ${fmtKg(tempo.lastAvgKg)}`
        : "";
    return `${dow} ${formatDayMonth(tempo.lastReportDate)} · ${fmtKg(tempo.currentKg, 0)} kg${avg}`;
  }, [tempo]);

  function saveGoal() {
    setGoalError(null);
    const raw = goalDraft.replace(",", ".").trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 30 || n > 400) {
      setGoalError("Podaj wagę docelową (30–400 kg).");
      return;
    }
    startTransition(async () => {
      const res = await saveFitnessGoalsAction({
        targetWeightKg: Math.round(n * 10) / 10,
      });
      if (!res.ok) {
        setGoalError(res.error);
        return;
      }
      setEditingGoal(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.16)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Ostatni raport
          {tempo.lastReportDate
            ? ` · ${formatDayMonth(tempo.lastReportDate)}`
            : ""}
        </p>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            {tempo.currentKg != null ? (
              <p className="flex items-baseline gap-1.5">
                <AnimatedMetric
                  value={tempo.currentKg}
                  decimals={1}
                  className="text-[2.5rem] leading-none text-white"
                />
                <span className="font-metric text-lg text-white/50">kg</span>
              </p>
            ) : (
              <p className="font-metric text-3xl text-white/35">—</p>
            )}
            {lastLine ? (
              <p className="mt-2 text-[11px] text-white/45">{lastLine}</p>
            ) : (
              <p className="mt-2 text-[11px] text-white/40">
                Brak raportów wagi — dodaj pierwszy w Raportach.
              </p>
            )}
          </div>
          <div className="pt-1 text-right">
            <p className="font-metric text-[22px] leading-none text-white">
              {fmtSigned(tempo.deltaFromStartKg, " kg", 0)}
            </p>
            <p className="mt-1 text-[11px] text-white/40">od startu</p>
            <p className="mt-2 text-[12px] text-[var(--gym-gold)]/85">
              {fmtSigned(tempo.kgPerWeekLast6, " kg/tydz.", 2)}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <WeightAverageChart weights={weights} />
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-white/40">
          Kropki to raporty, linia to średnia z ostatnich raportów.
        </p>
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          index={1}
          title="Tempo"
          trailing={raportowLabel(tempo.reportCount)}
          titleTone="white"
        />
        <div className="overflow-hidden app-panel divide-y divide-white/[0.06]">
          {(
            [
              {
                label: "Ostatnie 6 tygodni",
                value: fmtSigned(tempo.kgPerWeekLast6, " kg/tydz.", 2),
              },
              {
                label: "Od startu",
                value: fmtSigned(tempo.kgPerWeekFromStart, " kg/tydz.", 2),
              },
              {
                label: "Od poprzedniego raportu",
                value: fmtSigned(tempo.deltaVsPrevKg, " kg", 1),
              },
              {
                label: `Start${
                  tempo.startDate ? ` · ${formatDayMonth(tempo.startDate)}` : ""
                }`,
                value:
                  tempo.startKg != null ? `${fmtKg(tempo.startKg, 0)} kg` : "—",
              },
            ] as const
          ).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-3.5 py-3.5"
            >
              <p className="text-[13px] text-white/80">{row.label}</p>
              <p className="shrink-0 font-metric text-[15px] tabular-nums text-[var(--gym-gold)]">
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={2} title="Cel" titleTone="white" />
        <div className="app-card flex items-start gap-3 px-3.5 py-3.5">
          <div className="min-w-0 flex-1">
            {targetWeightKg != null && !editingGoal ? (
              <>
                <p className="text-[15px] font-semibold text-white">
                  Cel:{" "}
                  <span className="font-metric text-[var(--gym-gold)]">
                    {fmtKg(targetWeightKg, 1)} kg
                  </span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                  {eta ??
                    "Ustaw tempo z raportów, żebym policzył termin osiągnięcia celu."}
                </p>
              </>
            ) : editingGoal ? (
              <div className="space-y-2">
                <p className="text-[12px] text-white/45">
                  Wpisz wagę docelową (kg).
                </p>
                <input
                  inputMode="decimal"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="np. 65"
                  className="h-11 w-full max-w-[160px] rounded-xl border border-white/15 bg-black/40 px-3 font-metric text-lg text-white outline-none focus:border-[var(--gym-gold)]/50"
                  autoFocus
                />
                {goalError ? (
                  <p className="text-xs text-rose-300">{goalError}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-white/70">
                Wpisz wagę docelową, a policzę, kiedy ją osiągniesz przy
                obecnym tempie.
              </p>
            )}
          </div>
          {editingGoal ? (
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={saveGoal}
                disabled={pending}
                className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)] disabled:opacity-50"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingGoal(false);
                  setGoalError(null);
                }}
                className="text-[11px] text-white/40"
              >
                Anuluj
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setGoalDraft(
                  targetWeightKg != null
                    ? String(targetWeightKg).replace(".", ",")
                    : "",
                );
                setEditingGoal(true);
              }}
              className="shrink-0 pt-0.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
            >
              Ustaw
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          index={3}
          title="Obwody"
          trailing="od startu"
          titleTone="white"
        />
        <div className="overflow-hidden app-panel divide-y divide-white/[0.06]">
          {measures.every((m) => m.currentCm == null) ? (
            <p className="px-3.5 py-8 text-center text-sm text-white/45">
              Dodaj obwody w raporcie, żeby zobaczyć trendy.
            </p>
          ) : (
            measures.map((row) => {
              const color = MEASURE_COLORS[row.key] ?? "#ebc44a";
              const improved =
                row.deltaFromStartCm != null &&
                Math.abs(row.deltaFromStartCm) >= 0.05 &&
                (row.lowerIsBetter
                  ? row.deltaFromStartCm < 0
                  : row.deltaFromStartCm > 0);
              const deltaTone =
                row.deltaFromStartCm == null ||
                Math.abs(row.deltaFromStartCm) < 0.05
                  ? "text-white/35"
                  : improved
                    ? "text-emerald-400"
                    : row.key === "thigh"
                      ? "text-[var(--gym-gold)]"
                      : "text-white/70";

              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 px-3.5 py-3.5"
                >
                  <p className="text-[13px] font-semibold text-white/85">
                    {row.label}
                  </p>
                  <MiniSparkline
                    values={
                      row.spark.length >= 2 ? row.spark : row.spark.concat(row.spark)
                    }
                    color={color}
                    className="h-9 w-full"
                  />
                  <div className="min-w-[4.5rem] text-right">
                    {row.currentCm != null ? (
                      <>
                        <p className="font-metric text-[17px] tabular-nums text-white">
                          {fmtKg(row.currentCm, row.currentCm % 1 ? 1 : 0)}
                          <span className="ml-1 text-[11px] text-white/40">
                            cm
                          </span>
                        </p>
                        <p className={cn("mt-0.5 text-[12px]", deltaTone)}>
                          {fmtSigned(row.deltaFromStartCm, " cm", 1)}
                        </p>
                      </>
                    ) : (
                      <p className="font-metric text-lg text-white/30">—</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
