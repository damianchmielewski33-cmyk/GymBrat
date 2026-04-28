"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

type AnalyticsJson = {
  range: { from: string; to: string };
  deployment?: {
    filter: string;
    include_untagged: boolean;
  };
  totals: {
    total_views: number;
    unique_visitors: number;
    anonymous_views: number;
    authenticated_views: number;
  };
  screens: {
    screen_key: string;
    label: string;
    total_views: number;
    unique_visitors: number;
  }[];
  accounts: {
    registered_total: number;
    distinct_logged_in_visitors_in_range: number;
  };
  activity_events: {
    id: string;
    action: string;
    actor_label: string;
    time_display: string;
  }[];
};

type HourlyJson = {
  deployment?: {
    filter: string;
    include_untagged: boolean;
  };
  by_hour: { hour: number; label: string; views: number }[];
  total_views: number;
  peak: { hour: number; label: string; views: number };
  range?: { from: string; to: string };
  timezone?: string;
  by_day?: { ymd: string; label: string; hours: number[]; total: number }[];
};

type PurgeWorkoutsJson = {
  ok: true;
  deleted: { workouts: number; trainingSessions: number };
};

type PurgeMealsJson = {
  ok: true;
  deleted: { mealLogs: number };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 13);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export function AdminOverviewClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [{ from, to }, setRange] = useState(defaultRange);
  const [analytics, setAnalytics] = useState<AnalyticsJson | null>(null);
  const [hourly, setHourly] = useState<HourlyJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeUntagged, setIncludeUntagged] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState<"workouts" | "meals" | null>(null);

  const load = useCallback(
    async (showSuccessToast = false) => {
      setLoading(true);
      setError(null);
      try {
        const legacy = includeUntagged ? "&include_untagged=1" : "";
        const [aRes, hRes] = await Promise.all([
          fetch(
            `/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${legacy}`,
          ),
          fetch(`/api/admin/analytics/hourly${includeUntagged ? "?include_untagged=1" : ""}`),
        ]);
        if (!aRes.ok) throw new Error("analytics");
        if (!hRes.ok) throw new Error("hourly");
        setAnalytics((await aRes.json()) as AnalyticsJson);
        setHourly((await hRes.json()) as HourlyJson);
        if (showSuccessToast) notifySaved("Zaktualizowano dane analityki.");
      } catch {
        const msg =
          "Nie udało się wczytać analityki (upewnij się, że jesteś zalogowany do panelu).";
        setError(msg);
        if (showSuccessToast) notifyError(msg);
      } finally {
        setLoading(false);
      }
    },
    [from, to, includeUntagged, notifySaved, notifyError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () =>
      analytics?.screens.map((s) => ({
        label: s.label.length > 18 ? `${s.label.slice(0, 16)}…` : s.label,
        views: s.total_views,
        uniques: s.unique_visitors,
      })) ?? [],
    [analytics],
  );

  const hourData = hourly?.by_hour ?? [];
  const heatmapDays = hourly?.by_day ?? [];

  const heatMax = useMemo(() => {
    let m = 0;
    for (const d of heatmapDays) {
      for (const v of d.hours) m = Math.max(m, v);
    }
    return m;
  }, [heatmapDays]);

  const heatColor = useCallback((v: number) => {
    if (v <= 0 || heatMax <= 0) return "rgba(255,255,255,0.04)";
    const t = Math.min(1, v / heatMax);
    // neon-ish scale: dark -> rose
    const alpha = 0.12 + 0.62 * t;
    return `rgba(255,45,85,${alpha.toFixed(3)})`;
  }, [heatMax]);

  const purge = useCallback(
    async (kind: "workouts" | "meals") => {
      if (purgeBusy) return;
      const label =
        kind === "workouts"
          ? "wszystkie treningi (historię treningów)"
          : "wszystkie posiłki (historię jedzenia)";
      if (
        !confirm(
          `Na pewno wyczyścić ${label} z całej bazy? Tej operacji nie da się cofnąć.`,
        )
      ) {
        return;
      }

      setPurgeBusy(kind);
      try {
        const endpoint =
          kind === "workouts"
            ? "/api/admin/purge/workouts"
            : "/api/admin/purge/meals";
        await ensureCsrfCookie();
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { ...getXsrfHeaders() },
        });
        const json: unknown = await res.json();
        if (!res.ok) throw new Error("request_failed");
        if (!isRecord(json) || json.ok !== true) throw new Error("request_failed");

        if (kind === "workouts") {
          const j = json as Partial<PurgeWorkoutsJson>;
          const deleted = isRecord(j.deleted) ? j.deleted : {};
          const w = Number((deleted as Record<string, unknown>).workouts ?? 0);
          const ts = Number((deleted as Record<string, unknown>).trainingSessions ?? 0);
          notifySaved(`Wyczyszczono: treningi ${w}, sesje treningowe ${ts}.`);
        } else {
          const j = json as Partial<PurgeMealsJson>;
          const deleted = isRecord(j.deleted) ? j.deleted : {};
          const m = Number((deleted as Record<string, unknown>).mealLogs ?? 0);
          notifySaved(`Wyczyszczono: posiłki ${m}.`);
        }
      } catch {
        notifyError(
          "Nie udało się wykonać czyszczenia. Sprawdź, czy panel admina jest odblokowany.",
        );
      } finally {
        setPurgeBusy(null);
      }
    },
    [purgeBusy, notifySaved, notifyError],
  );

  return (
    <div className="space-y-8">
      <section className="glass-panel neon-glow p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Zakres raportu
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">Od</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="border-white/15 bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Do</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="border-white/15 bg-black/40"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="bg-[var(--neon)] font-semibold text-white hover:bg-[#ff4d6d]"
          >
            Odśwież dane
          </Button>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            className="rounded border-white/20 bg-black/40"
            checked={includeUntagged}
            onChange={(e) => setIncludeUntagged(e.target.checked)}
          />
          Uwzględnij wpisy bez znacznika środowiska (np. sprzed migracji — może mieszać dev i prod)
        </label>
        {analytics?.deployment ? (
          <p className="mt-2 text-xs text-white/45">
            Aktywny filtr środowiska:{" "}
            <span className="font-mono text-white/70">{analytics.deployment.filter}</span>
            {analytics.deployment.include_untagged
              ? " (łącznie z nieoznaczonymi)"
              : " — tylko zdarzenia z tego wdrożenia"}
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="glass-panel neon-glow p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Narzędzia administracyjne
        </p>
        <h2 className="font-heading mt-1 text-lg font-semibold text-white">
          Czyszczenie historii
        </h2>
        <p className="mt-2 text-sm text-white/55">
          Opcje poniżej usuwają dane z całej bazy. Używaj ostrożnie.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            disabled={purgeBusy != null}
            onClick={() => void purge("workouts")}
          >
            {purgeBusy === "workouts"
              ? "Czyszczenie…"
              : "Wyczyść wszystkie treningi"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            disabled={purgeBusy != null}
            onClick={() => void purge("meals")}
          >
            {purgeBusy === "meals"
              ? "Czyszczenie…"
              : "Wyczyść wszystkie posiłki"}
          </Button>
        </div>

      </section>

      {!loading && analytics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Wejścia (odsłony)", value: analytics.totals.total_views },
            { label: "Unikalni odwiedzający", value: analytics.totals.unique_visitors },
            {
              label: "Konta zarejestrowane (cała baza)",
              value: analytics.accounts.registered_total,
            },
            {
              label: "Aktywni zalogowani (zakres)",
              value: analytics.accounts.distinct_logged_in_visitors_in_range,
            },
          ].map((c) => (
            <div key={c.label} className="glass-panel rounded-xl border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-wide text-white/45">{c.label}</p>
              <p className="font-heading mt-2 text-2xl font-semibold text-white">{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && analytics ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel neon-glow p-5 sm:p-6">
            <h2 className="font-heading text-lg font-semibold text-white">
              Najczęstsze ekrany
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Rozkład wizyt według zmapowanych ścieżek aplikacji.
            </p>
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="views" fill="#ff2d55" radius={[0, 6, 6, 0]} name="Wejścia" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel neon-glow p-5 sm:p-6">
            <h2 className="font-heading text-lg font-semibold text-white">
              Ruch wg godzin (ostatnie 7 dni)
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Suma wejść w przedziałach godzinowych {hourly?.peak ? `(szczyt ${hourly.peak.label})` : ""}.
            </p>
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="views" fill="#ff2d55" radius={[6, 6, 0, 0]} name="Wejścia" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && hourly?.by_day?.length ? (
        <div className="glass-panel neon-glow p-5 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-white">
            Mapa ciepła wejść (godzina × dzień)
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Ostatnie 7 dni w strefie {hourly.timezone ?? "Europe/Warsaw"}. Jaśniej = więcej wejść.
          </p>

          <div className="mt-4 overflow-auto">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[140px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-white/45">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center font-mono">
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>

              <div className="mt-2 space-y-1">
                {heatmapDays.map((d) => (
                  <div
                    key={d.ymd}
                    className="grid grid-cols-[140px_repeat(24,minmax(0,1fr))] gap-1"
                  >
                    <div className="truncate pr-2 text-[11px] text-white/70">
                      {d.label}
                    </div>
                    {d.hours.map((v, h) => (
                      <div
                        key={`${d.ymd}_${h}`}
                        title={`${d.ymd} ${String(h).padStart(2, "0")}:00 — ${v} wejść`}
                        className="h-6 rounded-md border border-white/10"
                        style={{ backgroundColor: heatColor(v) }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/45">
                <span>
                  Skala: 0 → {heatMax}
                </span>
                <span className="font-mono">
                  {hourly.range?.from && hourly.range?.to ? `${hourly.range.from} → ${hourly.range.to}` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && analytics ? (
        <div className="glass-panel neon-glow overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-heading text-lg font-semibold text-white">
              Dziennik zachowań
            </h2>
            <p className="text-xs text-white/50">
              Logowania, rejestracje i dalsze typy zdarzeń można rozszerzać w kodzie.
            </p>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-5 py-3 font-medium">Czas</th>
                  <th className="px-5 py-3 font-medium">Zdarzenie</th>
                  <th className="px-5 py-3 font-medium">Kto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/85">
                {analytics.activity_events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-5 py-2.5 text-white/65">{ev.time_display}</td>
                    <td className="px-5 py-2.5">{ev.action}</td>
                    <td className="px-5 py-2.5 text-white/75">{ev.actor_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/55">Ładowanie analityki…</p>
      ) : null}
    </div>
  );
}
