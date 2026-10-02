/** Czy błąd Turso/libsql wygląda na chwilowy (sieć / hang up). */
export function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const errno =
    typeof err === "object" && err !== null && "errno" in err
      ? String((err as { errno?: unknown }).errno ?? "")
      : "";
  const msg = err instanceof Error ? err.message : String(err);
  const blob = `${code} ${errno} ${msg}`;
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|socket hang up|UND_ERR|fetch failed|network|temporarily unavailable|timeout/i.test(
    blob,
  );
}

/**
 * Ponawia operację DB przy typowych błędach sieciowych Turso (cold start / hang up).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  const baseDelayMs = opts?.baseDelayMs ?? 250;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable = isTransientDbError(e) && i < attempts - 1;
      if (!retryable) throw e;
      const delay = baseDelayMs * 2 ** i;
      if (opts?.label) {
        console.warn(
          `[db-retry] ${opts.label}: próba ${i + 1}/${attempts} nieudana (${String(
            e instanceof Error ? e.message : e,
          ).slice(0, 120)}) — ponawiam za ${delay}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}
