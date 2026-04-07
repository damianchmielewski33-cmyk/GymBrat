"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCardioPoint, WeeklySessionBar } from "@/lib/reports";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

type ReportsChartsProps = {
  dailyCardio: DailyCardioPoint[];
  weeklySessions: WeeklySessionBar[];
};

export function ReportsCharts({ dailyCardio, weeklySessions }: ReportsChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,rgba(255,45,85,0.12),transparent_50%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Objętość cardio
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Ostatnie 14 dni
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Minuty zapisane dziennie (Turso)
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyCardio} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="neonCardio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_label, payload) => {
                    const row = payload?.[0]?.payload as DailyCardioPoint | undefined;
                    if (!row?.day) return "";
                    return new Date(`${row.day}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  formatter={(value) => [`${Number(value ?? 0)} min`, "Cardio"]}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#ff2d55"
                  strokeWidth={2}
                  fill="url(#neonCardio)"
                  dot={{ r: 3, fill: "#ff2d55", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(225deg,rgba(120,120,255,0.12),transparent_50%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Częstotliwość treningów
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Sesje na tydzień
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Kroczące 6 × okna 7-dniowe
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySessions} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${Number(value ?? 0)} sesji`, "Liczba"]}
                />
                <Bar
                  dataKey="sessions"
                  fill="rgba(255, 45, 85, 0.85)"
                  radius={[8, 8, 0, 0]}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
