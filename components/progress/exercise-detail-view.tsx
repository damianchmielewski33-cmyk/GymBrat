"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Definition,
  InteractiveLineChart,
  MeterRow,
  RangeChips,
  toneArrow,
  toneClass,
  type Tone,
} from "@/components/progress/progress-charts";
import type {
  ExerciseIntensitySummary,
  ExerciseMetricKind,
  ExerciseProgressPoint,
  ExercisePrs,
} from "@/lib/exercise-progress";
import type { PredictionItem, StagnationItem } from "@/lib/analytics";
import { confidenceLabelPl } from "@/lib/analytics";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { fmtNum, formatDayMonth, plural } from "@/lib/progress-format";
import { filterByRange, setE1rm, type ChartRange } from "@/lib/progress-view";
import { cn } from "@/lib/utils";

type Target = { targetKg?: number; targetReps?: number; deadline?: string } | null;

const WEEKDAY = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];

function dow(iso: string) {
  return WEEKDAY[new Date(`${iso}T12:00:00`).getDay()] ?? "";
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

function Card({ children, hero }: { children: React.ReactNode; hero?: boolean }) {
  return (
    <section
      className={
        hero
          ? "relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-4 py-4"
          : "app-panel px-4 py-4"
      }
    >
      {children}
    </section>
  );
}

function CardTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
      {children}
    </h2>
  );
}

export function ExerciseDetailView({
  name,
  points,
  prs,
  intensity,
  metric,
  repRecords = [],
  prediction = null,
  stagnation = null,
  target = null,
}: {
  name: string;
  points: ExerciseProgressPoint[];
  prs: ExercisePrs;
  intensity: ExerciseIntensitySummary;
  metric: ExerciseMetricKind;
  matchedNames?: string[];
  periodCompares?: unknown;
  repRecords?: Array<{ reps: number; weight: number; date: string }>;
  prediction?: PredictionItem | null;
  stagnation?: StagnationItem | null;
  initialPeriod?: string;
  target?: Target;
}) {
  const isReps = metric === "reps";
  const today = calendarDateKey();
  const [range, setRange] = useState<ChartRange>("3M");
  const [selRaw, setSelRaw] = useState<number | null>(null);
  const [open, setOpen] = useState<number>(0);

  const series = useMemo(
    () =>
      points
        .map((p) => ({ date: p.date, value: isReps ? p.totalReps : p.bestE1rm }))
        .filter((p) => p.value > 0),
    [points, isReps],
  );
  const shown = useMemo(() => filterByRange(series, range, today), [series, range, today]);
  const sel = selRaw == null ? shown.length - 1 : Math.min(selRaw, shown.length - 1);
  const cur = shown[sel];
  const prevPt = sel > 0 ? shown[sel - 1] : null;
  const diff = cur && prevPt ? Math.round((cur.value - prevPt.value) * 10) / 10 : null;
  const tone: Tone = diff == null || diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const unit = isReps ? "powt." : "kg";
  const subject = isReps ? "Powtórzenia" : "Szacowany max";

  // Liczby obok wykresu.
  const bestPoint = useMemo(() => {
    if (isReps) return null;
    return points.reduce<ExerciseProgressPoint | null>((b, p) => (!b || p.bestE1rm > b.bestE1rm ? p : b), null);
  }, [points, isReps]);
  // Najlepsza seria = ta z najwyższym szacowanym maxem (spójna z definicją pod wykresem).
  const bestSet = useMemo(() => {
    if (!bestPoint) return null;
    const top = (bestPoint.sets ?? []).reduce<{ weight: number; reps: number; e1rm: number } | null>(
      (b, x) => (x.e1rm > 0 && (!b || x.e1rm > b.e1rm) ? x : b),
      null,
    );
    return top ?? { weight: bestPoint.bestWeight, reps: bestPoint.bestReps, e1rm: bestPoint.bestE1rm };
  }, [bestPoint]);
  const cut30 = addCalendarDays(today, -29);
  const cut60 = addCalendarDays(today, -59);
  const vol = (from: string, to: string | null) =>
    points.filter((p) => p.date >= from && (to == null || p.date < to)).reduce((a, p) => a + (isReps ? p.totalReps : p.tonnageKg), 0);
  const vol30 = vol(cut30, null);
  const volPrev = vol(cut60, cut30);
  const volPct = volPrev > 0 ? Math.round(((vol30 - volPrev) / volPrev) * 100) : null;
  const sessions28 = points.filter((p) => p.date >= addCalendarDays(today, -27)).length;
  const freq = Math.round((sessions28 / 4) * 10) / 10;

  // Cel.
  const goalE1rm = target?.targetKg ? Math.round(setE1rm(target.targetKg, target.targetReps ?? 1) * 10) / 10 : null;
  const nowE1rm = series.length ? series[series.length - 1]!.value : null;
  const goalLeft = goalE1rm != null && nowE1rm != null ? Math.max(0, Math.round((goalE1rm - nowE1rm) * 10) / 10) : null;
  const pace = useMemo(() => {
    const recent = series.filter((p) => p.date >= addCalendarDays(today, -89));
    if (recent.length < 2) return null;
    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const months = (new Date(`${last.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) / (30 * 86400000);
    return months > 0.3 ? Math.round(((last.value - first.value) / months) * 10) / 10 : null;
  }, [series, today]);
  const etaTxt =
    goalLeft != null && goalLeft > 0 && pace != null && pace > 0
      ? new Date(Date.now() + (goalLeft / pace) * 30 * 86400000).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })
      : null;

  // Ostatnie treningi (najnowszy pierwszy).
  const recent = useMemo(() => [...points].filter((p) => p.sets?.length || p.bestE1rm > 0 || p.totalReps > 0).slice(-5).reverse(), [points]);
  const barsData = [...recent].reverse();
  const barVals = barsData.map((p) => (isReps ? p.totalReps : p.bestE1rm));
  const bMin = barVals.length ? Math.min(...barVals) * 0.92 : 0;
  const bMax = barVals.length ? Math.max(...barVals) : 1;

  const empty = series.length === 0;

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-10">
      <Link href="/progress?tab=sila" className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--gym-gold-bright)]">
        ← Siła
      </Link>

      <Card hero>
        <h1 translate="no" className="text-[22px] font-semibold text-white">{name}</h1>
        {empty ? (
          <p className="mt-3 text-[15px] leading-snug text-white">
            Nie ma jeszcze zapisanych serii tego ćwiczenia. Wykonaj je w treningu, a pojawi się tutaj wykres.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-[13px] text-[var(--gym-text-secondary)]">
              {subject} w dniu: {cur ? formatDayMonth(cur.date) : "—"}
            </p>
            {cur ? (
              <>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-metric text-[72px] leading-none text-white">{fmtNum(cur.value, isReps ? 0 : 0)}</span>
                  <span className="text-[16px] text-[var(--gym-text-secondary)]">{unit}</span>
                </p>
                <p className={cn("text-[15px]", toneClass(tone))}>
                  {diff == null
                    ? "pierwszy punkt wykresu"
                    : `${toneArrow(tone)} ${sign(diff)}${fmtNum(Math.abs(diff), 0)} ${unit} względem poprzedniego punktu`}
                </p>
                <InteractiveLineChart
                  values={shown.map((p) => p.value)}
                  labels={shown.map((p) => formatDayMonth(p.date))}
                  selected={sel}
                  onSelect={setSelRaw}
                  unit={unit}
                  subject={subject}
                  ariaLabel={`${subject}, ${name}, zakres ${range}: od ${fmtNum(shown[0]!.value, 0)} do ${fmtNum(shown[shown.length - 1]!.value, 0)} ${unit}`}
                />
              </>
            ) : (
              <p className="mt-3 text-[14px] text-[var(--gym-text-secondary)]">Brak treningów w tym zakresie. Wybierz dłuższy.</p>
            )}
            <div className="mt-3">
              <RangeChips value={range} onChange={(r) => { setRange(r); setSelRaw(null); }} />
            </div>
            <Definition className="mt-3.5">
              {isReps ? (
                <><b className="text-white">Powtórzenia</b> to suma powtórzeń ze wszystkich serii w danym dniu (ćwiczenie z masą ciała).</>
              ) : (
                <>
                  <b className="text-white">Szacowany max</b> liczymy ze wzoru Epleya: ciężar × (1 + powtórzenia / 30).
                  {bestSet ? ` Najlepsza seria ${fmtNum(bestSet.weight, 1)} kg × ${bestSet.reps} daje ${fmtNum(bestSet.e1rm, 0)} kg.` : ""}
                </>
              )}
            </Definition>
          </>
        )}
      </Card>

      {!empty ? (
        <Card>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">Najlepsza seria</div>
              <div className="font-metric mt-1 text-[28px] leading-[1.1] text-white">
                {isReps ? `${prs.maxBestSetReps.value} powt.` : bestSet ? `${fmtNum(bestSet.weight, 1)} kg × ${bestSet.reps}` : "—"}
              </div>
              <div className="text-[12px] text-[var(--gym-text-secondary)]">
                {formatDayMonth(isReps ? prs.maxBestSetReps.date : bestPoint?.date)}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">{isReps ? "Powtórzenia 30 dni" : "Objętość 30 dni"}</div>
              <div className="font-metric mt-1 text-[28px] leading-[1.1] text-white">{fmtNum(vol30, 0)}{isReps ? "" : " kg"}</div>
              <div className={cn("text-[12px]", volPct == null ? "text-[var(--gym-text-secondary)]" : toneClass(volPct > 0 ? "up" : volPct < 0 ? "down" : "flat"))}>
                {volPct == null ? "brak porównania" : `${volPct > 0 ? "▲" : volPct < 0 ? "▼" : "="} ${sign(volPct)}${Math.abs(volPct)}% vs poprzednie 30 dni`}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">Częstość</div>
              <div className="font-metric mt-1 text-[28px] leading-[1.1] text-white">{fmtNum(freq, 1)} × tydz.</div>
              <div className="text-[12px] text-[var(--gym-text-secondary)]">średnia z 4 tygodni</div>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-[var(--gym-text-secondary)]">
            Objętość to suma ciężar × powtórzenia ze wszystkich serii tego ćwiczenia.
          </p>
        </Card>
      ) : null}

      {!empty ? (
        <Card>
          <CardTitle id="h-cel">Cel</CardTitle>
          {goalE1rm != null && nowE1rm != null ? (
            <div className="mt-3">
              <MeterRow
                title={`${fmtNum(target!.targetKg!, 1)} kg × ${target!.targetReps ?? 1}`}
                right={goalLeft === 0 ? "cel osiągnięty" : `zostało ${fmtNum(goalLeft!, 0)} kg szacowanego maxa`}
                pct={(nowE1rm / goalE1rm) * 100}
                note={
                  pace == null
                    ? "Za mało treningów z ostatnich 3 miesięcy, żeby policzyć tempo."
                    : pace <= 0
                      ? `Tempo ostatnich 3 miesięcy: ${sign(pace)}${fmtNum(Math.abs(pace), 1)} kg miesięcznie. Przy takim tempie cel się nie przybliża.`
                      : `Tempo ostatnich 3 miesięcy: +${fmtNum(pace, 1)} kg miesięcznie.${etaTxt ? ` Przy nim cel około ${etaTxt}.` : ""}`
                }
              />
              <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">Cel przeliczamy na szacowany max tym samym wzorem, żeby porównać go z wykresem.</p>
            </div>
          ) : (
            <p className="mt-2 text-[14px] leading-snug text-[var(--gym-text-secondary)]">
              Nie ustawiono celu dla tego ćwiczenia. Dodaj go w zakładce Podsumowanie, w sekcji Cele.
            </p>
          )}
        </Card>
      ) : null}

      {!empty && (prediction || stagnation) ? (
        <Card>
          <CardTitle id="h-prog">Prognoza i trend</CardTitle>
          <div className="mt-2 space-y-2 text-[14px] leading-snug text-white">
            {stagnation ? (
              <p>
                <b>{stagnation.statusLabel}</b>
                {stagnation.daysWithoutProgress > 0 ? `, bez wzrostu od ${stagnation.daysWithoutProgress} dni` : ""}
                {stagnation.e1rmDeltaPct30 != null ? `. Szacowany max w 30 dni: ${sign(stagnation.e1rmDeltaPct30)}${fmtNum(Math.abs(stagnation.e1rmDeltaPct30), 1)}%.` : "."}
              </p>
            ) : null}
            {prediction && !isReps ? (
              <p>
                Jeśli utrzymasz obecne tempo: za 30 dni szacowany max około <b>{fmtNum(prediction.e1rm30d, 0)} kg</b>, za 90 dni około{" "}
                <b>{fmtNum(prediction.e1rm90d, 0)} kg</b> (teraz {fmtNum(prediction.e1rmNow, 0)} kg).
              </p>
            ) : null}
          </div>
          {prediction ? (
            <p className="mt-2 text-[13px] text-[var(--gym-text-secondary)]">
              Pewność prognozy: {confidenceLabelPl(prediction.confidence)} ({prediction.sampleCount} treningów w próbie). To ekstrapolacja trendu, nie obietnica.
            </p>
          ) : null}
        </Card>
      ) : null}

      {!empty ? (
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle id="h-hist">Ostatnie treningi</CardTitle>
            <span className="text-[13px] text-[var(--gym-text-secondary)]">{isReps ? "powtórzenia z treningu" : "szac. max z treningu"}</span>
          </div>
          <div className="mb-1 mt-3.5 flex h-[90px] items-end gap-2" role="img" aria-label={`${subject} w ostatnich treningach`}>
            {barsData.map((p, i) => {
              const v = isReps ? p.totalReps : p.bestE1rm;
              const last = i === barsData.length - 1;
              return (
                <div key={p.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[12px] text-[#efe9dc]">{fmtNum(v, 0)}</span>
                  <i
                    className={cn("block w-full rounded-t-md rounded-b-sm transition-[height] duration-700", last ? "gym-meter-gold" : "bg-[#3a3524]")}
                    style={{ height: `${Math.max(8, Math.round(((v - bMin) / (bMax - bMin || 1)) * 100))}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mb-2 flex gap-2">
            {barsData.map((p) => (
              <span key={p.date} className="min-w-0 flex-1 text-center text-[12px] text-[var(--gym-text-secondary)]">{formatDayMonth(p.date)}</span>
            ))}
          </div>
          <ul>
            {recent.map((p, i) => {
              const older = recent[i + 1];
              const v = isReps ? p.totalReps : p.bestE1rm;
              const dl = older ? v - (isReps ? older.totalReps : older.bestE1rm) : null;
              const dtone: Tone = dl == null || Math.abs(dl) < 0.5 ? "flat" : dl > 0 ? "up" : "down";
              const isOpen = open === i;
              const sets = p.sets ?? [];
              const bestE = Math.max(0, ...sets.map((s) => s.e1rm));
              return (
                <li key={p.date} className="border-t border-white/[0.06] py-3 first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-white">
                        {formatDayMonth(p.date)} <span className="font-normal text-[var(--gym-text-secondary)]">· {dow(p.date)}</span>
                      </span>
                      <span className="block text-[13px] text-[var(--gym-text-secondary)]">
                        {sets.length ? `${sets.length} ${plural(sets.length, "seria", "serie", "serii")} · ` : ""}objętość {fmtNum(p.tonnageKg, 0)} kg
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="text-right">
                        <span className="font-metric block text-[30px] leading-none text-white">{fmtNum(v, 0)} {unit}</span>
                        <span className={cn("block text-[12px]", toneClass(dtone))}>
                          {dl == null ? "najstarszy w liście" : `${toneArrow(dtone)} ${sign(dl)}${fmtNum(Math.abs(dl), 0)} ${unit} vs poprzedni`}
                        </span>
                      </span>
                      <ChevronDown className={cn("h-[18px] w-[18px] shrink-0 text-[var(--gym-text-secondary)] transition-transform", isOpen && "rotate-180")} aria-hidden />
                    </span>
                  </button>
                  {sets.length ? (
                    <div className="mt-1 flex flex-wrap gap-1.5" aria-label="Serie">
                      {sets.map((s, j) => (
                        <span
                          key={j}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-[13px] text-white",
                            s.e1rm > 0 && s.e1rm === bestE ? "border-[var(--gym-gold-bright)] bg-[var(--gym-gold)]/15 font-semibold" : "border-white/10 bg-black/30",
                          )}
                        >
                          {s.weight > 0 ? `${fmtNum(s.weight, 1)} × ${s.reps}` : `${s.reps} powt.`}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isOpen && sets.length ? (
                    <div className="mt-2.5">
                      {sets.map((s, j) => (
                        <div key={j} className="flex items-baseline justify-between gap-2 border-t border-white/[0.06] py-2 text-[14px]">
                          <span>
                            Seria {j + 1}: <b>{s.weight > 0 ? `${fmtNum(s.weight, 1)} kg × ${s.reps}` : `${s.reps} powt.`}</b>
                          </span>
                          <span className="text-right text-[13px] text-[var(--gym-text-secondary)]">
                            {s.rir != null ? `zapas ${s.rir} powt.` : "zapas nie zapisany"}
                            {s.e1rm > 0 ? ` · szac. max ${fmtNum(s.e1rm, 0)} kg` : ""}
                          </span>
                        </div>
                      ))}
                      <p className="mt-1.5 text-[13px] text-[var(--gym-text-secondary)]">Zapas (RIR) to liczba powtórzeń, które jeszcze byś zrobił na koniec serii.</p>
                    </div>
                  ) : isOpen ? (
                    <p className="mt-2 text-[13px] text-[var(--gym-text-secondary)]">Ten trening nie ma zapisanych pojedynczych serii.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">Złota ramka oznacza serię z najwyższym szacowanym maxem.</p>
        </Card>
      ) : null}

      {!empty && (intensity.avgRir != null || intensity.avgRpe != null || intensity.hardSetPct != null) ? (
        <Card>
          <CardTitle id="h-int">Intensywność</CardTitle>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">Zapas (RIR)</div>
              <div className="font-metric text-[28px] leading-[1.1] text-white">{intensity.avgRir != null ? fmtNum(intensity.avgRir, 1) : "—"}</div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">Trudność (RPE)</div>
              <div className="font-metric text-[28px] leading-[1.1] text-white">{intensity.avgRpe != null ? fmtNum(intensity.avgRpe, 1) : "—"}</div>
            </div>
            <div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">Ciężkie serie</div>
              <div className="font-metric text-[28px] leading-[1.1] text-white">{intensity.hardSetPct != null ? `${intensity.hardSetPct}%` : "—"}</div>
            </div>
          </div>
          <Definition className="mt-3">
            <b className="text-white">RIR</b> to ile powtórzeń jeszcze byś zrobił (0 = do porażki). <b className="text-white">RPE</b> to trudność serii w skali 1–10.
            <b className="text-white"> Ciężka seria</b> kończy się blisko porażki. Wartości to średnie ze wszystkich zapisanych serii.
          </Definition>
        </Card>
      ) : null}

      {repRecords.length > 0 ? (
        <Card>
          <CardTitle id="h-rek">Rekordy wg powtórzeń</CardTitle>
          <p className="mb-1 mt-1 text-[13px] text-[var(--gym-text-secondary)]">Najcięższy ciężar podniesiony na co najmniej tyle powtórzeń.</p>
          <ul>
            {repRecords.map((r) => (
              <li key={r.reps} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-2.5 text-[14px] last:border-b-0">
                <span className="text-white">{r.reps} {r.reps === 1 ? "powtórzenie" : "powt."}</span>
                <span className="text-right"><b className="text-white">{fmtNum(r.weight, 1)} kg</b> <span className="text-[13px] text-[var(--gym-text-secondary)]">· {formatDayMonth(r.date)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
