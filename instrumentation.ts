/** Uruchamiane raz przy starcie procesu Node — stosuje migracje Drizzle na Turso zanim przyjmowane są zapytania. */

import type { Instrumentation } from "next";

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
    } else if (/already exists|duplicate column|SQL_INPUT_ERROR/i.test(msg)) {
      console.warn(
        "[instrumentation] Migracje: schemat już w bazie — kontynuuję (ensureCriticalSchema).",
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
    const { migrateEmailVerification } = await import("./lib/migrate-email-verification");
    await withDbRetry(() => migrateEmailVerification(), {
      attempts: 3,
      label: "migrateEmailVerification",
    });
  } catch (err) {
    console.error(
      "[instrumentation] migrate-email-verification:",
      err instanceof Error ? err.name : "error",
    );
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

/**
 * Każdy nieobsłużony błąd serwera (render Server Components, Server Actions, proxy, trasy poza
 * `withApiErrors`) trafia do logów w jednolitym formacie. `digest` to ten sam kod referencyjny,
 * który użytkownik widzi w komunikacie błędu (error boundary / popup).
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  try {
    const { isNextControlFlowError, toAppError } = await import("./lib/errors/app-error");
    if (isNextControlFlowError(err)) return;
    const { logServerError, newRequestId, safePath } = await import("./lib/errors/server-log");
    const digest = (err as { digest?: string }).digest;
    logServerError(
      toAppError(err),
      {
        requestId: digest || newRequestId(),
        method: request.method,
        path: safePath(request.path),
        routeType: context.routeType,
        digest,
        origin: "onRequestError",
      },
      err,
    );
  } catch (loggingError) {
    console.error("[instrumentation] onRequestError:", loggingError);
  }
};
