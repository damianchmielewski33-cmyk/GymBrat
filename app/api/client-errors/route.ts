import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { errorResponse, withApiErrors } from "@/lib/errors/api";
import {
  catalogEntry,
  formatErrorLine,
  isErrorCode,
  type ErrorCode,
} from "@/lib/errors/catalog";
import { requestIdFrom } from "@/lib/errors/server-log";
import { assertAnalyticsOrigin } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_096;

/** Usuwa znaki sterujące (zapobiega „wstrzykiwaniu” fałszywych linii do logów). */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 300);
}

const bodySchema = z.object({
  code: z.string().max(40),
  source: z.enum([
    "fetch",
    "window-error",
    "unhandled-rejection",
    "react-boundary",
    "resource",
    "manual",
  ]),
  message: z.string().max(300),
  detail: z.string().max(300).optional(),
  digest: z.string().max(64).optional(),
  page: z.string().max(200).optional(),
  click: z.string().max(100).optional(),
});

/**
 * Odbiera błędy zgłoszone przez przeglądarkę (window.onerror, unhandledrejection,
 * error boundary), żeby były widoczne także w logach serwera. Publiczny (błędy mogą
 * wystąpić na /login), ale z limitem żądań, sprawdzeniem Origin i twardym limitem rozmiaru.
 */
async function handlePOST(req: Request) {
  const requestId = requestIdFrom(req.headers);

  const blocked = assertAnalyticsOrigin(req);
  if (blocked) return blocked;

  const rl = await checkRateLimitAsync(
    rateLimitKey("client-errors", req),
    RATE.clientErrors.limit,
    RATE.clientErrors.windowMs,
  );
  if (!rl.ok) {
    return errorResponse(new AppError("RATE_LIMITED", { retryAfterSec: rl.retryAfterSec }), {
      requestId,
    });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return errorResponse(new AppError("PAYLOAD_TOO_LARGE"), { requestId });
  }

  const parsed = bodySchema.parse(JSON.parse(text));
  const code: ErrorCode = isErrorCode(parsed.code) ? parsed.code : "CLIENT_RUNTIME";
  const entry = catalogEntry(code);

  console.error(
    formatErrorLine({
      side: "przeglądarka",
      code,
      status: entry.status,
      message: `${entry.log}${parsed.detail ? ` (${clean(parsed.detail)})` : ""} → komunikat dla użytkownika: „${clean(parsed.message)}”`,
      requestId: clean(parsed.digest) ?? requestId,
      extra: {
        src: parsed.source,
        strona: clean(parsed.page),
        klik: clean(parsed.click),
        zgloszenie: "client-errors",
      },
    }),
  );

  return new Response(null, { status: 204 });
}

export const POST = withApiErrors(handlePOST);
