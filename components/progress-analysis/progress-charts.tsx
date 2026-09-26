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
    <div className="grid gap-2.5 lg:grid-cols-2">
      <div className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Masa ciała
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">Pomiary masy (90 dni)</h2>
          <p className="mt-1 text-xs text-white/40">Zapisane ważenia z aplikacji.</p>
          <div className="mt-4 h-[240px] w-full">
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
                  stroke="#d4af37"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#d4af37", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#d4af37", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {weights.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">
              Brak pomiarów — wpisz masę poniżej, aby wypełnić wykres.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Obciążenie
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">Tonaż (kg) wg dni</h2>
          <p className="mt-1 text-xs text-white/40">
            Suma obciążenia z ukończonych serii: ∑(powtórzenia × kg).
          </p>
          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volume} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="neonVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
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
                  stroke="#d4af37"
                  strokeWidth={2}
                  fill="url(#neonVol)"
                  dot={{ r: 2.5, fill: "#d4af37", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#d4af37", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {volume.length === 0 ? (
            <p className="mt-3 text-xs text-white/45">
              Ukończ trening z zapisanym ciężarem w seriach, aby pojawiły się punkty tonażu.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:col-span-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Siła
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">Wskaźnik siły (e1RM) wg dni</h2>
          <p className="mt-1 text-xs text-white/40">
            W każdym dniu sumujemy najlepszy szacunek e1RM (wzór Epleya) z każdego ćwiczenia.
          </p>
          <div className="mt-4 h-[240px] w-full">
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
                  fill="#d4af37"
                  radius={[8, 8, 0, 0]}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:col-span-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Siła względna
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Siła w odniesieniu do masy ciała
          </h2>
          <p className="mt-1 text-xs text-white/40">
            Stosunek wskaźnika siły do zapisanej masy — im wyżej, tym większa siła na kg masy.
          </p>
          <div className="mt-4 h-[240px] w-full">
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
                  stroke="#7ddea0"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7ddea0", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#7ddea0", stroke: "#fff", strokeWidth: 2 }}
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

