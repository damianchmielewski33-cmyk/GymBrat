"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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

const GOLD = "#c9a45c";
const GOLD_BRIGHT = "#e6c987";
const SKY = "#7dd3fc";
const GREEN = "#3ecf72";
const AXIS = { fill: "rgba(255,255,255,0.5)", fontSize: 11 };
const GRID = "rgba(255,255,255,0.07)";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(201, 164, 92, 0.3)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};
const tooltipLabelStyle = { color: GOLD_BRIGHT, fontWeight: 600, marginBottom: 4 };
const cursorStyle = { fill: "rgba(201,164,92,0.08)" };
const legendStyle = { fontSize: 12, color: "rgba(255,255,255,0.65)" };

const fmtInt = (n: number) => n.toLocaleString("pl-PL");
const shortDay = (ymd: string) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
const longDay = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pl-PL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
  });
};

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0) return <span className="text-white/45">brak danych z poprzedniego okresu</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={up ? "text-state-success" : "text-state-error"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs poprzedni okres ({fmtInt(prev)})
    </span>
  );
}

function EmptyChart({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/45">
      {children}
    </div>
  );
}

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
  timeline: {
    ymd: string;
    views: number;
    unique_visitors: number;
    signups: number;
    workouts: number;
    revenue_pln: number;
    orders: number;
  }[];
  previous: { total_views: number; unique_visitors: number };
  business: {
    signups: number;
    workouts: number;
    workout_users: number;
    revenue_pln: number;
    orders: number;
    visitors_total: number;
    visitors_logged_in: number;
  };
};

type HourlyJson = {
  by_hour: { hour: number; label: string; views: number }[];
  total_views: number;
  peak: { hour: number; label: string; views: number };
  range?: { from: string; to: string };
  timezone?: string;
  by_day?: { ymd: string; label: string; hours: number[]; total: number }[];
};

type RetentionJson = {
  weekly: { cohort_start: string; size: number; retention: (number | null)[] }[];
  day_retention: { day: number; eligible: number; returned: number; percent: number | null }[];
};

const PRESETS = [
  { days: 7, label: "7 dni" },
  { days: 14, label: "14 dni" },
  { days: 30, label: "30 dni" },
] as const;

/** Data lokalna (nie UTC) — spójna z `input type="date"` i strefą analityki. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  const [retention, setRetention] = useState<RetentionJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  const load = useCallback(
    async (showToast = false) => {
      setLoading(true);
      setError(null);
      void adminRequest<RetentionJson>("/api/admin/analytics/retention").then((r) => {
        if (r.ok) setRetention(r.data);
      });
      const [a, h] = await Promise.all([
        adminRequest<AnalyticsJson>(
          `/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
        adminRequest<HourlyJson>(
          `/api/admin/analytics/hourly?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        ),
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
  const timeline = useMemo(
    () => analytics?.timeline.map((d) => ({ ...d, label: shortDay(d.ymd) })) ?? [],
    [analytics],
  );
  const hasRevenue = (analytics?.business.revenue_pln ?? 0) > 0;
  const hourRange = hourly?.range ? `${hourly.range.from} → ${hourly.range.to}` : "wybrany zakres";
  const heatmapDays = useMemo(() => hourly?.by_day ?? [], [hourly]);

  const heatMax = useMemo(() => {
    let m = 0;
    for (const d of heatmapDays) for (const v of d.hours) m = Math.max(m, v);
    return m;
  }, [heatmapDays]);

  const heatColor = useCallback(
    (v: number) => {
      if (v <= 0 || heatMax <= 0) return "rgba(255,255,255,0.04)";
      const alpha = 0.16 + 0.8 * Math.min(1, v / heatMax);
      return `rgba(201,164,92,${alpha.toFixed(3)})`;
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
            value={fmtInt(analytics.totals.total_views)}
            hint={
              <>
                <Delta cur={analytics.totals.total_views} prev={analytics.previous.total_views} />
                <br />
                {analytics.totals.authenticated_views} zalogowanych · {analytics.totals.anonymous_views} anonimowych
              </>
            }
          />
          <AdminStat
            label="Unikalni odwiedzający"
            value={fmtInt(analytics.totals.unique_visitors)}
            hint={<Delta cur={analytics.totals.unique_visitors} prev={analytics.previous.unique_visitors} />}
          />
          <AdminStat
            label="Nowe konta"
            value={fmtInt(analytics.business.signups)}
            hint={`${fmtInt(analytics.accounts.registered_total)} kont w bazie`}
            tone="gold"
          />
          <AdminStat
            label="Aktywni zalogowani"
            value={fmtInt(analytics.accounts.distinct_logged_in_visitors_in_range)}
            hint={`${fmtInt(analytics.business.workout_users)} z zapisanym treningiem`}
          />
          <AdminStat
            label="Zapisane treningi"
            value={fmtInt(analytics.business.workouts)}
            hint="w wybranym zakresie"
          />
          <AdminStat
            label="Przychód (opłacone)"
            value={`${analytics.business.revenue_pln.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`}
            hint={`${analytics.business.orders} zamówień`}
            tone="ok"
          />
          <AdminStat
            label="Konwersja odwiedzin → konto"
            value={
              analytics.totals.unique_visitors > 0
                ? `${((analytics.business.signups / analytics.totals.unique_visitors) * 100).toFixed(1)}%`
                : "—"
            }
            hint="nowe konta / unikalni odwiedzający"
          />
          <AdminStat
            label="Udział zalogowanych"
            value={
              analytics.business.visitors_total > 0
                ? `${((analytics.business.visitors_logged_in / analytics.business.visitors_total) * 100).toFixed(0)}%`
                : "—"
            }
            hint="odwiedzający z kontem"
          />
        </div>
      ) : null}

      <AdminMonitoringPanel />

      {analytics ? (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <AdminCard
            title="Ruch dzień po dniu"
            description="Odsłony i unikalni odwiedzający w wybranym zakresie."
          >
            <div className="h-[280px] w-full">
              {timeline.some((d) => d.views > 0) ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={100} initialDimension={{ width: 320, height: 200 }}>
                  <AreaChart data={timeline} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gUniq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SKY} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={SKY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      cursor={{ stroke: GOLD, strokeOpacity: 0.4 }}
                      labelFormatter={(_, p) => (p?.[0]?.payload?.ymd ? longDay(p[0].payload.ymd) : "")}
                    />
                    <Legend wrapperStyle={legendStyle} iconType="circle" />
                    <Area type="monotone" dataKey="views" name="Odsłony" stroke={GOLD} strokeWidth={2} fill="url(#gViews)" activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="unique_visitors" name="Unikalni" stroke={SKY} strokeWidth={2} fill="url(#gUniq)" activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart>Brak odsłon w wybranym zakresie.</EmptyChart>
              )}
            </div>
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard
              title="Rejestracje i treningi"
              description="Nowe konta oraz zapisane treningi dziennie."
            >
              <div className="h-[260px] w-full">
                {timeline.some((d) => d.signups > 0 || d.workouts > 0) ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={100} initialDimension={{ width: 320, height: 200 }}>
                    <ComposedChart data={timeline} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        cursor={cursorStyle}
                        labelFormatter={(_, p) => (p?.[0]?.payload?.ymd ? longDay(p[0].payload.ymd) : "")}
                      />
                      <Legend wrapperStyle={legendStyle} iconType="circle" />
                      <Bar dataKey="workouts" name="Treningi" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line type="monotone" dataKey="signups" name="Nowe konta" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart>Brak rejestracji i treningów w zakresie.</EmptyChart>
                )}
              </div>
            </AdminCard>

            <AdminCard
              title="Przychód dzienny"
              description="Opłacone zamówienia (zł) wg dnia płatności."
            >
              <div className="h-[260px] w-full">
                {hasRevenue ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={100} initialDimension={{ width: 320, height: 200 }}>
                    <BarChart data={timeline} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        cursor={cursorStyle}
                        labelFormatter={(_, p) => (p?.[0]?.payload?.ymd ? longDay(p[0].payload.ymd) : "")}
                        formatter={(v) => [`${Number(v).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`, "Przychód"]}
                      />
                      <Bar dataKey="revenue_pln" name="Przychód" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart>Brak opłaconych zamówień w zakresie.</EmptyChart>
                )}
              </div>
            </AdminCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminCard
              title="Najczęstsze ekrany"
              description="Odsłony i unikalni odwiedzający wg ekranu (top 10)."
            >
              <div className="h-[320px] w-full">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={100} initialDimension={{ width: 320, height: 200 }}>
                    <BarChart data={chartData.slice(0, 10)} layout="vertical" margin={{ left: 4, right: 16, top: 4 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="label" width={124} tick={{ ...AXIS, fill: "rgba(255,255,255,0.7)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle} />
                      <Legend wrapperStyle={legendStyle} iconType="circle" />
                      <Bar dataKey="views" name="Odsłony" fill={GOLD} radius={[0, 5, 5, 0]} barSize={10} />
                      <Bar dataKey="uniques" name="Unikalni" fill={SKY} radius={[0, 5, 5, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart>Brak odsłon w zakresie.</EmptyChart>
                )}
              </div>
            </AdminCard>

            <AdminCard
              title="Ruch wg godziny doby"
              description={`${hourRange}${hourly?.peak && hourly.peak.views > 0 ? ` · szczyt ${hourly.peak.label} (${fmtInt(hourly.peak.views)})` : ""}. Zakres mapy: maks. 31 dni.`}
            >
              <div className="h-[320px] w-full">
                {hourly && hourly.total_views > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={100} initialDimension={{ width: 320, height: 200 }}>
                    <BarChart data={hourData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="hour" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID }} interval={1} tickFormatter={(h) => String(h).padStart(2, "0")} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} />
                      <Bar dataKey="views" name="Wejścia" radius={[4, 4, 0, 0]}>
                        {hourData.map((h) => (
                          <Cell key={h.hour} fill={h.hour === hourly.peak.hour ? GOLD_BRIGHT : GOLD} fillOpacity={h.hour === hourly.peak.hour ? 1 : 0.65} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart>Brak wejść w zakresie.</EmptyChart>
                )}
              </div>
            </AdminCard>
          </div>

          {retention ? (
            <AdminCard
              title="Retencja użytkowników"
              description="Jaki odsetek nowych kont wraca do aplikacji (ostatnie 8 tygodni rejestracji, niezależnie od zakresu)."
            >
              <div className="mb-4 grid grid-cols-3 gap-3">
                {retention.day_retention.map((r) => (
                  <AdminStat
                    key={r.day}
                    label={`Retencja D${r.day}`}
                    value={r.percent == null ? "—" : `${r.percent.toFixed(1)}%`}
                    hint={r.eligible ? `${r.returned} z ${r.eligible} kont` : "za mało danych"}
                    tone="gold"
                  />
                ))}
              </div>
              {retention.weekly.some((c) => c.size > 0) ? (
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-[11px]">
                    <thead className="text-white/50">
                      <tr>
                        <th className="px-2 text-left font-medium">Kohorta (tydz.)</th>
                        <th className="font-medium">Konta</th>
                        {retention.weekly.map((_, k) => (
                          <th key={k} className="font-mono font-medium">
                            T{k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {retention.weekly.map((c) => (
                        <tr key={c.cohort_start}>
                          <td className="px-2 text-left text-white/70">{shortDay(c.cohort_start)}</td>
                          <td className="tabular-nums text-white/70">{c.size}</td>
                          {c.retention.map((v, k) => (
                            <td
                              key={k}
                              title={v == null ? "brak danych" : `${v}% aktywnych w tygodniu ${k}`}
                              className="h-7 rounded-md tabular-nums text-white/90"
                              style={{
                                backgroundColor:
                                  v == null
                                    ? "transparent"
                                    : `rgba(201,164,92,${(0.08 + 0.85 * (v / 100)).toFixed(3)})`,
                              }}
                            >
                              {v == null ? "" : `${Math.round(v)}%`}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-white/45">Brak nowych kont w ostatnich 8 tygodniach.</p>
              )}
            </AdminCard>
          ) : null}

          {heatmapDays.length ? (
            <AdminCard
              title="Mapa ciepła wejść (dzień × godzina)"
              description={`${hourRange} w strefie ${hourly?.timezone ?? "Europe/Warsaw"}. Jaśniej = więcej wejść.`}
            >
              <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <div className="min-w-[880px]">
                  <div className="grid grid-cols-[140px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-white/50">
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
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-2">
                      0
                      <span
                        aria-hidden
                        className="h-2 w-28 rounded-full"
                        style={{ background: "linear-gradient(90deg, rgba(201,164,92,0.16), rgba(201,164,92,0.96))" }}
                      />
                      {heatMax}
                    </span>
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
                  <thead className="sticky top-0 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/50">
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
