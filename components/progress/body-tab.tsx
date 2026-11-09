"use client";

import { BRAND_GOLD } from "@/lib/brand-colors";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoCompareSection } from "@/components/progress/photos-tab";
import {
  Definition,
  InteractiveLineChart,
  RangeChips,
  toneClass,
  type Tone,
} from "@/components/progress/progress-charts";
import { ProgressSection, Surface } from "@/components/progress/progress-ui";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import { saveFitnessGoalsAction } from "@/actions/fitness-goals";
import { GOAL_TYPE_LABEL, type GoalType } from "@/lib/goal-projection";
import type { ProgressHubData } from "@/lib/progress-hub";
import { calendarDateKey, calendarWeekdaySun0 } from "@/lib/local-date";
import { filterByRange, type ChartRange } from "@/lib/progress-view";
import {
  fmtNum,
  fmtSigned,
  formatDayMonth,
  plural,
} from "@/lib/progress-format";
import { cn } from "@/lib/utils";

const WEIGHT_RANGES = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "all", label: "Od początku" },
] as const;

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
    return "W tym tempie cel się oddala";
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
 * Sylwetka = waga → wykres i tempo → obwody → zdjęcia na żądanie.
 * Zakładka Zdjęcia została tu włączona: wcześniej waga i pas „od startu”
 * były pokazane w trzech miejscach (hero, tempo, zdjęcia).
 */
export function BodyTab({ body }: { body: ProgressHubData["body"] }) {
  const { weights, tempo, measures, targetWeightKg, goalType, goalDeadline } = body;
  const router = useRouter();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(
    targetWeightKg != null ? String(targetWeightKg).replace(".", ",") : "",
  );
  const [goalTypeDraft, setGoalTypeDraft] = useState<GoalType | "">(goalType ?? "");
  const [deadlineDraft, setDeadlineDraft] = useState(goalDeadline ?? "");
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
        ...(goalTypeDraft ? { goalType: goalTypeDraft } : {}),
        ...(deadlineDraft ? { goalDeadline: deadlineDraft } : {}),
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

  const [range, setRange] = useState<ChartRange>("3M");
  const [selRaw, setSelRaw] = useState<number | null>(null);
  const today = calendarDateKey();
  const shown = useMemo(() => filterByRange(weights, range, today), [weights, range, today]);
  const sel = selRaw == null ? shown.length - 1 : Math.min(selRaw, shown.length - 1);
  const cur = shown[sel];
  const prevPt = sel > 0 ? shown[sel - 1] : null;
  const diff = cur && prevPt ? Math.round((cur.kg - prevPt.kg) * 10) / 10 : null;
  const towardGoal = (d: number) =>
    targetWeightKg != null && tempo.currentKg != null
      ? (targetWeightKg < tempo.currentKg ? d < 0 : d > 0)
      : null;
  const diffTone: Tone =
    diff == null || diff === 0 ? "flat" : towardGoal(diff) === false ? "down" : towardGoal(diff) === true ? "up" : "flat";
  const labels = shown.map((w) => formatDayMonth(w.date));

  return (
    <div className="space-y-3.5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-4 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Waga{cur ? ` w dniu: ${formatDayMonth(cur.date)}` : ""}
        </h2>
        {cur ? (
          <>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="font-metric text-[72px] leading-none text-white">{fmtNum(cur.kg, 1)}</span>
              <span className="text-[16px] text-[var(--gym-text-secondary)]">kg</span>
            </p>
            <p className={cn("text-[15px]", toneClass(diffTone))}>
              {diff == null
                ? "pierwszy pomiar w tym zakresie"
                : `${diff > 0 ? "▲" : diff < 0 ? "▼" : "="} ${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} kg względem poprzedniego pomiaru`}
            </p>
            <InteractiveLineChart
              values={shown.map((w) => w.kg)}
              labels={labels}
              selected={sel}
              onSelect={setSelRaw}
              unit="kg"
              decimals={1}
              goal={targetWeightKg != null ? { value: targetWeightKg, label: `cel ${fmtNum(targetWeightKg, 1)} kg` } : undefined}
              subject="Waga"
              ariaLabel={`Waga, zakres ${range}: od ${fmtNum(shown[0]!.kg, 1)} do ${fmtNum(shown[shown.length - 1]!.kg, 1)} kg${targetWeightKg != null ? `, cel ${fmtNum(targetWeightKg, 1)} kg` : ""}`}
              prevLabel="Poprzedni pomiar"
              nextLabel="Następny pomiar"
            />
          </>
        ) : (
          <p className="mt-3 text-[15px] leading-snug text-white">
            Nie ma ważeń z tego okresu. Dodaj ważenie w zakładce Raporty albo wybierz dłuższy okres.
          </p>
        )}
        <div className="mt-3">
          <RangeChips
            value={range}
            onChange={(r) => {
              setRange(r);
              setSelRaw(null);
            }}
            options={WEIGHT_RANGES}
          />
        </div>
        <Definition className="mt-3.5">
          <b className="text-white">Jak szybko:</b>{" "}
          {pace != null
            ? `${fmtSigned(pace, " kg", 2)} na tydzień (${tempo.kgPerWeekLast6 != null ? "średnio z ostatnich 6 tygodni" : "średnio od początku"}).`
            : "Za mało ważeń, żeby policzyć tempo."}{" "}
          {targetWeightKg != null ? (
            <>Cel {fmtNum(targetWeightKg, 1)} kg: {eta ?? "dodaj kolejne ważenia, a policzymy termin."}</>
          ) : null}
        </Definition>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-metric text-[26px] leading-none text-white">{fmtSigned(tempo.deltaFromStartKg, "", 1)}</div>
            <div className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">kg od początku{tempo.startDate ? ` (${formatDayMonth(tempo.startDate)})` : ""}</div>
          </div>
          <div>
            <div className="font-metric text-[26px] leading-none text-white">{fmtSigned(tempo.deltaVsPrevKg, "", 1)}</div>
            <div className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">kg od ostatniego ważenia</div>
          </div>
          <div>
            <div className="font-metric text-[26px] leading-none text-white">{tempo.reportCount}</div>
            <div className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">{plural(tempo.reportCount, "ważenie", "ważenia", "ważeń")}{lastLine ? `, ostatni ${lastLine}` : ""}</div>
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          {editingGoal ? (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11px] text-white/50">
                  Wpisz wagę docelową (kg).
                </p>
                <input
                  inputMode="decimal"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="np. 65"
                  className="h-10 w-full max-w-[160px] rounded-xl border border-white/15 bg-black/40 px-3 font-heading text-[16px] text-white outline-none focus:border-[var(--gym-gold)]/50"
                  autoFocus
                />
                <select
                  value={goalTypeDraft}
                  onChange={(e) => setGoalTypeDraft(e.target.value as GoalType | "")}
                  aria-label="Typ celu"
                  className="h-10 w-full max-w-[200px] rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white outline-none"
                >
                  <option value="">Typ celu (opcjonalnie)</option>
                  {(Object.keys(GOAL_TYPE_LABEL) as GoalType[]).map((t) => (
                    <option key={t} value={t}>
                      {GOAL_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={deadlineDraft}
                  onChange={(e) => setDeadlineDraft(e.target.value)}
                  aria-label="Termin celu"
                  className="h-10 w-full max-w-[200px] rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white outline-none"
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
                  className="text-[11px] text-white/50"
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
                    <p className="mt-0.5 text-[11px] leading-snug text-white/50">
                      {eta ??
                        "Dodaj kolejne ważenia, a policzymy, kiedy osiągniesz cel."}
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

      </section>

      <ProgressSection title="Wymiary ciała" trailing="zmiana od pierwszego pomiaru">
        <Surface variant="list">
          {measures.every((m) => m.currentCm == null) ? (
            <p className="px-3.5 py-5 text-center text-[13px] text-white/50">
              Dodaj obwody w raporcie, żeby zobaczyć trendy.
            </p>
          ) : (
            measures.map((row) => {
              const color = MEASURE_COLORS[row.key] ?? BRAND_GOLD;
              const improved =
                row.deltaFromStartCm != null &&
                Math.abs(row.deltaFromStartCm) >= 0.05 &&
                (row.lowerIsBetter
                  ? row.deltaFromStartCm < 0
                  : row.deltaFromStartCm > 0);
              const deltaTone =
                row.deltaFromStartCm == null ||
                Math.abs(row.deltaFromStartCm) < 0.05
                  ? "text-white/50"
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
                        <p className="font-heading text-[15px] leading-none tabular-nums text-white">
                          {fmtNum(row.currentCm, row.currentCm % 1 ? 1 : 0)}
                          <span className="ml-0.5 text-[10px] text-white/50">
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
                      <p className="font-heading text-[15px] text-white/50">—</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Surface>
      </ProgressSection>

      <section className="app-panel px-4 py-4" aria-labelledby="h-zdj">
        <h2 id="h-zdj" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Zdjęcia: start i teraz
        </h2>
        <PhotoCompareSection />
      </section>
    </div>
  );
}
