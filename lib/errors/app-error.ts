/**
 * `AppError` — błąd z kodem z katalogu. Rzucaj go z logiki serwerowej, gdy chcesz
 * świadomie wskazać status HTTP i komunikat; wszystko inne (`Error`, ZodError,
 * błędy bazy) zamienia `toAppError()` na odpowiedni kod.
 */

import {
  catalogEntry,
  codeForStatus,
  isErrorCode,
  type ErrorCode,
} from "@/lib/errors/catalog";

export type AppErrorOptions = {
  /** Komunikat techniczny do logów (domyślnie opis z katalogu). */
  message?: string;
  /** Komunikat dla użytkownika (domyślnie z katalogu). */
  userMessage?: string;
  cause?: unknown;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  retryAfterSec?: number;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;
  readonly retryAfterSec?: number;
  /**
   * Digest rozpoznawany przez Next.js i przekazywany do przeglądarki także w produkcji
   * (treść błędu jest tam zamaskowana). Format `GB-<KOD>-<ref>` pozwala klientowi odtworzyć
   * kod błędu z katalogu — np. 429 z akcji serwerowej — zamiast pokazywać ogólne „błąd serwera”.
   */
  readonly digest: string;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const entry = catalogEntry(code);
    super(options.message ?? entry.log, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = entry.status > 0 ? entry.status : 500;
    this.userMessage = options.userMessage ?? entry.message;
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
    this.retryAfterSec = options.retryAfterSec;
    this.digest = `GB-${code}-${shortRef()}`;
  }
}

function shortRef(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

const GB_DIGEST = /^GB-([A-Z_]+)-([A-Za-z0-9]+)$/;

/** Odczytuje kod błędu z digestu `AppError` (patrz `AppError.digest`). */
export function parseAppErrorDigest(
  digest: unknown,
): { code: ErrorCode; ref: string } | null {
  if (typeof digest !== "string") return null;
  const m = GB_DIGEST.exec(digest);
  if (!m || !isErrorCode(m[1])) return null;
  return { code: m[1], ref: m[2]! };
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

type ZodLikeIssue = { path?: unknown[]; message?: string };

function isZodLike(err: unknown): err is { issues: ZodLikeIssue[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

function fieldErrorsFromIssues(issues: ZodLikeIssue[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = (issue.path ?? []).map(String).join(".") || "_";
    (out[key] ??= []).push(issue.message ?? "Nieprawidłowa wartość");
  }
  return out;
}

const UNAVAILABLE_HINT =
  /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE|socket hang up|fetch failed|SQLITE_BUSY|SQLITE_LOCKED|SERVER_ERROR|STREAM_EXPIRED|libsql|Turso|database is locked/i;

/** Zamienia dowolną wartość z `catch` na `AppError` z właściwym kodem i statusem. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (isZodLike(err)) {
    return new AppError("VALIDATION_FAILED", {
      cause: err,
      fieldErrors: fieldErrorsFromIssues(err.issues),
    });
  }

  if (err instanceof Error) {
    if (err instanceof SyntaxError && /JSON/i.test(err.message)) {
      return new AppError("INVALID_JSON", { cause: err, message: err.message });
    }
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return new AppError("GATEWAY_TIMEOUT", { cause: err, message: err.message });
    }
    if (UNAVAILABLE_HINT.test(`${err.name} ${err.message}`)) {
      return new AppError("SERVICE_UNAVAILABLE", { cause: err, message: err.message });
    }
    const status = Number(
      (err as { status?: unknown; statusCode?: unknown }).status ??
        (err as { statusCode?: unknown }).statusCode,
    );
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return new AppError(codeForStatus(status), { cause: err, message: err.message });
    }
    return new AppError("INTERNAL", { cause: err, message: err.message });
  }

  return new AppError("INTERNAL", {
    cause: err,
    message: typeof err === "string" ? err : "Nieznana wartość rzucona jako błąd",
  });
}

/** Sterowanie przepływem Next.js (redirect, notFound, dynamic API) — nie jest błędem. */
export function isNextControlFlowError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === "string") {
    if (
      digest.startsWith("NEXT_") ||
      digest === "DYNAMIC_SERVER_USAGE" ||
      digest === "BAILOUT_TO_CLIENT_SIDE_RENDERING" ||
      digest === "HANGING_PROMISE_REJECTION"
    ) {
      return true;
    }
  }
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.includes("Dynamic server usage");
}
