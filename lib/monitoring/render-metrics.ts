/**
 * Oficjalne metryki Render (CPU / RAM / bandwidth) przez Public API.
 * Docs: https://api-docs.render.com/reference/get-memory
 */

import {
  clampPercent,
  formatBytes,
  latestSeriesValue,
  statusFromPercent,
  sumSeriesValues,
  toBytes,
} from "@/lib/monitoring/format";
import type { UsageMeter } from "@/lib/monitoring/types";
import { cacheGet, cacheSet } from "@/lib/community/perf-cache";

const CACHE_KEY = "monitoring:render";
const CACHE_TTL_MS = 20_000;
const API_BASE = "https://api.render.com/v1";

type SeriesResponse = {
  values?: { timestamp?: string; value?: number | null }[];
  unit?: string;
}[];

export type RenderConfig = {
  apiKey: string;
  serviceId: string;
  /** Miesięczny limit egress (Hobby = 5 GB). */
  bandwidthLimitGb: number;
};

export function getRenderConfig(): RenderConfig | null {
  const apiKey = process.env.RENDER_API_KEY?.trim();
  const serviceId = process.env.RENDER_SERVICE_ID?.trim();
  if (!apiKey || !serviceId) return null;
  const raw = process.env.RENDER_BANDWIDTH_LIMIT_GB?.trim();
  const parsed = raw ? Number(raw) : 5;
  const bandwidthLimitGb =
    Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  return { apiKey, serviceId, bandwidthLimitGb };
}

async function fetchMetric(
  path: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<SeriesResponse | null> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Render ${path} HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
    );
  }
  return (await res.json()) as SeriesResponse;
}

function monthWindowIso(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 0, 0, 0),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

function recentWindowIso(minutes = 15): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function collectRenderMeters(
  opts?: { force?: boolean },
): Promise<{ meters: UsageMeter[]; error?: string }> {
  const cfg = getRenderConfig();
  if (!cfg) {
    return {
      meters: [
        {
          id: "render-unconfigured",
          label: "Render (hosting)",
          source: "Render API",
          percent: 0,
          usedLabel: "—",
          limitLabel: "—",
          status: "unconfigured",
          detail:
            "Ustaw RENDER_API_KEY i RENDER_SERVICE_ID (ID serwisu srv-… z dashboardu).",
        },
      ],
    };
  }

  if (!opts?.force) {
    const cached = cacheGet<{ meters: UsageMeter[]; error?: string }>(CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const recent = recentWindowIso(20);
    const month = monthWindowIso();
    const base = {
      resource: cfg.serviceId,
      resolutionSeconds: "60",
      aggregationMethod: "AVG",
    };

    const [
      memUsage,
      memLimit,
      cpuUsage,
      cpuLimit,
      bandwidth,
    ] = await Promise.all([
      fetchMetric("/metrics/memory", cfg.apiKey, {
        ...base,
        startTime: recent.start,
        endTime: recent.end,
      }),
      fetchMetric("/metrics/memory-limit", cfg.apiKey, {
        ...base,
        startTime: recent.start,
        endTime: recent.end,
      }),
      fetchMetric("/metrics/cpu", cfg.apiKey, {
        ...base,
        startTime: recent.start,
        endTime: recent.end,
      }),
      fetchMetric("/metrics/cpu-limit", cfg.apiKey, {
        ...base,
        startTime: recent.start,
        endTime: recent.end,
      }),
      fetchMetric("/metrics/bandwidth", cfg.apiKey, {
        resource: cfg.serviceId,
        startTime: month.start,
        endTime: month.end,
        resolutionSeconds: "3600",
      }),
    ]);

    const meters: UsageMeter[] = [];

    const memUsedRaw = latestSeriesValue(memUsage);
    const memCapRaw = latestSeriesValue(memLimit);
    if (memUsedRaw && memCapRaw && memCapRaw.value > 0) {
      const memUsed = toBytes(memUsedRaw.value, memUsedRaw.unit, {
        assumeGbIfSmall: true,
      });
      const memCap = toBytes(memCapRaw.value, memCapRaw.unit, {
        assumeGbIfSmall: true,
      });
      const percent = clampPercent(memUsed, memCap);
      meters.push({
        id: "render-memory",
        label: "Pamięć (Render)",
        source: "Render Metrics",
        percent,
        usedLabel: formatBytes(memUsed),
        limitLabel: formatBytes(memCap),
        status: statusFromPercent(percent),
        detail: "Średnia z ostatnich ~20 min względem limitu instancji.",
      });
    }

    const cpuUsed = latestSeriesValue(cpuUsage);
    const cpuCap = latestSeriesValue(cpuLimit);
    if (cpuUsed && cpuCap && cpuCap.value > 0) {
      const percent = clampPercent(cpuUsed.value, cpuCap.value);
      meters.push({
        id: "render-cpu",
        label: "CPU (Render)",
        source: "Render Metrics",
        percent,
        usedLabel: `${Math.round(cpuUsed.value * 1000) / 1000}`,
        limitLabel: `${Math.round(cpuCap.value * 1000) / 1000}`,
        status: statusFromPercent(percent),
        detail: "Udział CPU względem limitu planu compute.",
      });
    }

    const bwUsedRaw = sumSeriesValues(bandwidth);
    const bwLimitBytes = cfg.bandwidthLimitGb * 1024 * 1024 * 1024;
    if (bwUsedRaw) {
      const bwUsed = toBytes(bwUsedRaw.value, bwUsedRaw.unit);
      const percent = clampPercent(bwUsed, bwLimitBytes);
      meters.push({
        id: "render-bandwidth",
        label: "Bandwidth (Render)",
        source: "Render Metrics",
        percent,
        usedLabel: formatBytes(bwUsed),
        limitLabel: formatBytes(bwLimitBytes),
        status: statusFromPercent(percent),
        detail: `Egress od początku miesiąca (limit planu: ${cfg.bandwidthLimitGb} GB — RENDER_BANDWIDTH_LIMIT_GB).`,
      });
    }

    if (meters.length === 0) {
      const result = {
        meters: [
          {
            id: "render-empty",
            label: "Render (hosting)",
            source: "Render Metrics",
            percent: 0,
            usedLabel: "—",
            limitLabel: "—",
            status: "error" as const,
            detail: "API odpowiedziało, ale brak punktów metryk (serwis może być uśpiony).",
          },
        ],
      };
      cacheSet(CACHE_KEY, result, CACHE_TTL_MS);
      return result;
    }

    const result = { meters };
    cacheSet(CACHE_KEY, result, CACHE_TTL_MS);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd Render API";
    const result = {
      meters: [
        {
          id: "render-error",
          label: "Render (hosting)",
          source: "Render API",
          percent: 0,
          usedLabel: "—",
          limitLabel: "—",
          status: "error" as const,
          detail: msg,
        },
      ],
      error: msg,
    };
    cacheSet(CACHE_KEY, result, Math.min(CACHE_TTL_MS, 10_000));
    return result;
  }
}
