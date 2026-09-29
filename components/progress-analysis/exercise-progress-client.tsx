"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Dumbbell, Flame, Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/reports/stat-card";

type ApiOk = {
  ok: true;
  query: string;
  matchedExerciseNames: string[];
  points: Array<{
    date: string;
    bestE1rm: number;
    bestWeight: number;
    bestReps: number;
    tonnageKg: number;
  }>;
  prs: {
    maxE1rm: { value: number; date: string | null };
    maxWeight: { value: number; date: string | null };
    maxTonnageKg: { value: number; date: string | null };
  };
  newMax?: { e1rm: boolean; weight: boolean; tonnage: boolean };
  hasNewMax?: boolean;
};

type ApiErr = { error: string };

const GOLD = "#ebc44a";
const GOLD_BRIGHT = "#f7e28f";

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

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return formatShortDate(d);
}

export function ExerciseProgressClient({
  suggestions,
  defaultQuery,
}: {
  suggestions: string[];
  defaultQuery?: string | null;
}) {
  const initial = (defaultQuery?.trim() || suggestions[0] || "").trim();
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  useEffect(() => {
    const next = (defaultQuery?.trim() || "").trim();
    if (!next) return;
    setQuery(next);
    setDebounced(next);
  }, [defaultQuery]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    async function run() {
      const q = debounced.trim();
      if (!q) {
        setData(null);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/progress/exercise?q=${encodeURIComponent(q)}&days=365`,
        );
        const json = (await res.json()) as ApiOk | ApiErr;
        if (!res.ok || !("ok" in json) || !json.ok) {
          throw new Error("error" in json ? json.error : "Błąd pobierania danych");
        }
        setData(json);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : "Błąd pobierania danych");
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [debounced]);

  const points = useMemo(() => data?.points ?? [], [data]);

  const latest = useMemo(
    () => (points.length ? points[points.length - 1] : null),
    [points],
  );

  return (
    <div className="space-y-6">
      <div className="app-card p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                Wybrane ćwiczenie
              </p>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Postęp: e1RM i rekordy osobiste
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Wpisz lub wybierz nazwę ćwiczenia. Dla każdego dnia pokazujemy najlepszy zestaw (szacowane
                e1RM) oraz tonaż (suma powtórzeń × kg) w obrębie tego ruchu.
              </p>
            </div>

            <div className="w-full sm:w-[min(420px,50%)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  list="exercise-suggestions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Np. wyciskanie, przysiad…"
                  className="h-11 rounded-xl border-white/15 bg-black/25 pl-9 pr-3 text-white placeholder:text-white/30"
                />
                <datalist id="exercise-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <p className="mt-2 text-xs text-white/45">
                {loading
                  ? "Wczytywanie…"
                  : error
                    ? error
                    : latest
                      ? `Ostatni trening w zestawieniu: ${latest.date}`
                      : "—"}
              </p>
            </div>
          </div>

          {data?.matchedExerciseNames?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.matchedExerciseNames.slice(0, 6).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuery(n)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    n === debounced
                      ? "border-[var(--neon)]/35 bg-[var(--neon)]/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {data ? (
        <section className="space-y-3">
          {data.hasNewMax ? (
            <div className="rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 py-3 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
                NOWY MAX
              </p>
              <p className="mt-1 text-xs text-white/70">
                {[
                  data.newMax?.e1rm ? "e1RM" : null,
                  data.newMax?.weight ? "ciężar" : null,
                  data.newMax?.tonnage ? "tonaż" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                — najlepszy wynik w ostatnim treningu.
              </p>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Trophy}
            label="Rekord e1RM"
            value={`${data.prs.maxE1rm.value} kg`}
            hint={
              data.newMax?.e1rm
                ? "NOWY MAX"
                : data.prs.maxE1rm.date
                  ? fmtDate(data.prs.maxE1rm.date)
                  : "—"
            }
          />
          <StatCard
            icon={Dumbbell}
            label="Rekord ciężaru"
            value={`${data.prs.maxWeight.value} kg`}
            hint={
              data.newMax?.weight
                ? "NOWY MAX"
                : data.prs.maxWeight.date
                  ? fmtDate(data.prs.maxWeight.date)
                  : "—"
            }
          />
          <StatCard
            icon={Flame}
            label="Rekord tonażu"
            value={`${data.prs.maxTonnageKg.value} kg`}
            hint={
              data.newMax?.tonnage
                ? "NOWY MAX"
                : data.prs.maxTonnageKg.date
                  ? fmtDate(data.prs.maxTonnageKg.date)
                  : "—"
            }
          />
          </div>
        </section>
      ) : null}

      <div className="grid gap-2.5 lg:grid-cols-2">
        <div className="app-card relative overflow-hidden p-5">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/45 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--gym-gold)]/[0.07] blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="app-label text-[var(--gym-gold)]">Szacowana siła</p>
            <h3 className="mt-1.5 text-base font-semibold text-white">
              e1RM (najlepszy zestaw) wg dni
            </h3>
            <p className="mt-1 text-xs text-white/40">
              W każdym dniu bierzemy najwyższy szacunek e1RM spośród ukończonych serii.
            </p>
            <div className="mt-4 h-[248px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={points}
                  margin={{ top: 12, right: 10, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="exE1rmFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exE1rmStroke" x1="0" y1="0" x2="1" y2="0">
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
                    allowDecimals={false}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: "rgba(235,196,74,0.25)", strokeWidth: 1 }}
                    labelFormatter={(label) => formatShortDate(String(label))}
                    formatter={(value, _name, p) => {
                      const payload =
                        p && typeof p === "object" && "payload" in p
                          ? (p as { payload?: unknown }).payload
                          : null;
                      const reps =
                        payload &&
                        typeof payload === "object" &&
                        "bestReps" in payload
                          ? String((payload as { bestReps?: unknown }).bestReps ?? "—")
                          : "—";
                      const w =
                        payload &&
                        typeof payload === "object" &&
                        "bestWeight" in payload
                          ? String(
                              (payload as { bestWeight?: unknown }).bestWeight ??
                                "—",
                            )
                          : "—";
                      return [`${Number(value ?? 0)} kg (${reps} × ${w} kg)`, "e1RM"];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bestE1rm"
                    stroke="url(#exE1rmStroke)"
                    strokeWidth={2.5}
                    fill="url(#exE1rmFill)"
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
            </div>
          </div>
        </div>

        <div className="app-card relative overflow-hidden p-5">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/45 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[var(--gym-gold)]/[0.07] blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="app-label text-[var(--gym-gold)]">Obciążenie</p>
            <h3 className="mt-1.5 text-base font-semibold text-white">
              Tonaż ćwiczenia wg dni
            </h3>
            <p className="mt-1 text-xs text-white/40">
              Suma (powtórzenia × kg) wyłącznie dla wybranego ruchu.
            </p>
            <div className="mt-4 h-[248px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={points}
                  margin={{ top: 12, right: 10, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="exTonFill" x1="0" y1="0" x2="0" y2="1">
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
                    allowDecimals={false}
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
                    cursor={{ stroke: "rgba(235,196,74,0.25)", strokeWidth: 1 }}
                    labelFormatter={(label) => formatShortDate(String(label))}
                    formatter={(value) => [
                      `${Number(value ?? 0).toLocaleString("pl-PL")} kg`,
                      "Tonaż",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="tonnageKg"
                    stroke={GOLD}
                    strokeWidth={2.5}
                    fill="url(#exTonFill)"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

