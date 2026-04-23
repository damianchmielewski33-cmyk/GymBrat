"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type ApiErr = { error: string };

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
      <div className="glass-panel neon-glow relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                Per-ćwiczenie
              </p>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Progres e1RM i PR-y
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Wybierz ćwiczenie po nazwie. Liczymy TOP set (najlepszy e1RM) oraz tonnage tego ćwiczenia.
              </p>
            </div>

            <div className="w-full sm:w-[min(420px,50%)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  list="exercise-suggestions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj ćwiczenia (np. Bench, Przysiad...)"
                  className="h-11 rounded-xl border-white/15 bg-black/25 pl-9 pr-3 text-white placeholder:text-white/30"
                />
                <datalist id="exercise-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <p className="mt-2 text-xs text-white/45">
                {loading ? "Ładowanie…" : error ? error : latest ? `Ostatni punkt: ${latest.date}` : "—"}
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
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Trophy}
            label="PR e1RM"
            value={`${data.prs.maxE1rm.value} kg`}
            hint={data.prs.maxE1rm.date ? fmtDate(data.prs.maxE1rm.date) : "—"}
          />
          <StatCard
            icon={Dumbbell}
            label="PR ciężar"
            value={`${data.prs.maxWeight.value} kg`}
            hint={data.prs.maxWeight.date ? fmtDate(data.prs.maxWeight.date) : "—"}
          />
          <StatCard
            icon={Flame}
            label="PR tonnage"
            value={`${data.prs.maxTonnageKg.value} kg`}
            hint={data.prs.maxTonnageKg.date ? fmtDate(data.prs.maxTonnageKg.date) : "—"}
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,rgba(120,120,255,0.12),transparent_55%)]" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Strength
            </p>
            <h3 className="font-heading mt-1 text-lg font-semibold text-white">
              e1RM (TOP set) / dzień
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Najlepszy e1RM z danego dnia (z ukończonego seta).
            </p>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
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
                      return [`${Number(value ?? 0)} kg ( ${reps}×${w} )`, "e1RM"];
                    }}
                  />
                  <Line type="monotone" dataKey="bestE1rm" stroke="#ff2d55" strokeWidth={2} dot={{ r: 2.5, fill: "#ff2d55", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(225deg,rgba(255,45,85,0.12),transparent_55%)]" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Load
            </p>
            <h3 className="font-heading mt-1 text-lg font-semibold text-white">
              Tonnage ćwiczenia / dzień
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Suma (reps×kg) tylko dla tego ćwiczenia.
            </p>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="exTon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#ff2d55" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatShortDate(String(label))} formatter={(value) => [`${Number(value ?? 0)} kg`, "Tonnage"]} />
                  <Area type="monotone" dataKey="tonnageKg" stroke="#ff2d55" strokeWidth={2} fill="url(#exTon)" dot={{ r: 2.5, fill: "#ff2d55", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

