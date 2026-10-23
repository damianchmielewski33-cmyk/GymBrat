/**
 * Obsługa błędów w route handlerach (`app/api/**\/route.ts`).
 *
 * `withApiErrors(handler)` robi trzy rzeczy:
 * 1. łapie każdy nieobsłużony wyjątek → mapuje na `AppError` → odpowiedź JSON ze statusem
 *    (np. 400/404/500/503) i bezpiecznym komunikatem PL (bez stack trace'ów);
 * 2. loguje każdą odpowiedź 4xx/5xx w jednolitym formacie z kodem referencyjnym (`requestId`);
 * 3. ujednolica ciała błędów zwracane przez same trasy (`{ error }` → `{ ok:false, error, code, status, requestId }`),
 *    nie psując istniejących klientów — pole `error` nadal jest tekstem dla użytkownika.
 */

import {
  AppError,
  isNextControlFlowError,
  toAppError,
} from "@/lib/errors/app-error";
import {
  catalogEntry,
  codeFromResponse,
  isErrorCode,
  isSafeServerMessage,
  resolveUserMessage,
  type ErrorCode,
} from "@/lib/errors/catalog";
import {
  logServerError,
  requestIdFrom,
  safePath,
  type ServerLogContext,
} from "@/lib/errors/server-log";

export const REQUEST_ID_HEADER = "x-request-id";

export type ApiErrorBody = {
  ok: false;
  error: string;
  code: ErrorCode;
  status: number;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
};

/** Gotowa odpowiedź błędu — do użycia wprost w trasach (`return errorResponse("NOT_FOUND")`). */
export function errorResponse(
  input: AppError | ErrorCode,
  options: { requestId?: string; req?: Request } = {},
): Response {
  const err = typeof input === "string" ? new AppError(input) : input;
  const requestId = options.requestId ?? requestIdFrom(options.req?.headers);
  const body: ApiErrorBody = {
    ok: false,
    error: err.userMessage,
    code: err.code,
    status: err.status,
    requestId,
    ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : null),
  };
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
    [REQUEST_ID_HEADER]: requestId,
  });
  if (err.retryAfterSec) headers.set("retry-after", String(err.retryAfterSec));
  return new Response(JSON.stringify(body), { status: err.status, headers });
}

type RouteHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Response | Promise<Response>;

function contextFor(req: Request | undefined, started: number): ServerLogContext {
  let path: string | undefined;
  if (req) {
    try {
      path = safePath(new URL(req.url).pathname);
    } catch {
      path = undefined;
    }
  }
  return {
    requestId: requestIdFrom(req?.headers),
    method: req?.method,
    path,
    routeType: "route",
    durationMs: Date.now() - started,
  };
}

const ENGLISH_ERROR_KEYS = ["error", "message"] as const;

/**
 * Dla odpowiedzi 4xx/5xx zwróconych przez samą trasę: loguje i — gdy to JSON — dopisuje
 * `code`, `status`, `requestId` oraz zamienia techniczne / angielskie `error` na komunikat z katalogu.
 */
async function finalizeErrorResponse(
  res: Response,
  ctx: ServerLogContext,
): Promise<Response> {
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  let body: Record<string, unknown> | null = null;

  if (contentType.includes("json")) {
    try {
      const parsed: unknown = JSON.parse(await res.clone().text());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }
  }

  const rawError = ENGLISH_ERROR_KEYS.map((k) => body?.[k]).find(
    (v) => typeof v === "string",
  ) as string | undefined;
  const code = codeFromResponse(res.status, rawError, body?.code);
  const requestId =
    typeof body?.requestId === "string" && body.requestId ? body.requestId : ctx.requestId;

  logServerError(
    new AppError(code, {
      message: rawError ? `${catalogEntry(code).log}: ${rawError}` : undefined,
    }),
    { ...ctx, requestId },
  );

  if (!body) return res;
  if (isErrorCode(body.code) && typeof body.requestId === "string") return res;

  const userMessage =
    typeof body.error === "string" && isSafeServerMessage(body.error)
      ? body.error
      : resolveUserMessage(code, rawError);

  const next: Record<string, unknown> = {
    ...body,
    error: userMessage,
    code,
    status: res.status,
    requestId,
  };
  if (typeof body.error !== "string" && body.error !== undefined) {
    next.details = body.error;
  }

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(JSON.stringify(next), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Opakowuje handler trasy — patrz opis modułu. Zachowuje sygnaturę (typy parametrów). */
export function withApiErrors<H extends RouteHandler>(
  handler: H,
): (...args: Parameters<H>) => Promise<Response> {
  return async (...args: Parameters<H>): Promise<Response> => {
    const started = Date.now();
    const req = args[0] instanceof Request ? (args[0] as Request) : undefined;

    try {
      const res = await handler(...args);
      if (res instanceof Response && res.status >= 400) {
        return await finalizeErrorResponse(res, contextFor(req, started));
      }
      return res;
    } catch (thrown) {
      if (isNextControlFlowError(thrown)) throw thrown;

      const ctx = contextFor(req, started);

      if (req?.signal?.aborted) {
        return new Response(null, { status: 499 });
      }

      const err = toAppError(thrown);
      logServerError(err, ctx, thrown);
      return errorResponse(err, { requestId: ctx.requestId });
    }
  };
}
