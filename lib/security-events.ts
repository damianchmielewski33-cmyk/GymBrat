import "server-only";

import { getDb, type Database } from "@/db";
import { adminAuditLog } from "@/db/schema";
import { adminAuditValues } from "@/lib/admin-audit";
import { AppError } from "@/lib/errors/app-error";
import { logServerError, newRequestId } from "@/lib/errors/server-log";

/**
 * Dziennik zdarzeń bezpieczeństwa (ADR 0001 D7, LR-26): wpisy w `admin_audit_log`
 * z akcją `security.<typ>`. Retencja min. 180 dni (`lib/db-retention.ts`).
 * `meta` zawiera wyłącznie `reason` i `provider` — bez e-maila, kodu, hasła i danych o zdrowiu.
 */
export type SecurityEventType =
  | "register"
  | "oauth_register"
  | "oauth_link"
  | "oauth_link_rejected"
  | "account_takeover"
  | "admin_role_granted"
  | "admin_role_denied"
  | "backfill_verified";

export type SecurityEventInput = {
  type: SecurityEventType;
  /** Konto, którego dotyczy zdarzenie (actor = target). */
  userId: string;
  /** Kod powodu, np. `OAuthEmailUnverified`, `email_code`, `test_mode`, `email_unverified`. */
  reason?: string;
  provider?: "google" | "facebook";
};

/** Jedyne dozwolone klucze `meta` — inne pola wejścia nigdy nie trafiają do zapisu. */
export function securityEventMeta(input: SecurityEventInput): Record<string, string> {
  const meta: Record<string, string> = {};
  if (input.reason) meta.reason = input.reason;
  if (input.provider) meta.provider = input.provider;
  return meta;
}

function securityEventRow(input: SecurityEventInput) {
  return adminAuditValues({
    actorUserId: input.userId,
    action: `security.${input.type}`,
    targetUserId: input.userId,
    meta: securityEventMeta(input),
  });
}

/** Instrukcja do `db.batch` (rejestracja, przejęcie) — zdarzenie zapisuje się razem ze zmianą. */
export function securityEventInsert(db: Database, input: SecurityEventInput) {
  return db.insert(adminAuditLog).values(securityEventRow(input));
}

/**
 * Błąd w ścieżce uwierzytelniania bez oryginalnego wyjątku: komunikaty Drizzle zawierają
 * parametry zapytań (e-mail), więc do logów i Sentry trafia tylko miejsce i typ błędu.
 */
export function logAuthFailure(where: string, err: unknown): void {
  const kind = err instanceof Error ? err.name : typeof err;
  logServerError(new AppError("INTERNAL", { message: `${where}: ${kind}` }), {
    requestId: newRequestId(),
    origin: where,
  });
}

/** Zapis pojedynczego zdarzenia; błąd zapisu nie blokuje logowania. */
export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await securityEventInsert(getDb(), input);
  } catch (err) {
    logAuthFailure("security-events", err);
  }
}
