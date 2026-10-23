import type { Client, InStatement } from "@libsql/client";
import { isTransientDbError } from "./with-retry";

/**
 * Turso przez HTTPS zrywa nieużywane połączenia keep-alive ("socket hang up" / ECONNRESET),
 * szczególnie na Render po chwili bezruchu. Zamiast ręcznie opakowywać każde zapytanie,
 * ponawiamy je na poziomie klienta libSQL.
 *
 * - Odczyty (SELECT / PRAGMA / EXPLAIN) ponawiamy przy każdym błędzie przejściowym.
 * - Zapisy ponawiamy tylko wtedy, gdy żądanie na pewno nie dotarło do serwera
 *   (nie udało się nawiązać połączenia), żeby nie zdublować INSERT/UPDATE.
 */

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 150;

const READ_ONLY_RE = /^\s*(?:--[^\n]*\n\s*)*(select|pragma|explain)\b/i;
const WRITE_KEYWORD_RE = /\b(insert|update|delete|replace|create|drop|alter|vacuum|attach|detach)\b/i;
const NEVER_SENT_RE = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH/i;

function statementSql(stmt: InStatement): string {
  return typeof stmt === "string" ? stmt : stmt.sql;
}

export function isReadOnlyStatement(stmt: InStatement): boolean {
  const sql = statementSql(stmt);
  if (READ_ONLY_RE.test(sql)) return true;
  // CTE: "WITH ... SELECT" bez słów kluczowych zapisu.
  return /^\s*with\b/i.test(sql) && !WRITE_KEYWORD_RE.test(sql);
}

function errorBlob(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object") {
      const o = cur as { code?: unknown; errno?: unknown; message?: unknown; cause?: unknown };
      parts.push(String(o.code ?? ""), String(o.errno ?? ""), String(o.message ?? ""));
      cur = o.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" ");
}

function canRetry(err: unknown, readOnly: boolean): boolean {
  if (!isTransientDbError(err)) return false;
  return readOnly || NEVER_SENT_RE.test(errorBlob(err));
}

async function withClientRetry<T>(fn: () => Promise<T>, readOnly: boolean): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt === MAX_ATTEMPTS - 1 || !canRetry(e, readOnly)) throw e;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[db-retry] zapytanie Turso: próba ${attempt + 1}/${MAX_ATTEMPTS} nieudana (${errorBlob(e)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140)}) — ponawiam za ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

/** Zwraca klienta z automatycznym ponawianiem przejściowych błędów sieciowych. */
export function withResilientRetry(client: Client): Client {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "execute") {
        return (stmt: InStatement, ...rest: unknown[]) =>
          withClientRetry(
            () =>
              (target.execute as (s: InStatement, ...r: unknown[]) => ReturnType<Client["execute"]>)(
                stmt,
                ...rest,
              ),
            isReadOnlyStatement(stmt),
          );
      }
      if (prop === "batch") {
        return (stmts: InStatement[], ...rest: unknown[]) =>
          withClientRetry(
            () =>
              (target.batch as (s: InStatement[], ...r: unknown[]) => ReturnType<Client["batch"]>)(
                stmts,
                ...rest,
              ),
            stmts.every(isReadOnlyStatement),
          );
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
