/**
 * Z53 — zdarzenia KPI / lejka (PostHog). Definicje biznesowe: docs/analityka/kpi.md.
 * Wysyłane wyłącznie z serwera i tylko dla użytkownika z aktualną zgodą `analytics` (Z12).
 * Properties bez danych osobowych i zdrowotnych (tylko SKU, kwota, rola).
 */
export const KpiEvents = {
  userRegistered: "kpi_user_registered",
  workoutCompleted: "kpi_workout_completed",
  packageViewed: "kpi_package_viewed",
  checkoutStarted: "kpi_checkout_started",
  checkoutCompleted: "kpi_checkout_completed",
} as const;

export type KpiEventName = (typeof KpiEvents)[keyof typeof KpiEvents];

export type KpiEventProps = {
  [KpiEvents.userRegistered]: { role: string };
  [KpiEvents.workoutCompleted]: { kind: "strength" };
  [KpiEvents.packageViewed]: Record<string, never>;
  [KpiEvents.checkoutStarted]: { plan_sku: string; amount_grosze: number };
  [KpiEvents.checkoutCompleted]: { plan_sku: string; amount_grosze: number };
};
