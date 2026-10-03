"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProgressWeekBar } from "@/lib/progress-hub";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "workouts", label: "Treningi" },
  { id: "tonnage", label: "Tonaż" },
  { id: "cardio", label: "Cardio" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const GOLD = "#ebc44a";
const GOLD_DIM = "rgba(235,196,74,0.35)";
const BLUE = "#60a5fa";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(235, 196, 74, 0.28)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

export function WeekBarChart({ weeks }: { weeks: ProgressWeekBar[] }) {
  const [filter, setFilter] = useState<FilterId>("workouts");

  const data = useMemo(
    () =>
      weeks.map((w) => ({
        ...w,
        short: w.label.split("–")[0]?.trim() ?? w.label,
        value:
          filter === "workouts"
            ? w.workouts
            : filter === "tonnage"
              ? w.tonnageKg
              : w.cardioMinutes,
      })),
    [weeks, filter],
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold tracking-wide transition-colors",
              filter === f.id
                ? "bg-[var(--gym-gold)]/18 text-[var(--gym-gold-bright)]"
                : "text-white/45 hover:text-white/70",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="short"
              tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={filter !== "workouts"}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ProgressWeekBar | undefined;
                return row?.label ?? "";
              }}
              formatter={(value) => {
                const n = Number(value);
                if (filter === "workouts") return [`${n}`, "Treningi"];
                if (filter === "tonnage")
                  return [`${n.toLocaleString("pl-PL")} kg`, "Tonaż"];
                return [`${n} min`, "Cardio"];
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {data.map((entry) => (
                <Cell
                  key={entry.monday}
                  fill={
                    filter === "cardio"
                      ? BLUE
                      : entry.complete
                        ? GOLD
                        : GOLD_DIM
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
