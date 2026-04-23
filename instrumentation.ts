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

  try {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  } catch (err) {
    console.error("[instrumentation] Migracje Drizzle nie powiodły się:", err);
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
    await migrateSensitiveFieldsAtStartup();
  } catch (err) {
    console.error("[instrumentation] migrate-sensitive-encryption:", err);
  }
}
