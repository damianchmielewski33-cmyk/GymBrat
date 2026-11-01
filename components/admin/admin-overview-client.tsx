"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, RefreshCw } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AdminMonitoringPanel } from "@/components/admin/admin-monitoring-panel";
import {
  AdminCard,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminStat,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

type AnalyticsJson = {
  range: { from: string; to: string };
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
  by_hour: { hour: number; label: string; views: number }[];
  total_views: number;
  peak: { hour: number; label: string; views: number };
  range?: { from: string; to: string };
  timezone?: string;
  by_day?: { ymd: string; label: string; hours: number[]; total: number }[];
};

const PRESETS = [
  { days: 7, label: "7 dni" },
  { days: 14, label: "14 dni" },
  { days: 30, label: "30 dni" },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: iso(from), to: iso(to) };
}

function presetOf(from: string, to: string): number | null {
  for (const p of PRESETS) {
    const r = rangeForDays(p.days);
    if (r.from === from && r.to === to) return p.days;
  }
  return null;
}

export function AdminOverviewClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [{ from, to }, setRange] = useState(() => rangeForDays(14));
  const [analytics, setAnalytics] = useState<AnalyticsJson | null>(null);
  const [hourly, setHourly] = useState<HourlyJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  const load = useCallback(
    async (showToast = false) => {
      setLoading(true);
      setError(null);
      const [a, h] = await Promise.all([
        adminRequest<AnalyticsJson>(
          `/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
        adminRequest<HourlyJson>("/api/admin/analytics/hourly"),
      ]);
      if (!a.ok || !h.ok) {
        const msg = "Nie udało się wczytać analityki (upewnij się, że jesteś zalogowany do panelu).";
        setError(msg);
        if (showToast) notifyError(msg);
      } else {
        setAnalytics(a.data);
        setHourly(h.data);
        if (showToast) notifySaved("Zaktualizowano dane analityki.");
      }
      setLoading(false);
    },
    [from, to, notifySaved, notifyError],
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

  const hourData = useMemo(() => hourly?.by_hour ?? [], [hourly]);
  const heatmapDays = useMemo(() => hourly?.by_day ?? [], [hourly]);

  const heatMax = useMemo(() => {
    let m = 0;
    for (const d of heatmapDays) for (const v of d.hours) m = Math.max(m, v);
    return m;
  }, [heatmapDays]);

  const heatColor = useCallback(
    (v: number) => {
      if (v <= 0 || heatMax <= 0) return "rgba(255,255,255,0.04)";
      const alpha = 0.12 + 0.62 * Math.min(1, v / heatMax);
      return `rgba(255,45,85,${alpha.toFixed(3)})`;
    },
    [heatMax],
  );

  const activePreset = presetOf(from, to);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<BarChart3 />}
        title="Analityka"
        description="Ruch w aplikacji, aktywność kont oraz limity hostingu i bazy w jednym miejscu."
        actions={
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load(true)}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} aria-hidden />
            Odśwież
          </Button>
        }
      />

      <AdminCard title="Zakres raportu">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Szybki wybór zakresu">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                aria-pressed={activePreset === p.days}
                onClick={() => setRange(rangeForDays(p.days))}
                className={cn(
                  "h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
                  activePreset === p.days
                    ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                    : "border-white/12 text-white/65 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                Ostatnie {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="range-from" className="block text-xs font-medium text-white/65">
                Od
              </label>
              <Input
                id="range-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="range-to" className="block text-xs font-medium text-white/65">
                Do
              </label>
              <Input
                id="range-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="w-44"
              />
            </div>
          </div>
        </div>
      </AdminCard>

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {loading && !analytics ? <AdminLoading label="Ładowanie analityki…" /> : null}

      {analytics ? (
        <div
          className={cn(
            "grid gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-4",
            loading && "opacity-60",
          )}
        >
          <AdminStat
            label="Odsłony"
            value={analytics.totals.total_views}
            hint={`${analytics.totals.authenticated_views} zalogowanych · ${analytics.totals.anonymous_views} anonimowych`}
          />
          <AdminStat label="Unikalni odwiedzający" value={analytics.totals.unique_visitors} />
          <AdminStat label="Konta w bazie" value={analytics.accounts.registered_total} tone="gold" />
          <AdminStat
            label="Aktywni zalogowani"
            value={analytics.accounts.distinct_logged_in_visitors_in_range}
            hint="w wybranym zakresie"
          />
        </div>
      ) : null}

      <AdminMonitoringPanel />

      {analytics ? (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard
              title="Najczęstsze ekrany"
              description="Rozkład wizyt według zmapowanych ścieżek aplikacji."
            >
              <div className="h-[280px] w-full">
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
                    <Bar dataKey="views" fill="var(--gym-gold)" radius={[0, 6, 6, 0]} name="Wejścia" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>

            <AdminCard
              title="Ruch wg godzin (ostatnie 7 dni)"
              description={`Suma wejść w przedziałach godzinowych${hourly?.peak ? ` (szczyt ${hourly.peak.label})` : ""}.`}
            >
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                      vertical={false}
                    />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="views" fill="var(--gym-gold)" radius={[6, 6, 0, 0]} name="Wejścia" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>
          </div>

          {heatmapDays.length ? (
            <AdminCard
              title="Mapa ciepła wejść (godzina × dzień)"
              description={`Ostatnie 7 dni w strefie ${hourly?.timezone ?? "Europe/Warsaw"}. Jaśniej = więcej wejść.`}
            >
              <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
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
                        <div className="truncate pr-2 text-[11px] text-white/70">{d.label}</div>
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
                    <span>Skala: 0 → {heatMax}</span>
                    <span className="font-mono">
                      {hourly?.range?.from && hourly?.range?.to
                        ? `${hourly.range.from} → ${hourly.range.to}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            </AdminCard>
          ) : null}

          <AdminCard
            title="Dziennik zachowań"
            description={`${analytics.activity_events.length} zdarzeń · logowania i rejestracje`}
            flush
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={activityLogOpen}
                onClick={() => setActivityLogOpen((v) => !v)}
              >
                {activityLogOpen ? "Ukryj dziennik" : "Pokaż dziennik"}
              </Button>
            }
          >
            {activityLogOpen ? (
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
                        <td className="whitespace-nowrap px-5 py-2.5 text-white/65">
                          {ev.time_display}
                        </td>
                        <td className="px-5 py-2.5">{ev.action}</td>
                        <td className="px-5 py-2.5 text-white/75">{ev.actor_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </AdminCard>
        </div>
      ) : null}
    </div>
  );
}
