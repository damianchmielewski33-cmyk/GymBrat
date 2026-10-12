/**
 * Tag zapisu analityki (odsłony, log aktywności) — produkcja / preview / dev.
 * Na Vercelu ustawiane jest VERCEL_ENV; nadpisz ANALYTICS_DEPLOYMENT_ENV tylko w razie potrzeby.
 * Panel admina nie filtruje po tym polu — pokazuje wszystkie zdarzenia w zakresie dat.
 */
export function getAnalyticsDeployment(): string {
  const override = process.env.ANALYTICS_DEPLOYMENT_ENV?.trim();
  if (override) return override;
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview" || v === "development") return v;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
