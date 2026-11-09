"use client";

import { HelpHint } from "@/components/progress/help-hint";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline, toneArrow, toneClass, type Tone } from "@/components/progress/progress-charts";
import { Meter } from "@/components/progress/progress-ui";
import { fmtNum, formatDayMonth } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import { calendarDateKey } from "@/lib/local-date";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { exerciseChange, type ExerciseChange } from "@/lib/progress-view";
import { cn } from "@/lib/utils";

type SortId = "growth" | "attention" | "plan";

const SORTS: ReadonlyArray<{ id: SortId; label: string }> = [
  { id: "growth", label: "Najlepiej idzie" },
  { id: "attention", label: "Do poprawy" },
  { id: "plan", label: "Jak w planie" },
];

const STATUS_LABEL: Record<Tone, string> = { up: "rośnie", flat: "stoi", down: "spada" };

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

function CardTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
      {children}
    </h2>
  );
}

type Row = {
  name: string;
  key: string;
  change: ExerciseChange;
  spark: number[];
  planIndex: number;
};

export function StrengthTab({ data, intelligence }: { data: ProgressHubData["strength"]; intelligence: ProgressHubData["intelligence"] }) {
  const [sort, setSort] = useState<SortId>("growth");
  const today = calendarDateKey();

  const rows = useMemo<Row[]>(() => {
    const planOrder = new Map<string, number>();
    let i = 0;
    for (const g of data.planGroups) {
      for (const e of g.exercises) {
        const k = e.name.toLowerCase();
        if (!planOrder.has(k)) planOrder.set(k, i++);
      }
    }
    return data.allExercises.map((e) => ({
      name: e.name,
      key: exerciseProgressKey(e.name),
      change: exerciseChange(e.history, today, 30),
      spark: e.history.filter((p) => p.bestE1rm > 0).slice(-8).map((p) => p.bestE1rm),
      planIndex: planOrder.get(e.name.toLowerCase()) ?? 999,
    }));
  }, [data.allExercises, data.planGroups, today]);

  const counts = useMemo(() => {
    const c = { up: 0, flat: 0, down: 0 };
    for (const r of rows) c[r.change.status] += 1;
    return c;
  }, [rows]);

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort === "growth") list.sort((a, b) => (b.change.deltaKg ?? -Infinity) - (a.change.deltaKg ?? -Infinity));
    else if (sort === "attention") list.sort((a, b) => (a.change.deltaKg ?? Infinity) - (b.change.deltaKg ?? Infinity));
    else list.sort((a, b) => a.planIndex - b.planIndex);
    return list;
  }, [rows, sort]);

  const groups = intelligence.muscle.groups.filter((g) => g.days30.sets > 0);
  const maxShare = Math.max(1, ...groups.map((g) => g.days30.sharePct));
  const lowIds = new Map(intelligence.muscle.alerts.map((a) => [a.lowerId, a]));
  const weighted = data.maxes.filter((m) => m.kind === "weighted");
  const bodyweight = data.maxes.filter((m) => m.kind === "bodyweight");

  if (rows.length === 0 && data.maxes.length === 0) {
    return (
      <Card>
        <CardTitle>Twoja siła</CardTitle>
        <p className="mt-2 text-[15px] leading-snug text-white">
          Jeszcze nie ma z czego liczyć. Zapisz kilka treningów z ciężarem, a pokażemy, w których ćwiczeniach masz więcej siły.
        </p>
        <Link href="/active-workout" className="gold-btn mt-4 flex min-h-12 items-center justify-center rounded-xl px-4 text-[15px] font-semibold">
          Zacznij trening
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3.5">
      <Card hero>
        <div className="flex items-start justify-between gap-2"><CardTitle id="h-sila">Czy masz więcej siły?</CardTitle><HelpHint term="e1rm" /></div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {(["up", "flat", "down"] as const).map((t) => (
            <div key={t}>
              <div className={cn("font-metric text-[52px] leading-none", t === "flat" ? "text-white" : toneClass(t))}>{counts[t]}</div>
              <div className="text-[13px] text-[var(--gym-text-secondary)]">{t === "up" ? "idzie w górę" : t === "flat" ? "bez zmian" : "słabiej"}</div>
            </div>
          ))}
        </div>
        <p className="mt-3.5 text-[13px] leading-snug text-[var(--gym-text-secondary)]">Porównujemy ostatnie 30 dni z 30 dniami wcześniej. „Idzie w górę” znaczy, że podnosisz o co najmniej 1% więcej.</p>
      </Card>

      <Card>
        <CardTitle id="h-lista">Twoje ćwiczenia</CardTitle>
        <div role="group" aria-label="Sortowanie" className="mt-3 flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sort}
              onClick={() => setSort(s.id)}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-[13px] font-semibold transition active:scale-[0.97]",
                s.id === sort
                  ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/15 text-[var(--gym-gold-bright)]"
                  : "border-white/10 bg-black/30 text-[var(--gym-text-secondary)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ul className="mt-2">
          {sorted.map((r, i) => {
            const tone = r.change.status;
            const delta = r.change.deltaKg;
            return (
              <li key={r.key} className="pv-rise" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                <Link
                  href={`/progress/exercises/${r.key}`}
                  className="flex min-h-16 items-center gap-3 border-b border-white/[0.06] py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span translate="no" className="block truncate text-[15px] font-semibold text-white">{r.name}</span>
                    <span className="block text-[13px] text-[var(--gym-text-secondary)]">
                      szac. max {r.change.currentE1rm != null ? `${fmtNum(r.change.currentE1rm, 0)} kg` : "—"}
                    </span>
                  </span>
                  <Sparkline values={r.spark} color={tone === "down" ? "#ff9f43" : tone === "up" ? "#3ecf72" : "#9a9182"} />
                  <span className="min-w-[84px] text-right">
                    <span className={cn("font-metric block text-[26px] leading-none", toneClass(tone))}>
                      {delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmtNum(Math.abs(delta), 0)} kg`}
                    </span>
                    <span className={cn("block text-[12px]", toneClass(tone))}>
                      <span aria-hidden>{toneArrow(tone)} </span>
                      {STATUS_LABEL[tone]} (30 dni)
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-2"><CardTitle id="h-balans">Które partie ćwiczysz za mało?</CardTitle><HelpHint term="muscleBalance" /></div>
        <p className="mb-3.5 mt-1 text-[13px] text-[var(--gym-text-secondary)]">
          Ile pracy dostaje każda partia ciała. Liczymy serie z ostatnich 30 dni.
        </p>
        {groups.length === 0 ? (
          <p className="text-[14px] text-[var(--gym-text-secondary)]">Nie ma serii z ostatnich 30 dni, więc nie mamy czego porównać.</p>
        ) : (
          <ul className="space-y-4">
            {groups.map((g) => {
              const alert = lowIds.get(g.id);
              return (
                <li key={g.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[14px]">
                    <span className="font-semibold text-white">{g.label}</span>
                    <span className="text-[13px] text-[var(--gym-text-secondary)]">
                      <span className="text-[#efe9dc]">{fmtNum(g.days30.sharePct, 0)}%</span> · {g.days30.sets} serii ·{" "}
                      {alert ? <span className="text-[#ffb877]">za mało</span> : "w normie"}
                    </span>
                  </div>
                  <Meter
                    pct={(g.days30.sharePct / maxShare) * 100}
                    size="lg"
                    className="mt-2"
                    barClassName={alert ? "bg-[var(--gym-skipped)]" : "gym-meter-gold"}
                    aria-label={`${g.label}: ${fmtNum(g.days30.sharePct, 0)}% objętości`}
                  />
                  {alert ? <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">{alert.message}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle id="h-rekordy">Twoje rekordy</CardTitle>
        {weighted.length === 0 && bodyweight.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--gym-text-secondary)]">Rekordy pojawią się po pierwszych zapisanych seriach.</p>
        ) : (
          <ul className="mt-1">
            {weighted.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
                <span className="min-w-0">
                  <span translate="no" className="block truncate text-[15px] font-semibold text-white">{m.name}</span>
                  <span className="block text-[13px] text-[var(--gym-text-secondary)]">
                    {formatDayMonth(m.date)} · szac. max {fmtNum(m.bestE1rm, 0)} kg
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-metric block text-[28px] leading-none text-white">
                    {fmtNum(m.bestWeight, 1)} kg × {m.bestReps}
                  </span>
                  {m.isNew ? <span className="text-[12px] font-semibold text-[var(--gym-success)]">▲ nowy rekord (21 dni)</span> : null}
                </span>
              </li>
            ))}
            {bodyweight.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
                <span className="min-w-0">
                  <span translate="no" className="block truncate text-[15px] font-semibold text-white">{m.name}</span>
                  <span className="block text-[13px] text-[var(--gym-text-secondary)]">{formatDayMonth(m.date)} · masa ciała</span>
                </span>
                <span className="text-right">
                  <span className="font-metric block text-[28px] leading-none text-white">{m.bestReps} powt.</span>
                  {m.isNew ? <span className="text-[12px] font-semibold text-[var(--gym-success)]">▲ nowy rekord (21 dni)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
