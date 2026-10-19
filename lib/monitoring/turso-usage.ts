/**
 * Oficjalne limity Turso (Platform API): usage + subscription + plan quotas.
 * Docs: https://docs.turso.tech/api-reference/organizations/usage
 */

import {
  clampPercent,
  formatBytes,
  formatCount,
  statusFromPercent,
} from "@/lib/monitoring/format";
import type { UsageMeter } from "@/lib/monitoring/types";
import { cacheGet, cacheSet } from "@/lib/community/perf-cache";
import { getDbStorageUsage } from "@/lib/db-storage-budget";

const CACHE_KEY = "monitoring:turso";
const CACHE_TTL_MS = 30_000;
const API_BASE = "https://api.turso.tech/v1";

type TursoConfig = {
  token: string;
  orgSlug: string;
};

type PlanQuotas = {
  rowsRead?: number;
  rowsWritten?: number;
  storage?: number;
  bytesSynced?: number;
};

export function getTursoConfig(): TursoConfig | null {
  const token = process.env.TURSO_API_TOKEN?.trim();
  const orgSlug = process.env.TURSO_ORG_SLUG?.trim();
  if (!token || !orgSlug) return null;
  return { token, orgSlug };
}

async function tursoGet<T>(
  path: string,
  token: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Turso ${path} HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

async function resolveQuotas(
  cfg: TursoConfig,
): Promise<{ planName: string; quotas: PlanQuotas }> {
  const [sub, plans] = await Promise.all([
    tursoGet<{
      subscription?: { name?: string; plan?: string };
    }>(`/organizations/${encodeURIComponent(cfg.orgSlug)}/subscription`, cfg.token),
    tursoGet<{
      plans?: { name?: string; quotas?: PlanQuotas }[];
    }>(`/organizations/${encodeURIComponent(cfg.orgSlug)}/plans`, cfg.token),
  ]);

  const planName =
    sub.subscription?.plan ||
    sub.subscription?.name ||
    "starter";
  const match =
    plans.plans?.find(
      (p) =>
        p.name?.toLowerCase() === planName.toLowerCase() ||
        p.name?.toLowerCase() === sub.subscription?.name?.toLowerCase(),
    ) ?? plans.plans?.find((p) => p.name?.toLowerCase() === "starter");

  return {
    planName,
    quotas: match?.quotas ?? {
      rowsRead: 1_000_000_000,
      rowsWritten: 25_000_000,
      storage: 9_000_000_000,
    },
  };
}

/** Lokalny soft limit (PRAGMA) — zawsze dostępny bez Platform API. */
export async function collectLocalDbMeter(): Promise<UsageMeter> {
  try {
    const usage = await getDbStorageUsage();
    const percent = clampPercent(usage.usedMb, usage.softMb);
    return {
      id: "db-storage-soft",
      label: "Baza Turso (soft limit)",
      source: "PRAGMA page_count",
      percent,
      usedLabel: `${usage.usedMb} MB`,
      limitLabel: `${usage.softMb} MB`,
      status: usage.overHard
        ? "critical"
        : usage.overSoft
          ? "critical"
          : statusFromPercent(percent),
      detail: usage.overSoft
        ? "Soft limit przekroczony — nowe zdjęcia są blokowane."
        : `Hard limit: ${usage.hardMb} MB (emergency purge w cronie).`,
    };
  } catch (e) {
    return {
      id: "db-storage-soft",
      label: "Baza Turso (soft limit)",
      source: "PRAGMA page_count",
      percent: 0,
      usedLabel: "—",
      limitLabel: "—",
      status: "error",
      detail: e instanceof Error ? e.message : "Błąd pomiaru storage",
    };
  }
}

export async function collectTursoMeters(
  opts?: { force?: boolean },
): Promise<{ meters: UsageMeter[]; error?: string }> {
  const local = await collectLocalDbMeter();
  const cfg = getTursoConfig();

  if (!cfg) {
    return {
      meters: [
        local,
        {
          id: "turso-platform-unconfigured",
          label: "Turso (plan API)",
          source: "Turso Platform",
          percent: 0,
          usedLabel: "—",
          limitLabel: "—",
          status: "unconfigured",
          detail:
            "Ustaw TURSO_API_TOKEN i TURSO_ORG_SLUG, żeby zobaczyć rows read/written i storage planu.",
        },
      ],
    };
  }

  if (!opts?.force) {
    const cached = cacheGet<{ meters: UsageMeter[]; error?: string }>(CACHE_KEY);
    if (cached) {
      return {
        meters: [local, ...cached.meters.filter((m) => m.id !== local.id)],
        error: cached.error,
      };
    }
  }

  try {
    const [usageRes, plan] = await Promise.all([
      tursoGet<{
        organization?: {
          usage?: {
            rows_read?: number;
            rows_written?: number;
            storage_bytes?: number;
            bytes_synced?: number;
          };
        };
      }>(`/organizations/${encodeURIComponent(cfg.orgSlug)}/usage`, cfg.token),
      resolveQuotas(cfg),
    ]);

    const u = usageRes.organization?.usage ?? {};
    const q = plan.quotas;
    const meters: UsageMeter[] = [];

    if (typeof u.storage_bytes === "number" && q.storage && q.storage > 0) {
      const percent = clampPercent(u.storage_bytes, q.storage);
      meters.push({
        id: "turso-storage-plan",
        label: `Storage planu (${plan.planName})`,
        source: "Turso Platform",
        percent,
        usedLabel: formatBytes(u.storage_bytes),
        limitLabel: formatBytes(q.storage),
        status: statusFromPercent(percent),
        detail: "Oficjalny limit storage organizacji w bieżącym cyklu.",
      });
    }

    if (typeof u.rows_read === "number" && q.rowsRead && q.rowsRead > 0) {
      const percent = clampPercent(u.rows_read, q.rowsRead);
      meters.push({
        id: "turso-rows-read",
        label: "Rows read (Turso)",
        source: "Turso Platform",
        percent,
        usedLabel: formatCount(u.rows_read),
        limitLabel: formatCount(q.rowsRead),
        status: statusFromPercent(percent),
        detail: "Odczyty wierszy w bieżącym cyklu rozliczeniowym.",
      });
    }

    if (
      typeof u.rows_written === "number" &&
      q.rowsWritten &&
      q.rowsWritten > 0
    ) {
      const percent = clampPercent(u.rows_written, q.rowsWritten);
      meters.push({
        id: "turso-rows-written",
        label: "Rows written (Turso)",
        source: "Turso Platform",
        percent,
        usedLabel: formatCount(u.rows_written),
        limitLabel: formatCount(q.rowsWritten),
        status: statusFromPercent(percent),
        detail: "Zapisy wierszy w bieżącym cyklu rozliczeniowym.",
      });
    }

    const result = { meters };
    cacheSet(CACHE_KEY, result, CACHE_TTL_MS);
    return { meters: [local, ...meters] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd Turso API";
    const result = {
      meters: [
        {
          id: "turso-error",
          label: "Turso (plan API)",
          source: "Turso Platform",
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
    return { meters: [local, ...result.meters], error: msg };
  }
}
