/** Inicjalizacja Sentry po stronie serwera — wywoływana z `instrumentation.ts`. */
export async function initSentryServer(): Promise<void> {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment: process.env.NODE_ENV,
  });
}
