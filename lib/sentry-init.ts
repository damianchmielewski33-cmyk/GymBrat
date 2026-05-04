function sentryRelease(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return `gymbrat@${sha.slice(0, 7)}`;
  const ver = process.env.npm_package_version?.trim();
  if (ver) return `gymbrat@${ver}`;
  return undefined;
}

/** Inicjalizacja Sentry po stronie serwera — wywoływana z `instrumentation.ts`. */
export async function initSentryServer(): Promise<void> {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  const release = sentryRelease();
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV,
    release,
    sendDefaultPii: false,
  });
}
