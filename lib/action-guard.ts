/**
 * Limity żądań dla akcji serwerowych (`actions/*.ts`).
 *
 * Każda akcja woła `guardAction("plik.nazwa")` na początku. Sprawdzane są dwa ogólne budżety
 * (adres IP oraz sesja — identyfikowana skrótem ciasteczka, bez odpytywania bazy), a dla akcji
 * wrażliwych (AI, hasło, wysyłka e-mail, wyszukiwanie użytkowników) dodatkowy, ostrzejszy limit.
 *
 * Po przekroczeniu rzucany jest `AppError("RATE_LIMITED")` — kod trafia do przeglądarki w digeście
 * (por. `AppError.digest`), więc użytkownik widzi komunikat o limicie zamiast „błędu serwera”.
 */

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { AppError } from "@/lib/errors/app-error";
import { checkRateLimitAsync, clientIpFromHeaders, RATE } from "@/lib/rate-limit";

export type ActionLimit = { limit: number; windowMs: number };

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

async function readRequestIdentity(): Promise<{ ip: string; session: string | null } | null> {
  try {
    const h = await headers();
    const ip = clientIpFromHeaders(h);
    const jar = await cookies();
    const parts = jar
      .getAll()
      .filter((c) => SESSION_COOKIE.test(c.name))
      .map((c) => c.value)
      .join("|");
    const session = parts
      ? createHash("sha256").update(parts).digest("hex").slice(0, 24)
      : null;
    return { ip, session };
  } catch {
    // Poza kontekstem żądania (np. test jednostkowy) — nie ma czego limitować.
    return null;
  }
}

/** Adres IP bieżącego żądania (`"unknown"` poza kontekstem żądania). */
export async function currentClientIp(): Promise<string> {
  try {
    return clientIpFromHeaders(await headers());
  } catch {
    return "unknown";
  }
}

async function enforce(key: string, limit: ActionLimit, name: string): Promise<void> {
  const rl = await checkRateLimitAsync(key, limit.limit, limit.windowMs);
  if (!rl.ok) {
    throw new AppError("RATE_LIMITED", {
      message: `Przekroczony limit akcji serwerowej ${name}`,
      retryAfterSec: rl.retryAfterSec,
    });
  }
}

/** Wołaj jako pierwszą instrukcję akcji serwerowej. */
export async function guardAction(name: string, strict?: ActionLimit): Promise<void> {
  const id = await readRequestIdentity();
  if (!id) return;

  await enforce(`action-ip:${id.ip}`, RATE.actionIp, name);
  if (id.session) await enforce(`action-session:${id.session}`, RATE.actionSession, name);
  if (strict) await enforce(`action:${name}:${id.session ?? id.ip}`, strict, name);
}
