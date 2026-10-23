"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { AdminCard, AdminLoading, AdminNotice } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeterStatus, MonitoringSnapshot, UsageMeter } from "@/lib/monitoring/types";

const POLL_MS = 20_000;

function statusTone(status: MeterStatus): {
  bar: string;
  text: string;
  ring: string;
} {
  switch (status) {
    case "critical":
      return {
        bar: "bg-gradient-to-r from-rose-500 to-rose-400",
        text: "text-rose-300",
        ring: "border-rose-500/35",
      };
    case "warn":
      return {
        bar: "bg-gradient-to-r from-amber-500 to-[var(--gym-gold)]",
        text: "text-amber-200",
        ring: "border-amber-500/30",
      };
    case "unconfigured":
    case "error":
      return {
        bar: "bg-white/25",
        text: "text-white/55",
        ring: "border-white/12",
      };
    default:
      return {
        bar: "bg-gradient-to-r from-[var(--gym-gold-deep)] via-[var(--neon)] to-[var(--gym-gold-bright)]",
        text: "text-white",
        ring: "border-white/10",
      };
  }
}

function MeterCard({ meter }: { meter: UsageMeter }) {
  const tone = statusTone(meter.status);
  const width = Math.min(100, Math.max(0, meter.percent));
  const showBar =
    meter.status !== "unconfigured" && meter.status !== "error";

  return (
    <div
      className={cn(
        "rounded-xl border bg-black/25 p-4",
        tone.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            {meter.label}
          </p>
          <p className={cn("font-heading mt-1.5 text-2xl font-semibold tabular-nums", tone.text)}>
            {showBar ? `${meter.percent.toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-white/55">
            {meter.usedLabel}
            {showBar ? (
              <>
                {" "}
                <span className="text-white/35">/</span> {meter.limitLabel}
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-wide text-white/40">
          {meter.source}
        </span>
      </div>

      {showBar ? (
        <div className="relative mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn("h-full rounded-full", tone.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      ) : (
        <div className="mt-3.5 h-2.5 w-full rounded-full bg-white/8" />
      )}

      {meter.detail ? (
        <p className="mt-2.5 text-[11px] leading-snug text-white/40">{meter.detail}</p>
      ) : null}
    </div>
  );
}

export function AdminMonitoringPanel() {
  const [data, setData] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    try {
      const res = await fetch(
        `/api/admin/monitoring${force ? "?force=1" : ""}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MonitoringSnapshot & { ok?: boolean };
      setData(json);
      setError(null);
    } catch {
      setError("Nie udało się wczytać monitoringu limitów.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const meters: UsageMeter[] = data?.meters ?? [];
  const critical = meters.some((m) => m.status === "critical");

  const unconfigured = meters.filter((m) => m.status === "unconfigured").length;

  return (
    <AdminCard
      title={
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--neon)]" aria-hidden />
          Limity hostingu i bazy
        </span>
      }
      description={
        <>
          Render (CPU, RAM, bandwidth) + Turso (storage, rows) — odświeżanie co {POLL_MS / 1000} s.
          {data?.updatedAt ? (
            <>
              {" "}
              Ostatni pomiar:{" "}
              <span className="tabular-nums text-white/70">
                {new Date(data.updatedAt).toLocaleTimeString("pl-PL")}
              </span>
            </>
          ) : null}
        </>
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(true);
          }}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} aria-hidden />
          Odśwież
        </Button>
      }
      bodyClassName="space-y-4"
    >
      {critical ? (
        <AdminNotice tone="danger">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Co najmniej jeden limit jest blisko wyczerpania (≥ 95%). Sprawdź cleanup / plan Render
            lub Turso.
          </span>
        </AdminNotice>
      ) : null}

      {unconfigured > 0 ? (
        <AdminNotice
          tone="info"
          action={
            <Link
              href="/admin/settings"
              className="text-sm font-semibold text-[var(--gym-gold)] hover:underline"
            >
              Skonfiguruj
            </Link>
          }
        >
          {unconfigured} z {meters.length} mierników nie ma skonfigurowanego źródła danych.
        </AdminNotice>
      ) : null}

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {loading && !data ? (
        <AdminLoading label="Ładowanie limitów…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {meters.map((m) => (
            <MeterCard key={m.id} meter={m} />
          ))}
        </div>
      )}

      {data?.hints?.length ? (
        <ul className="space-y-1 border-t border-white/10 pt-4 text-[11px] text-white/40">
          {data.hints.map((h) => (
            <li key={h}>• {h}</li>
          ))}
        </ul>
      ) : null}
    </AdminCard>
  );
}
