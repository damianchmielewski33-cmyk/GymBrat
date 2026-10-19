/** Wspólny model paska zużycia w panelu admina. */

export type MeterStatus = "ok" | "warn" | "critical" | "unconfigured" | "error";

export type UsageMeter = {
  id: string;
  label: string;
  /** Źródło: Render Metrics / Turso Platform / lokalny PRAGMA. */
  source: string;
  /** 0–100+ (powyżej 100 = przekroczenie limitu). */
  percent: number;
  usedLabel: string;
  limitLabel: string;
  status: MeterStatus;
  detail?: string;
};

export type MonitoringSnapshot = {
  updatedAt: string;
  meters: UsageMeter[];
  /** Braki konfiguracji (bez sekretów). */
  hints: string[];
};
