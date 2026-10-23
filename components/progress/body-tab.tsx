"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { WeightAverageChart } from "@/components/progress/weight-average-chart";
import { PhotoCompareSection } from "@/components/progress/photos-tab";
import {
  Explainer,
  Eyebrow,
  ProgressSection,
  StatTile,
  Surface,
} from "@/components/progress/progress-ui";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import { saveFitnessGoalsAction } from "@/actions/fitness-goals";
import type { ProgressHubData } from "@/lib/progress-hub";
import { calendarWeekdaySun0 } from "@/lib/local-date";
import {
  fmtNum,
  fmtSigned,
  formatDayMonth,
  plural,
} from "@/lib/progress-format";
import { cn } from "@/lib/utils";

const WEEKDAY = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"] as const;

const MEASURE_COLORS: Record<string, string> = {
  waist: "#4ade80",
  thigh: "#c9a84a",
  chest: "rgba(255,255,255,0.75)",
  arm: "rgba(255,255,255,0.75)",
};

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

/**
 * Sylwetka = waga (z celem) → tempo → obwody → zdjęcia.
 * Zakładka Zdjęcia została tu włączona: wcześniej waga i pas „od startu”
 * były pokazane w trzech miejscach (hero, tempo, zdjęcia).
 */
export function BodyTab({
  body,
  photos,
}: {
  body: ProgressHubData["body"];
  photos: ProgressHubData["photos"];
}) {
  const { weights, tempo, measures, targetWeightKg } = body;
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
      tempo.lastAvgKg != null ? ` · średnia ${fmtNum(tempo.lastAvgKg, 1)}` : "";
    return `${dow} ${formatDayMonth(tempo.lastReportDate)}${avg}`;
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

  function openGoalEditor() {
    setGoalDraft(
      targetWeightKg != null ? String(targetWeightKg).replace(".", ",") : "",
    );
    setEditingGoal(true);
  }

  return (
    <div className="space-y-3.5">
      <Surface variant="hero" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow gold>
              Ostatni raport
              {tempo.lastReportDate ? ` · ${formatDayMonth(tempo.lastReportDate)}` : ""}
            </Eyebrow>
            {tempo.currentKg != null ? (
              <p className="mt-2 flex items-baseline gap-1.5">
                <AnimatedMetric
                  value={tempo.currentKg}
                  decimals={1}
                  className="text-[2rem] leading-none text-white"
                />
                <span className="font-metric text-[15px] text-white/50">kg</span>
              </p>
            ) : (
              <p className="mt-2 font-metric text-[2rem] leading-none text-white/35">
                —
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-snug text-white/45">
              {lastLine ?? "Brak raportów wagi — dodaj pierwszy w Raportach."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-metric text-[18px] leading-none tabular-nums text-white">
              {fmtSigned(tempo.deltaFromStartKg, " kg", 1)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              od startu
            </p>
            {tempo.startKg != null ? (
              <p className="mt-1 text-[11px] tabular-nums text-white/40">
                {fmtNum(tempo.startKg, 1)} kg · {formatDayMonth(tempo.startDate)}
              </p>
            ) : null}
          </div>
        </div>

        <WeightAverageChart weights={weights} />

        <div className="border-t border-white/10 pt-2.5">
          {editingGoal ? (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] text-white/45">
                  Wpisz wagę docelową (kg).
                </p>
                <input
                  inputMode="decimal"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="np. 65"
                  className="h-10 w-full max-w-[160px] rounded-xl border border-white/15 bg-black/40 px-3 font-metric text-[16px] text-white outline-none focus:border-[var(--gym-gold)]/50"
                  autoFocus
                />
                {goalError ? (
                  <p className="text-[11px] text-rose-300">{goalError}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={saveGoal}
                  disabled={pending}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)] disabled:opacity-50"
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
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {targetWeightKg != null ? (
                  <>
                    <p className="text-[13px] font-semibold leading-snug text-white">
                      Cel:{" "}
                      <span className="font-metric text-[var(--gym-gold)]">
                        {fmtNum(targetWeightKg, 1)} kg
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                      {eta ??
                        "Dodaj kolejne raporty, żeby policzyć termin osiągnięcia celu."}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] leading-snug text-white/60">
                    Wpisz wagę docelową, a policzę, kiedy ją osiągniesz przy
                    obecnym tempie.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={openGoalEditor}
                className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]"
              >
                {targetWeightKg != null ? "Zmień" : "Ustaw"}
              </button>
            </div>
          )}
        </div>

        <Explainer>
          <p>Kropki to raporty, linia to średnia z ostatnich raportów.</p>
        </Explainer>
      </Surface>

      <ProgressSection
        title="Tempo"
        trailing={`${tempo.reportCount} ${plural(tempo.reportCount, "raport", "raporty", "raportów")}`}
      >
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="6 tygodni"
            value={fmtSigned(tempo.kgPerWeekLast6, "", 2)}
            hint="kg / tydzień"
          />
          <StatTile
            label="Od startu"
            value={fmtSigned(tempo.kgPerWeekFromStart, "", 2)}
            hint="kg / tydzień"
          />
          <StatTile
            label="Ostatni raport"
            value={fmtSigned(tempo.deltaVsPrevKg, "", 1)}
            hint="kg vs poprzedni"
          />
        </div>
      </ProgressSection>

      <ProgressSection title="Obwody" trailing="od startu">
        <Surface variant="list">
          {measures.every((m) => m.currentCm == null) ? (
            <p className="px-3.5 py-5 text-center text-[13px] text-white/45">
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
                    : "text-white/70";

              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[4.25rem_1fr_4.75rem] items-center gap-2.5 px-3.5 py-2.5"
                >
                  <p className="text-[13px] font-semibold leading-snug text-white/85">
                    {row.label}
                  </p>
                  <MiniSparkline
                    values={
                      row.spark.length >= 2
                        ? row.spark
                        : row.spark.concat(row.spark)
                    }
                    color={color}
                    className="h-8 w-full"
                  />
                  <div className="text-right">
                    {row.currentCm != null ? (
                      <>
                        <p className="font-metric text-[15px] leading-none tabular-nums text-white">
                          {fmtNum(row.currentCm, row.currentCm % 1 ? 1 : 0)}
                          <span className="ml-0.5 text-[10px] text-white/40">
                            cm
                          </span>
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-[11px] leading-none tabular-nums",
                            deltaTone,
                          )}
                        >
                          {fmtSigned(row.deltaFromStartCm, " cm", 1)}
                        </p>
                      </>
                    ) : (
                      <p className="font-metric text-[15px] text-white/30">—</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Surface>
      </ProgressSection>

      <PhotoCompareSection data={photos} />
    </div>
  );
}
