/** Uruchamiane raz przy starcie procesu Node — stosuje migracje Drizzle na Turso zanim przyjmowane są zapytania. */

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (!process.env.TURSO_DATABASE_URL) return;

  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
}
