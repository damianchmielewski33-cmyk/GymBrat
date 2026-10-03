"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
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
const GREY = "rgba(255,255,255,0.28)";
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

function mondayShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso.slice(5).replace("-", ".");
  }
}

export function WeekBarChart({ weeks }: { weeks: ProgressWeekBar[] }) {
  const [filter, setFilter] = useState<FilterId>("workouts");

  const data = useMemo(
    () =>
      weeks.map((w) => {
        const value =
          filter === "workouts"
            ? w.workouts
            : filter === "tonnage"
              ? Math.round((w.tonnageKg / 1000) * 10) / 10
              : w.cardioMinutes;
        return {
          ...w,
          short: mondayShort(w.monday),
          value,
          display:
            filter === "workouts"
              ? value > 0
                ? String(value)
                : ""
              : filter === "tonnage"
                ? value > 0
                  ? String(value).replace(".", ",")
                  : ""
                : value > 0
                  ? String(value)
                  : "",
        };
      }),
    [weeks, filter],
  );

  return (
    <div className="space-y-3">
      <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
              filter === f.id
                ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
                : "border border-transparent bg-black/30 text-white/60",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="short"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ProgressWeekBar | undefined;
                return row?.label ?? "";
              }}
              formatter={(value) => {
                const n = Number(value);
                if (filter === "workouts") return [`${n}`, "Treningi"];
                if (filter === "tonnage") return [`${n} t`, "Tonaż"];
                return [`${n} min`, "Cardio"];
              }}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={22} minPointSize={2}>
              <LabelList
                dataKey="display"
                position="top"
                style={{
                  fill: "rgba(255,255,255,0.75)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              {data.map((entry) => (
                <Cell
                  key={entry.monday}
                  fill={
                    filter === "cardio"
                      ? entry.value > 0
                        ? BLUE
                        : GREY
                      : entry.complete
                        ? GOLD
                        : entry.value > 0
                          ? GREY
                          : "rgba(255,255,255,0.12)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-white/40">
        Złoty słupek to tydzień z kompletem treningów z planu.
      </p>
    </div>
  );
}
