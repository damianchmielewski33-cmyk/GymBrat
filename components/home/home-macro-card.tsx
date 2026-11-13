"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { HomeStartTodayMacros, HomeStartWeekMacros } from "@/lib/home-start";

type Range = "day" | "week";

function Row({
  label,
  consumed,
  goal,
}: {
  label: string;
  consumed: number;
  goal: number | null;
}) {
  const got = Math.round(consumed);
  const pct = goal && goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const over = goal != null && consumed > goal;
  const diff = goal != null ? Math.round(Math.abs(goal - consumed)) : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-white">{label}</span>
        <span className="text-white/60 tabular-nums">
          <span className="text-white">{got}</span>
          {goal != null ? ` / ${Math.round(goal)}` : ""}&nbsp;g
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none " +
            (over ? "bg-state-warning" : "gym-meter-gold")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      {diff != null ? (
        <p className={"mt-1.5 text-[13px] " + (over ? "text-state-warning" : "text-white/60")}>
          {over ? `${diff} g ponad cel` : `${diff} g zostało`}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] text-white/60">Brak celu</p>
      )}
    </div>
  );
}

/** Jedna karta makro z przełącznikiem Dziś / Tydzień (zamiast dwóch kafli). */
export function HomeMacroCard({
  todayMacros,
  weekMacros,
}: {
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
}) {
  const [range, setRange] = useState<Range>("day");
  const m = range === "day" ? todayMacros : weekMacros;
  const hasGoals =
    m.proteinGoal != null || m.carbsGoal != null || m.fatGoal != null;
  const kcalLeft =
    m.caloriesGoal != null ? Math.round(m.caloriesGoal - m.caloriesConsumed) : null;
  const href = range === "day" ? "/nutrition/today" : "/nutrition/week";

  return (
    <section className="app-card p-5" aria-labelledby="home-macro-h">
      <h2 id="home-macro-h" className="text-[13px] font-semibold text-white/60">
        Makro
      </h2>
      <SegmentedControl
        className="mt-3"
        ariaLabel="Zakres makro"
        value={range}
        onChange={setRange}
        options={[
          { value: "day", label: "Dziś" },
          { value: "week", label: "Tydzień" },
        ]}
      />

      {kcalLeft != null ? (
        <p className="mt-4 flex items-baseline gap-2">
          <AnimatedMetric
            key={range}
            value={Math.abs(kcalLeft)}
            prefix={kcalLeft < 0 ? "+" : ""}
            className={
              "text-[64px] leading-none " +
              (kcalLeft < 0 ? "text-state-warning" : "text-white")
            }
          />
          <span className="text-[15px] text-white/60">
            {kcalLeft < 0 ? "kcal ponad cel" : "kcal zostało"}
          </span>
        </p>
      ) : null}

      {hasGoals ? (
        <div className="mt-4 space-y-4">
          <Row label="Białko" consumed={m.proteinConsumed} goal={m.proteinGoal} />
          <Row label="Węglowodany" consumed={m.carbsConsumed} goal={m.carbsGoal} />
          <Row label="Tłuszcze" consumed={m.fatConsumed} goal={m.fatGoal} />
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[18px] font-semibold text-white">Ustaw swoje cele</p>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Podaj kalorie i białko, a pulpit pokaże, ile zostało do końca dnia.
          </p>
          <Link
            href="/profile/diet"
            className="gym-tap mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-[15px] font-semibold text-white"
          >
            Ustaw cele makro
          </Link>
        </div>
      )}

      {hasGoals ? (
        <Link
          href={href}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--gym-gold)]"
        >
          {range === "day" ? "Bilans i odchylenia →" : "Kalendarz tygodnia →"}
        </Link>
      ) : null}
    </section>
  );
}
