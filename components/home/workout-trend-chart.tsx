"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { WorkoutTrendPoint } from "@/lib/home-stats";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

const legendStyle = {
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.55)",
};

export function WorkoutTrendChart({ data }: { data: WorkoutTrendPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="mt-3 text-center text-xs text-white/40">
        Potrzebujesz co najmniej 2 treningów, aby zobaczyć wykres trendu.
      </p>
    );
  }

  return (
    <div className="h-[220px] w-full min-w-0 sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 6, left: 2, bottom: 6 }}
        >
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff2d55" />
              <stop offset="100%" stopColor="#ff6b8a" />
            </linearGradient>
            <linearGradient id="repsGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7878ff" />
              <stop offset="100%" stopColor="#a0a0ff" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="volume"
            orientation="left"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}t` : String(v)
            }
          />
          <YAxis
            yAxisId="reps"
            orientation="right"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              if (name === "volumeKg")
                return [`${Number(value).toLocaleString("pl-PL")} kg`, "Wolumen"];
              if (name === "totalReps")
                return [`${Number(value)} pow.`, "Powtórzenia"];
              return [String(value), String(name)];
            }}
          />
          <Legend
            wrapperStyle={legendStyle}
            formatter={(value) => {
              if (value === "volumeKg") return "Wolumen (kg)";
              if (value === "totalReps") return "Powtórzenia";
              return value;
            }}
          />
          <Line
            yAxisId="volume"
            type="monotone"
            dataKey="volumeKg"
            stroke="#ff2d55"
            strokeWidth={2}
            dot={{ r: 3, fill: "#ff2d55", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }}
          />
          <Line
            yAxisId="reps"
            type="monotone"
            dataKey="totalReps"
            stroke="#7878ff"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: "#7878ff", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#7878ff", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
