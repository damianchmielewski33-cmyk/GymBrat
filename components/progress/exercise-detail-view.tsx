"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Trophy } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import type { ExerciseProgressPoint, ExercisePrs } from "@/lib/exercise-progress";

const GOLD = "#ebc44a";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(235, 196, 74, 0.28)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export function ExerciseDetailView({
  name,
  points,
  prs,
  matchedNames,
}: {
  name: string;
  points: ExerciseProgressPoint[];
  prs: ExercisePrs;
  matchedNames: string[];
}) {
  const latest = points.length ? points[points.length - 1]! : null;
  const heroVolume = latest?.tonnageKg ?? prs.maxTonnageKg.value;
  const sessions = points.length;
  const heaviest = prs.maxWeight;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <div className="flex items-start gap-3">
        <Link
          href="/progress?tab=sila"
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/25 text-white/70"
          aria-label="Wróć do Siła"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
            Ćwiczenie
          </p>
          <h1 className="mt-1 truncate font-heading text-2xl font-semibold text-white">
            {name}
          </h1>
          {matchedNames.length > 1 ? (
            <p className="mt-1 text-[11px] text-white/40">
              Dopasowano: {matchedNames.slice(0, 4).join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <section className="app-card relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--gym-gold)]/[0.08] blur-3xl"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Objętość
        </p>
        <p className="mt-2 font-metric text-5xl tabular-nums text-white">
          <AnimatedMetric value={heroVolume} decimals={0} />
          <span className="ml-2 text-lg text-white/35">kg</span>
        </p>
        <p className="mt-1 text-xs text-white/40">
          {latest
            ? `Ostatni trening: ${formatShortDate(latest.date)}`
            : "Brak zaliczonych serii"}
        </p>

        <div className="relative mt-4 h-[220px] w-full min-w-0">
          {points.length < 2 ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-white/40">
              Potrzeba co najmniej dwóch treningów do wykresu.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => formatShortDate(String(v))}
                  formatter={(value) => [
                    `${Number(value).toLocaleString("pl-PL")} kg`,
                    "Objętość",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="tonnageKg"
                  stroke={GOLD}
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: GOLD, stroke: "#0c0c0e", strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: "#f7e28f", stroke: GOLD }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <Kpi label="Treningi" value={sessions} decimals={0} />
        <Kpi
          label="Rekord"
          value={prs.maxE1rm.value}
          decimals={1}
          hint="e1RM"
        />
        <Kpi
          label="Najcięższa seria"
          value={heaviest.value}
          decimals={1}
          hint="kg"
        />
      </section>

      <section className="space-y-3">
        <SectionLabel index="01" title="Rekordy" />
        <div className="app-card divide-y divide-white/8 p-0">
          <RecordRow
            label="Najwyższe e1RM"
            value={`${prs.maxE1rm.value.toLocaleString("pl-PL")} kg`}
            date={prs.maxE1rm.date}
          />
          <RecordRow
            label="Największy ciężar"
            value={`${prs.maxWeight.value.toLocaleString("pl-PL")} kg`}
            date={prs.maxWeight.date}
          />
          <RecordRow
            label="Największa objętość"
            value={`${prs.maxTonnageKg.value.toLocaleString("pl-PL")} kg`}
            date={prs.maxTonnageKg.date}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index="02" title="Treningi" trailing={`${points.length}`} />
        {points.length === 0 ? (
          <div className="app-card px-4 py-8 text-center text-sm text-white/45">
            Brak historii dla tego ćwiczenia.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {[...points].reverse().map((p) => {
              const isPr =
                (prs.maxE1rm.date === p.date && p.bestE1rm === prs.maxE1rm.value) ||
                (prs.maxWeight.date === p.date &&
                  p.bestWeight === prs.maxWeight.value);
              return (
                <li
                  key={p.date}
                  className={cnSession(
                    "app-card flex items-center justify-between gap-3 px-3.5 py-3",
                    isPr,
                  )}
                >
                  <div>
                    <p className="text-sm text-white">{formatShortDate(p.date)}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {p.bestWeight} kg × {p.bestReps}
                      {isPr ? " · PR" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {isPr ? (
                      <Trophy className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
                    ) : null}
                    <div>
                      <p className="font-metric text-base tabular-nums text-white">
                        {p.tonnageKg.toLocaleString("pl-PL")}
                      </p>
                      <p className="text-[10px] text-white/35">kg objętości</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  decimals = 0,
  hint,
}: {
  label: string;
  value: number;
  decimals?: number;
  hint?: string;
}) {
  return (
    <div className="app-card px-2.5 py-3 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-1.5 font-metric text-xl tabular-nums text-white">
        <AnimatedMetric value={value} decimals={decimals} />
      </p>
      {hint ? <p className="text-[10px] text-white/35">{hint}</p> : null}
    </div>
  );
}

function RecordRow({
  label,
  value,
  date,
}: {
  label: string;
  value: string;
  date: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm text-white/85">{label}</p>
        <p className="text-[11px] text-white/40">
          {date ? formatShortDate(date) : "—"}
        </p>
      </div>
      <p className="font-metric text-base tabular-nums text-[var(--gym-gold)]">
        {value}
      </p>
    </div>
  );
}

function cnSession(base: string, isPr: boolean) {
  return isPr
    ? `${base} border border-[var(--gym-gold)]/40`
    : base;
}
