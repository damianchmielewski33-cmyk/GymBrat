"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ExerciseLeaderboardRow,
  PeriodCompare,
  RelativeStrengthPoint,
  RirBucket,
  RirPoint,
  SetsPoint,
  StrengthPoint,
  VolumePoint,
  WeightPoint,
} from "@/lib/progress-analysis";
import { cn } from "@/lib/utils";

const GOLD = "#ebc44a";
const GOLD_BRIGHT = "#f7e28f";
const MINT = "#6ee7b7";
const ROSE = "#fb7185";
const SKY = "#7dd3fc";

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

function formatPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${String(r).replace(".", ",")}%`;
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
    <section className={cn("app-card relative overflow-hidden p-4 sm:p-5", className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/45 to-transparent"
        aria-hidden
      />
      <div className="relative">
        <p className="app-label text-[var(--gym-gold)]">{kicker}</p>
        <h2 className="mt-1.5 text-base font-semibold leading-snug text-white">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/40">{description}</p>
        <div className="relative mt-4 h-[220px] w-full min-w-0 sm:h-[248px]">
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
  avgRir,
  sets,
  exerciseLeaderboard,
  topByE1rm,
  rirDistribution,
  periodCompare,
}: {
  weights: WeightPoint[];
  volume: VolumePoint[];
  strength: StrengthPoint[];
  relativeStrength: RelativeStrengthPoint[];
  avgRir: RirPoint[];
  sets: SetsPoint[];
  exerciseLeaderboard: ExerciseLeaderboardRow[];
  topByE1rm: ExerciseLeaderboardRow[];
  rirDistribution: RirBucket[];
  periodCompare: PeriodCompare;
}) {
  const volumeBars = exerciseLeaderboard.slice(0, 8).map((e) => ({
    name: e.name.length > 18 ? `${e.name.slice(0, 16)}…` : e.name,
    fullName: e.name,
    volume: e.totalVolumeKg,
    delta: e.volumeDeltaPercent,
  }));

  const e1rmBars = topByE1rm.map((e) => ({
    name: e.name.length > 18 ? `${e.name.slice(0, 16)}…` : e.name,
    fullName: e.name,
    e1rm: e.bestE1rm,
  }));

  const periodBars = [
    {
      label: "Ostatnie 30 dni",
      volume: periodCompare.recent30.volumeKg,
      sessions: periodCompare.recent30.sessions,
    },
    {
      label: "Poprzednie 30",
      volume: periodCompare.prior30.volumeKg,
      sessions: periodCompare.prior30.sessions,
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 lg:grid-cols-2">
        <ChartShell
          kicker="Masa ciała"
          title="Pomiary masy (90 dni)"
          description="Zapisane ważenia z aplikacji."
          empty={weights.length === 0}
          emptyHint="Brak pomiarów — wpisz masę, aby wypełnić wykres."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weights} margin={chartMargin}>
              <defs>
                <linearGradient id="paWeightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
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
                width={40}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => [`${Number(value ?? 0)} kg`, "Masa"]}
              />
              <Area
                type="monotone"
                dataKey="kg"
                stroke={GOLD}
                strokeWidth={2.5}
                fill="url(#paWeightFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Obciążenie"
          title="Tonaż (kg) wg dni"
          description="Suma obciążenia: ∑(powtórzenia × kg)."
          empty={volume.length === 0}
          emptyHint="Ukończ trening z zapisanym ciężarem, aby pojawił się tonaż."
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
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}t` : String(v)
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
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
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Siła"
          title="Wskaźnik siły (e1RM) wg dni"
          description="Suma najlepszych e1RM z ćwiczeń w dniu."
          empty={strength.length === 0}
          emptyHint="Po zapisanych treningach pojawi się wykres siły."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={strength} margin={chartMargin} barCategoryGap="22%">
              <defs>
                <linearGradient id="paBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD_BRIGHT} />
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
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => [`${Number(value ?? 0)}`, "Wskaźnik"]}
              />
              <Bar dataKey="score" fill="url(#paBarFill)" radius={[10, 10, 4, 4]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Serie"
          title="Serie i ciężkie serie (RIR≤1)"
          description="Ile serii zaliczasz dziennie i ile jest blisko upadku."
          empty={sets.length === 0}
          emptyHint="Zapisz treningi z seriami, aby zobaczyć wykres."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sets} margin={chartMargin} barCategoryGap="18%">
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
              />
              <Bar dataKey="sets" name="Serie" fill={SKY} radius={[6, 6, 0, 0]} maxBarSize={18} />
              <Bar
                dataKey="hardSets"
                name="RIR≤1"
                fill={ROSE}
                radius={[6, 6, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Intensywność"
          title="Średni RIR w czasie"
          description="Niższy RIR = cięższe serie (bliżej upadku)."
          empty={avgRir.length === 0}
          emptyHint="Zapisuj RIR przy seriach, aby zobaczyć trend zapasu."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={avgRir} margin={chartMargin}>
              <defs>
                <linearGradient id="paRirFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SKY} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SKY} stopOpacity={0} />
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
                domain={[0, 5]}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => [String(value).replace(".", ","), "Śr. RIR"]}
              />
              <Area
                type="monotone"
                dataKey="avgRir"
                stroke={SKY}
                strokeWidth={2.5}
                fill="url(#paRirFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Porównanie okresów"
          title="Ostatnie 30 vs poprzednie 30"
          description={`Tonaż ${formatPct(periodCompare.volumeDeltaPercent)} · sesje ${
            periodCompare.sessionsDelta != null
              ? `${periodCompare.sessionsDelta > 0 ? "+" : ""}${periodCompare.sessionsDelta}`
              : "—"
          }`}
          empty={periodBars.every((b) => b.volume <= 0)}
          emptyHint="Potrzeba treningów z ostatnich 60 dni."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={periodBars} margin={chartMargin}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}t` : String(v)
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  name === "volume"
                    ? `${Number(value).toLocaleString("pl-PL")} kg`
                    : String(value),
                  name === "volume" ? "Tonaż" : "Sesje",
                ]}
              />
              <Bar dataKey="volume" fill={GOLD} radius={[8, 8, 4, 4]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <ChartShell
          kicker="Ćwiczenia"
          title="Top tonaż (90 dni)"
          description="Najwięcej obciążenia łącznie — z Δ vs poprzednia sesja tego ruchu."
          empty={volumeBars.length === 0}
          emptyHint="Brak ćwiczeń w historii 90 dni."
          className="lg:col-span-1"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={volumeBars}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _n, item) => {
                  const delta =
                    item && typeof item === "object" && "payload" in item
                      ? (item.payload as { delta?: number | null }).delta
                      : null;
                  return [
                    `${Number(value).toLocaleString("pl-PL")} kg${
                      delta != null ? ` · ${formatPct(delta)}` : ""
                    }`,
                    "Tonaż",
                  ];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                  return p?.fullName ?? "";
                }}
              />
              <Bar dataKey="volume" radius={[0, 8, 8, 0]} maxBarSize={16}>
                {volumeBars.map((row) => (
                  <Cell
                    key={row.fullName}
                    fill={
                      row.delta == null
                        ? GOLD
                        : row.delta > 0
                          ? MINT
                          : row.delta < 0
                            ? ROSE
                            : GOLD
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Ćwiczenia"
          title="Top e1RM"
          description="Najwyższy szacunek 1RM z ostatnich 90 dni."
          empty={e1rmBars.length === 0}
          emptyHint="Brak danych e1RM."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={e1rmBars}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${Number(value)} kg`, "e1RM"]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                  return p?.fullName ?? "";
                }}
              />
              <Bar dataKey="e1rm" fill={GOLD_BRIGHT} radius={[0, 8, 8, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="RIR"
          title="Rozkład intensywności serii"
          description="Jak często trenujesz blisko upadku vs z dużym zapasem."
          empty={rirDistribution.length === 0}
          emptyHint="Zapisuj RIR przy seriach."
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rirDistribution} margin={chartMargin}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _n, item) => {
                  const pct =
                    item && typeof item === "object" && "payload" in item
                      ? (item.payload as { pct?: number }).pct
                      : null;
                  return [`${value} serii${pct != null ? ` (${pct}%)` : ""}`, "Liczba"];
                }}
              />
              <Bar dataKey="count" radius={[10, 10, 4, 4]} maxBarSize={56}>
                {rirDistribution.map((b) => (
                  <Cell
                    key={b.label}
                    fill={
                      b.label.startsWith("RIR 0")
                        ? ROSE
                        : b.label.startsWith("RIR 2")
                          ? GOLD
                          : MINT
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          kicker="Siła względna"
          title="Siła / masa ciała"
          description="Wskaźnik siły podzielony przez zapisaną masę."
          empty={relativeStrength.length === 0}
          emptyHint="Zapisz ważenie, aby policzyć siłę względną."
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
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={tooltipStyle}
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
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );
}
