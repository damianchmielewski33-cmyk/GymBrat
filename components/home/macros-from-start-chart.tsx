"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HomeStartMacroPoint } from "@/lib/home-start";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

const legendStyle = {
  fontSize: "11px",
  color: "rgba(255, 255, 255, 0.55)",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export function MacrosFromStartChart({
  data,
  weightFromStartKg,
}: {
  data: HomeStartMacroPoint[];
  weightFromStartKg?: number | null;
}) {
  const delta =
    weightFromStartKg != null && Number.isFinite(weightFromStartKg)
      ? `${weightFromStartKg > 0 ? "+" : ""}${String(Math.round(weightFromStartKg * 10) / 10).replace(".", ",")} kg wagi`
      : null;

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-label">Od startu</p>
          <p className="mt-1 text-xs text-white/45">
            Makro dzienne · białko, węgle, tłuszcz i pozostałe kcal
            {delta ? ` · ${delta}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 h-[240px] w-full">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-white/40">
            Dodaj posiłki w Diecie — tu pojawi się wykres makro i pozostałych kalorii.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="grams"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, "auto"]}
              />
              <YAxis
                yAxisId="kcal"
                orientation="right"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value, name) => {
                  const n = typeof value === "number" ? Math.round(value) : value;
                  const unit =
                    name === "Pozostałe kcal" || name === "remainingKcal"
                      ? "kcal"
                      : "g";
                  return [`${n} ${unit}`, name];
                }}
              />
              <Legend wrapperStyle={legendStyle} />
              <Line
                yAxisId="grams"
                type="monotone"
                dataKey="protein"
                name="Białko"
                stroke="#ebc44a"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="grams"
                type="monotone"
                dataKey="carbs"
                name="Węglowodany"
                stroke="#5eead4"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="grams"
                type="monotone"
                dataKey="fat"
                name="Tłuszcze"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="kcal"
                type="monotone"
                dataKey="remainingKcal"
                name="Pozostałe kcal"
                stroke="#7dd3fc"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
