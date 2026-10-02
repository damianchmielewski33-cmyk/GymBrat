/** Uruchamiane raz przy starcie procesu Node — stosuje migracje Drizzle na Turso zanim przyjmowane są zapytania. */

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { initSentryServer } = await import("./lib/sentry-init");
    await initSentryServer();
  } catch (err) {
    console.error("[instrumentation] Sentry:", err);
  }

  if (!process.env.TURSO_DATABASE_URL) return;

  const { withDbRetry } = await import("./db/with-retry");

  try {
    const { runMigrations } = await import("./db/migrate");
    await withDbRetry(() => runMigrations(), {
      attempts: 3,
      label: "runMigrations",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Can't find meta\/_journal\.json/i.test(msg)) {
      console.warn(
        "[instrumentation] Migracje Drizzle pominięte (brak journal w paczce) — schema z ensureCriticalSchema.",
      );
    } else {
      console.error("[instrumentation] Migracje Drizzle nie powiodły się:", err);
    }
  }
  try {
    const { ensureCriticalSchema } = await import("./db/ensure-schema");
    await ensureCriticalSchema();
  } catch (err) {
    console.error("[instrumentation] ensureCriticalSchema:", err);
  }
  try {
    const { migrateSensitiveFieldsAtStartup } = await import(
      "./lib/migrate-sensitive-encryption"
    );
    await withDbRetry(() => migrateSensitiveFieldsAtStartup(), {
      attempts: 3,
      label: "migrateSensitiveFields",
    });
  } catch (err) {
    console.error("[instrumentation] migrate-sensitive-encryption:", err);
  }
}
