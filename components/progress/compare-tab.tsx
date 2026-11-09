"use client";

import { HelpHint } from "@/components/progress/help-hint";
import { useMemo, useState } from "react";
import { BRAND_GOLD_BRIGHT } from "@/lib/brand-colors";
import { Definition, toneArrow, toneClass, type Tone } from "@/components/progress/progress-charts";
import { fmtNum } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import { addCalendarDays } from "@/lib/local-date";
import { weeklyProgressSeries } from "@/lib/progress-view";
import { cn } from "@/lib/utils";

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

function WeekChips({
  label,
  weeks,
  value,
  onPick,
}: {
  label: string;
  weeks: ReadonlyArray<{ monday: string; label: string }>;
  value: string;
  onPick: (monday: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] text-[var(--gym-text-secondary)]">{label}</p>
      <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((w) => (
          <button
            key={w.monday}
            type="button"
            aria-pressed={w.monday === value}
            onClick={() => onPick(w.monday)}
            className={cn(
              "min-h-11 min-w-[84px] shrink-0 rounded-xl border px-3 text-[13px] font-semibold transition",
              w.monday === value
                ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/15 text-[var(--gym-gold-bright)]"
                : "border-white/10 bg-black/30 text-[var(--gym-text-secondary)]",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type MetricRow = {
  name: string;
  a: number | null;
  b: number | null;
  fmt: (v: number) => string;
  higherIsBetter: boolean | null;
};

const dateShort = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${m}`;
};

export function CompareTab({
  week,
  strength,
}: {
  week: ProgressHubData["week"];
  strength: ProgressHubData["strength"];
}) {
  const picks = week.summary.compareWeeks;
  const options = useMemo(() => picks.map((p) => ({ monday: p.monday, label: p.isCurrent ? "Ten tydzień" : p.label })), [picks]);
  const defaultA = week.summary.compareWeeks.find((p) => !p.isCurrent)?.monday ?? picks[0]?.monday ?? "";
  const defaultB = picks.find((p) => p.isCurrent)?.monday ?? picks[0]?.monday ?? "";
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);

  const pa = picks.find((p) => p.monday === a);
  const pb = picks.find((p) => p.monday === b);
  // Bieżący tydzień trwa jeszcze, więc gdy wybrano go, oba tygodnie liczymy od poniedziałku do tego samego dnia.
  const aligned = Boolean(pa?.isCurrent || pb?.isCurrent);
  const ma = pa ? (aligned ? pa.partial : pa.full) : null;
  const mb = pb ? (aligned ? pb.partial : pb.full) : null;
  const dietBy = new Map(week.dietTraining.weeks.map((w) => [w.monday, w]));
  const perDay = (w: { caloriesConsumed: number; proteinConsumed: number; daysLogged: number } | undefined, k: "caloriesConsumed" | "proteinConsumed") =>
    w && w.daysLogged > 0 ? Math.round(w[k] / w.daysLogged) : null;

  const rows: MetricRow[] = [
    { name: "Treningi", a: ma?.workouts ?? null, b: mb?.workouts ?? null, fmt: (v) => String(v), higherIsBetter: true },
    { name: "Podniesione kilogramy", a: ma?.tonnageKg ?? null, b: mb?.tonnageKg ?? null, fmt: (v) => `${fmtNum(v, 0)} kg`, higherIsBetter: true },
    { name: "Cardio", a: ma?.cardioMinutes ?? null, b: mb?.cardioMinutes ?? null, fmt: (v) => `${Math.round(v)} min`, higherIsBetter: true },
    { name: "Kalorie dziennie", a: perDay(dietBy.get(a), "caloriesConsumed"), b: perDay(dietBy.get(b), "caloriesConsumed"), fmt: (v) => `${fmtNum(v, 0)} kcal`, higherIsBetter: null },
    { name: "Białko dziennie", a: perDay(dietBy.get(a), "proteinConsumed"), b: perDay(dietBy.get(b), "proteinConsumed"), fmt: (v) => `${fmtNum(v, 0)} g`, higherIsBetter: true },
  ];
  const calc = rows.map((r) => {
    const d = r.a != null && r.b != null && r.a > 0 ? ((r.b - r.a) / r.a) * 100 : r.a === 0 && r.b != null && r.b > 0 ? 100 : null;
    const neutral = d == null || Math.abs(d) < 0.5;
    const dir: Tone = neutral ? "flat" : d! > 0 ? "up" : "down";
    const tone: Tone = neutral || r.higherIsBetter == null ? "flat" : (d! > 0) === r.higherIsBetter ? "up" : "down";
    return { r, d, dir, tone };
  });
  const more = calc.filter((c) => c.d != null && c.d >= 0.5).map((c) => `${c.r.name.split(",")[0]!.toLowerCase()} (+${Math.round(c.d!)}%)`);
  const less = calc.filter((c) => c.d != null && c.d <= -0.5).map((c) => `${c.r.name.split(",")[0]!.toLowerCase()} (−${Math.abs(Math.round(c.d!))}%)`);
  const verdict =
    !pa || !pb
      ? "Nie ma jeszcze tygodni do porównania. Zapisz treningi, a pojawią się tutaj."
      : a === b
        ? "Wybrano ten sam tydzień dwa razy. Wybierz dwa różne, żeby zobaczyć zmiany."
        : `Tydzień B względem A: ${more.length ? `więcej: ${more.join(", ")}` : "nic nie wzrosło"}. ${less.length ? `Mniej: ${less.join(", ")}.` : "Nic nie spadło."}`;

  // Progres ćwiczenia tydzień po tygodniu (8 ostatnich tygodni).
  const mondays = useMemo(() => Array.from({ length: 8 }, (_, i) => addCalendarDays(week.summary.monday, (i - 7) * 7)), [week.summary.monday]);
  const exercises = strength.allExercises.slice(0, 6);
  const [exIdx, setExIdx] = useState(0);
  const [wkSel, setWkSel] = useState(7);
  const series = useMemo(
    () => exercises.map((e) => weeklyProgressSeries(e.history, mondays)),
    [exercises, mondays],
  );
  const cur = series[exIdx] ?? [];
  const vals = cur.map((c) => c.value).filter((v): v is number => v != null);
  const mn = vals.length ? Math.min(...vals) - 6 : 0;
  const mx = vals.length ? Math.max(...vals) : 1;
  const selCell = cur[wkSel];
  const weekLabel = (m: string, i: number) => (i === 7 ? "Ten tydzień" : `od ${dateShort(m)}`);

  return (
    <div className="space-y-3.5">
      <Card hero>
        <div className="flex items-start justify-between gap-2"><CardTitle id="h-cmp">Czy ten tydzień jest lepszy?</CardTitle><HelpHint term="weeks" /></div>
        <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">Wybierz dwa tygodnie. Zobaczysz, w czym jest lepiej, a w czym gorzej.</p>
        <WeekChips label="Wcześniej" weeks={options} value={a} onPick={setA} />
        <WeekChips label="Teraz" weeks={options} value={b} onPick={setB} />
        <Definition className="mt-3.5">
          <span aria-live="polite">{verdict}</span>
          {aligned ? " Bieżący tydzień jeszcze trwa, więc oba tygodnie liczymy od poniedziałku do tego samego dnia tygodnia." : ""}
        </Definition>
      </Card>

      <Card>
        <div className="flex justify-between gap-2 text-[13px] text-[var(--gym-text-secondary)]">
          <span><b className="mr-1.5 inline-block h-3 w-3 rounded-sm bg-[#716a5b] align-[-1px]" />A: {options.find((o) => o.monday === a)?.label ?? "—"}</span>
          <span><b className="gym-meter-gold mr-1.5 inline-block h-3 w-3 rounded-sm align-[-1px]" />B: {options.find((o) => o.monday === b)?.label ?? "—"}</span>
        </div>
        {calc.map(({ r, d, dir, tone }, i) => {
          const m = Math.max(r.a ?? 0, r.b ?? 0, 1);
          return (
            <div key={r.name} className="pv-rise border-b border-white/[0.06] py-3.5 last:border-b-0" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-white">{r.name}</span>
                <span className={cn("rounded-full border border-white/10 px-2.5 py-0.5 text-[13px] font-semibold", toneClass(tone))}>
                  {toneArrow(dir)} {d == null ? "brak danych" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(Math.round(d))}%`}
                </span>
              </div>
              {[
                { v: r.a, cls: "bg-[#716a5b]", text: "text-[var(--gym-text-secondary)]", l: "A" },
                { v: r.b, cls: "gym-meter-gold", text: "text-white", l: "B" },
              ].map((x) => (
                <div key={x.l} className="mt-2 flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--gym-track)]" role="img" aria-label={`${x.l}: ${x.v == null ? "brak danych" : r.fmt(x.v)}`}>
                    <i className={cn("block h-full rounded-full transition-[width] duration-700", x.cls)} style={{ width: `${x.v == null ? 0 : (x.v / m) * 100}%` }} />
                  </div>
                  <span className={cn("min-w-[86px] text-right text-[13px]", x.text)}>{x.v == null ? "—" : r.fmt(x.v)}</span>
                </div>
              ))}
            </div>
          );
        })}
        <p className="text-[13px] text-[var(--gym-text-secondary)]">
          Tonaż to suma ciężar × powtórzenia ze wszystkich serii. Dieta pokazuje średnią z dni z wpisem w dzienniku.
        </p>
      </Card>

      <Card>
        <CardTitle id="h-prog">Jak idzie jedno ćwiczenie?</CardTitle>
        <p className="mb-3 mt-1 text-[13px] text-[var(--gym-text-secondary)]">Najwięcej, jaki podniesiesz jeden raz, w każdym tygodniu. Pokazujemy też różnicę względem poprzedniego tygodnia z treningiem.</p>
        {exercises.length === 0 ? (
          <p className="text-[14px] text-[var(--gym-text-secondary)]">Nie ma jeszcze ćwiczeń z ciężarem. Zapisz kilka treningów, a pokażemy tu ich postęp.</p>
        ) : (
          <>
            <div role="group" aria-label="Ćwiczenie" className="flex gap-2 overflow-x-auto pb-1">
              {exercises.map((e, i) => (
                <button
                  key={e.name}
                  type="button"
                  translate="no"
                  aria-pressed={i === exIdx}
                  onClick={() => setExIdx(i)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-xl border px-3 text-[13px] font-semibold",
                    i === exIdx ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/15 text-[var(--gym-gold-bright)]" : "border-white/10 bg-black/30 text-[var(--gym-text-secondary)]",
                  )}
                >
                  {e.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex h-[170px] items-end gap-1.5" role="group" aria-label={`${exercises[exIdx]!.name}: szacowany max w kolejnych tygodniach`}>
              {cur.map((c, i) => {
                const on = i === wkSel;
                const tone: Tone = c.delta == null || c.delta === 0 ? "flat" : c.delta > 0 ? "up" : "down";
                return (
                  <button
                    key={c.monday}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Tydzień ${weekLabel(c.monday, i)}: ${c.value == null ? "brak treningu" : `${fmtNum(c.value, 0)} kg`}`}
                    onClick={() => setWkSel(i)}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className={cn("text-[11px]", toneClass(tone))}>
                      {c.delta == null ? "" : `${c.delta > 0 ? "+" : c.delta < 0 ? "−" : "±"}${fmtNum(Math.abs(c.delta), 0)}`}
                    </span>
                    <i
                      className={cn("block w-full rounded-t-md rounded-b-sm transition-[height] duration-700", on ? "gym-meter-gold" : "bg-[#3a3524]")}
                      style={{ height: c.value == null ? "2%" : `${Math.max(6, Math.round(((c.value - mn) / (mx - mn || 1)) * 100))}%`, outline: on ? `2px solid ${BRAND_GOLD_BRIGHT}` : "none", outlineOffset: 2, opacity: c.value == null ? 0.35 : 1 }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {cur.map((c, i) => (
                <span key={c.monday} className="min-w-0 flex-1 text-center text-[11px] text-[var(--gym-text-secondary)]">
                  {i === 7 ? "Ten" : dateShort(c.monday)}
                </span>
              ))}
            </div>
            <Definition className="mt-3.5">
              <span aria-live="polite">
                {selCell
                  ? selCell.value == null
                    ? `Tydzień ${weekLabel(selCell.monday, wkSel)}: brak treningu tego ćwiczenia.`
                    : `Tydzień ${weekLabel(selCell.monday, wkSel)}: ${fmtNum(selCell.value, 0)} kg szacowanego maxa${
                        selCell.delta == null ? "." : selCell.delta === 0 ? ", bez zmiany." : `, ${selCell.delta > 0 ? "+" : "−"}${fmtNum(Math.abs(selCell.delta), 0)} kg względem poprzedniego tygodnia z treningiem.`
                      }`
                  : ""}
              </span>{" "}
              Szacowany max = ciężar × (1 + powtórzenia / 30), najlepsza seria tygodnia.
            </Definition>
          </>
        )}
      </Card>

      {exercises.length > 0 ? (
        <Card>
          <CardTitle id="h-map">Wszystkie ćwiczenia, tydzień po tygodniu</CardTitle>
          <p className="mb-3 mt-1 text-[13px] text-[var(--gym-text-secondary)]">Czy w danym tygodniu było więcej, mniej czy tyle samo niż w poprzednim tygodniu z treningiem. 6 ostatnich tygodni.</p>
          <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(6,minmax(0,1fr))] items-center gap-1">
            <span />
            {mondays.slice(2).map((m, i) => (
              <span key={m} className="text-center text-[11px] text-[var(--gym-text-secondary)]">{i === 5 ? "Ten" : dateShort(m)}</span>
            ))}
            {exercises.map((e, r) => (
              <div key={e.name} className="contents">
                <span translate="no" className="truncate pr-1 text-[13px] font-semibold text-white">{e.name}</span>
                {series[r]!.slice(2).map((c) => {
                  const d = c.delta;
                  return (
                    <span
                      key={c.monday}
                      className={cn(
                        "pv-rise flex h-10 items-center justify-center rounded-md text-[12px] font-semibold",
                        d == null ? "border border-dashed border-[#26231c] text-[var(--gym-text-secondary)]" : d > 0 ? "bg-[#1f3a29] text-[#7fe3a3]" : d < 0 ? "bg-[#3d2a14] text-[#ffb877]" : "border border-[#3a3524] bg-[#1b1b1f] text-[var(--gym-text-secondary)]",
                      )}
                    >
                      {d == null ? "–" : d === 0 ? "0" : `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d), 0)}`}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--gym-text-secondary)]">
            <span><b className="mr-1.5 inline-block h-3.5 w-3.5 rounded bg-[#1f3a29] align-[-2px]" />więcej</span>
            <span><b className="mr-1.5 inline-block h-3.5 w-3.5 rounded border border-[#3a3524] bg-[#1b1b1f] align-[-2px]" />tyle samo</span>
            <span><b className="mr-1.5 inline-block h-3.5 w-3.5 rounded bg-[#3d2a14] align-[-2px]" />mniej</span>
            <span>– bez treningu</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
