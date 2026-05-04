"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RelativeStrengthPoint, StrengthPoint, VolumePoint, WeightPoint } from "@/lib/progress-analysis";

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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,rgba(255,45,85,0.12),transparent_55%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Masa ciała
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Pomiary masy (90 dni)
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Zapisane ważenia z aplikacji.
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weights} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(value) => [`${Number(value ?? 0)} kg`, "Masa"]}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#ff2d55"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#ff2d55", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {weights.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">
              Brak pomiarów — wpisz masę w karcie obok, aby wypełnić wykres.
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(225deg,rgba(120,120,255,0.12),transparent_55%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Obciążenie
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Tonaż (kg) wg dni
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Suma obciążenia z ukończonych serii: ∑(powtórzenia × kg).
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volume} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="neonVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(value) => [`${Number(value ?? 0)} kg`, "Tonaż"]}
                />
                <Area
                  type="monotone"
                  dataKey="kg"
                  stroke="#ff2d55"
                  strokeWidth={2}
                  fill="url(#neonVol)"
                  dot={{ r: 2.5, fill: "#ff2d55", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {volume.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">
              Ukończ trening z zapisanym ciężarem w seriach, aby pojawiły się pierwsze punkty tonażu.
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6 lg:col-span-2">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.14),transparent_60%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Siła
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Wskaźnik siły (e1RM) wg dni
          </h2>
          <p className="mt-1 text-xs text-white/50">
            W każdym dniu sumujemy najlepszy szacunek e1RM (wzór Epleya) z każdego ćwiczenia.
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strength} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
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
                  formatter={(value) => [`${Number(value ?? 0)}`, "Wskaźnik"]}
                />
                <Bar
                  dataKey="score"
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

      <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6 lg:col-span-2">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,rgba(120,255,180,0.10),transparent_60%)]" />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Siła względna
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Siła w odniesieniu do masy ciała
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Stosunek wskaźnika siły do zapisanej masy ciała — im wyżej na wykresie, tym większa siła w
            przeliczeniu na kilogram masy własnej.
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={relativeStrength} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(value) => [`${Number(value ?? 0)}`, "Siła / masa"]}
                />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke="rgba(120, 255, 180, 0.95)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "rgba(120, 255, 180, 0.95)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "rgba(120, 255, 180, 1)", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {relativeStrength.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">
              Zapisz przynajmniej jedno ważenie, aby policzyć siłę względem masy ciała.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

