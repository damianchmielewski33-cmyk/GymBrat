"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import type { ExerciseProgressPoint } from "@/lib/exercise-progress";
import type { ForecastPoint } from "@/lib/progress-forecast";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export function ExerciseDetailCharts({
  points,
  forecast,
}: {
  points: ExerciseProgressPoint[];
  forecast: ForecastPoint[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel neon-glow p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Siła + prognoza
        </p>
        <h3 className="font-heading mt-1 text-lg font-semibold text-white">e1RM</h3>
        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecast.length ? forecast : points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
              />
              <Line
                type="monotone"
                dataKey={forecast.length ? "projectedE1rm" : "bestE1rm"}
                stroke="#ff2d55"
                strokeWidth={2}
                strokeDasharray={undefined}
                dot={false}
                name="e1RM"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-white/45">
          Linia obejmuje historię oraz punkty projekcji (gdy jest wystarczająco danych).
        </p>
      </div>

      <div className="glass-panel neon-glow p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Obciążenie</p>
        <h3 className="font-heading mt-1 text-lg font-semibold text-white">Tonaż</h3>
        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="exTonDetail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="tonnageKg"
                stroke="#ff2d55"
                strokeWidth={2}
                fill="url(#exTonDetail)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
