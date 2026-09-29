"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  RelativeStrengthPoint,
  StrengthPoint,
  VolumePoint,
  WeightPoint,
} from "@/lib/progress-analysis";
import { cn } from "@/lib/utils";

const GOLD = "#ebc44a";
const GOLD_BRIGHT = "#f7e28f";
const MINT = "#6ee7b7";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(235, 196, 74, 0.28)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

const axisTick = { fill: "rgba(255,255,255,0.38)", fontSize: 10 };
const chartMargin = { top: 12, right: 10, left: 0, bottom: 4 };

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

function ChartShell({
  kicker,
  title,
  description,
  empty,
  emptyHint,
  className,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  empty: boolean;
  emptyHint: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("app-card relative overflow-hidden p-5", className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/45 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--gym-gold)]/[0.07] blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <p className="app-label text-[var(--gym-gold)]">{kicker}</p>
        <h2 className="mt-1.5 text-base font-semibold leading-snug text-white">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/40">{description}</p>
        <div className="relative mt-4 h-[248px] w-full min-w-0">
          {empty ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-xs leading-relaxed text-white/40">
              {emptyHint}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}

export function ProgressCharts({
  weights,
  volume,
  strength,
  relativeStrength,
}: {
  weights: WeightPoint[];
  volume: VolumePoint[];
  strength: StrengthPoint[];
  relativeStrength: RelativeStrengthPoint[];
}) {
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <ChartShell
        kicker="Masa ciała"
        title="Pomiary masy (90 dni)"
        description="Zapisane ważenia z aplikacji."
        empty={weights.length === 0}
        emptyHint="Brak pomiarów — wpisz masę poniżej, aby wypełnić wykres."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weights} margin={chartMargin}>
            <defs>
              <linearGradient id="paWeightFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                <stop offset="55%" stopColor={GOLD} stopOpacity={0.08} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="paWeightStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={GOLD_BRIGHT} />
                <stop offset="100%" stopColor={GOLD} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={["dataMin - 1", "dataMax + 1"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "rgba(235,196,74,0.25)", strokeWidth: 1 }}
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(value) => [`${Number(value ?? 0)} kg`, "Masa"]}
            />
            <Area
              type="monotone"
              dataKey="kg"
              stroke="url(#paWeightStroke)"
              strokeWidth={2.5}
              fill="url(#paWeightFill)"
              dot={false}
              activeDot={{
                r: 5,
                fill: GOLD_BRIGHT,
                stroke: "#070708",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        kicker="Obciążenie"
        title="Tonaż (kg) wg dni"
        description="Suma obciążenia z ukończonych serii: ∑(powtórzenia × kg)."
        empty={volume.length === 0}
        emptyHint="Ukończ trening z zapisanym ciężarem w seriach, aby pojawiły się punkty tonażu."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={volume} margin={chartMargin}>
            <defs>
              <linearGradient id="paVolFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.42} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}t` : String(v)
              }
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "rgba(235,196,74,0.25)", strokeWidth: 1 }}
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(value) => [
                `${Number(value ?? 0).toLocaleString("pl-PL")} kg`,
                "Tonaż",
              ]}
            />
            <Area
              type="monotone"
              dataKey="kg"
              stroke={GOLD}
              strokeWidth={2.5}
              fill="url(#paVolFill)"
              dot={false}
              activeDot={{
                r: 5,
                fill: GOLD_BRIGHT,
                stroke: "#070708",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        kicker="Siła"
        title="Wskaźnik siły (e1RM) wg dni"
        description="W każdym dniu sumujemy najlepszy szacunek e1RM (wzór Epleya) z każdego ćwiczenia."
        empty={strength.length === 0}
        emptyHint="Po zapisanych treningach pojawi się wykres wskaźnika siły."
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={strength} margin={chartMargin} barCategoryGap="22%">
            <defs>
              <linearGradient id="paBarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={1} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(235,196,74,0.08)" }}
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(value) => [`${Number(value ?? 0)}`, "Wskaźnik"]}
            />
            <Bar
              dataKey="score"
              fill="url(#paBarFill)"
              radius={[10, 10, 4, 4]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        kicker="Siła względna"
        title="Siła w odniesieniu do masy ciała"
        description="Stosunek wskaźnika siły do zapisanej masy — im wyżej, tym większa siła na kg masy."
        empty={relativeStrength.length === 0}
        emptyHint="Zapisz przynajmniej jedno ważenie, aby policzyć siłę względem masy ciała."
        className="lg:col-span-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={relativeStrength} margin={chartMargin}>
            <defs>
              <linearGradient id="paRelFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MINT} stopOpacity={0.32} />
                <stop offset="100%" stopColor={MINT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "rgba(110,231,183,0.28)", strokeWidth: 1 }}
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(value) => [`${Number(value ?? 0)}`, "Siła / masa"]}
            />
            <Area
              type="monotone"
              dataKey="ratio"
              stroke={MINT}
              strokeWidth={2.5}
              fill="url(#paRelFill)"
              dot={false}
              activeDot={{
                r: 5,
                fill: MINT,
                stroke: "#070708",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
