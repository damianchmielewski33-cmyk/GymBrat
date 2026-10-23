/**
 * Logowanie błędów po stronie serwera: jedna czytelna linia na błąd
 * (`[GymBrat][serwer][500][INTERNAL] POST /api/x — … (ref abc123)`), stack dla 5xx
 * oraz zgłoszenie do Sentry (tylko 5xx i tylko gdy skonfigurowano DSN).
 *
 * Nie loguje ciała żądania, nagłówków ani query stringa (mogą zawierać dane osobowe).
 */

import { AppError } from "@/lib/errors/app-error";
import { formatErrorLine } from "@/lib/errors/catalog";

export type ServerLogContext = {
  requestId: string;
  method?: string;
  /** Sama ścieżka — bez query stringa i hasha. */
  path?: string;
  /** np. `route`, `action`, `render`, `proxy`. */
  routeType?: string;
  durationMs?: number;
  digest?: string;
  /** Skąd pochodzi log (np. `withApiErrors`, `onRequestError`, `client-report`). */
  origin?: string;
};

/** Ścieżka bez query/hash — bezpieczna do logów. */
export function safePath(input?: string | null): string | undefined {
  if (!input) return undefined;
  const cut = input.split(/[?#]/, 1)[0];
  return cut || undefined;
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

/** Używa `x-request-id` z proxy/CDN, jeśli wygląda sensownie; inaczej generuje nowy. */
export function requestIdFrom(headers?: Headers | null): string {
  const raw = headers?.get("x-request-id")?.trim();
  if (raw && /^[\w.-]{6,64}$/.test(raw)) return raw;
  return newRequestId();
}

function sentryEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim(),
  );
}

async function captureToSentry(
  original: unknown,
  err: AppError,
  ctx: ServerLogContext,
): Promise<void> {
  if (!sentryEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(original instanceof Error ? original : err, {
      tags: {
        errorCode: err.code,
        httpStatus: String(err.status),
        requestId: ctx.requestId,
      },
      extra: { path: ctx.path, method: ctx.method, routeType: ctx.routeType },
    });
  } catch {
    /* Sentry nie może zepsuć obsługi błędu */
  }
}

/** Loguje błąd (4xx → ostrzeżenie, 5xx → błąd + stack + Sentry). */
export function logServerError(
  err: AppError,
  ctx: ServerLogContext,
  original?: unknown,
): void {
  const line = formatErrorLine({
    side: "serwer",
    code: err.code,
    status: err.status,
    message: err.message,
    method: ctx.method,
    path: ctx.path,
    requestId: ctx.requestId,
    extra: {
      ...(ctx.routeType ? { type: ctx.routeType } : null),
      ...(ctx.digest ? { digest: ctx.digest } : null),
      ...(ctx.durationMs != null ? { ms: Math.round(ctx.durationMs) } : null),
      ...(err.fieldErrors ? { fields: Object.keys(err.fieldErrors) } : null),
    },
  });

  if (err.status < 500) {
    console.warn(line);
    return;
  }

  console.error(line);
  const source = original ?? err.cause;
  if (source instanceof Error && source.stack) {
    console.error(`[GymBrat][serwer][stack] (ref ${ctx.requestId}) ${source.stack}`);
  } else if (source !== undefined && source !== null) {
    try {
      console.error(
        `[GymBrat][serwer][cause] (ref ${ctx.requestId}) ${JSON.stringify(source)?.slice(0, 500)}`,
      );
    } catch {
      /* ignore */
    }
  }
  void captureToSentry(original, err, ctx);
}
