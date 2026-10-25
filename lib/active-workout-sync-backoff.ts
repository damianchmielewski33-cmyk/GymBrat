/**
 * Logika ponawiania `push()`/`deleteCloud()` w `ActiveWorkoutCloudSync`, wydzielona
 * jako czyste funkcje (bez DOM/timerów), żeby dało się ją testować bez komponentu
 * (005, poprawka po odrzuceniu etapu 9 — P1/P2 z `docs/wydajnosc/005-koniec-treningu-przeplyw.md`).
 *
 * P1: 401/403 oznacza nieważną/brak sesji — NIE planujemy automatycznego ponowienia
 * (inaczej gość albo użytkownik z wygasłą sesją generuje nieskończoną pętlę żądań).
 * P2: 429/5xx/sieć ponawiamy z wykładniczym backoffem, respektując `Retry-After`
 * z 429, zamiast dobijać natychmiast w `finally`.
 */

/** Statusy HTTP, po których NIE wolno automatycznie ponawiać (sesja nieważna/brak). */
const AUTH_ERROR_STATUSES = new Set([401, 403]);

export function isAuthErrorStatus(status: number | null | undefined): boolean {
  return status != null && AUTH_ERROR_STATUSES.has(status);
}

/** Bazowy odstęp ponowienia — zgodny z dotychczasowym interwałem synchronizacji. */
export const SYNC_RETRY_BASE_DELAY_MS = 8_000;
/** Górny limit backoffu — nie czekaj dłużej niż minutę między próbami. */
export const SYNC_RETRY_MAX_DELAY_MS = 60_000;

/**
 * Czas do następnej próby po błędzie push/delete (P2).
 * - Gdy serwer podał `Retry-After` (sekundy, zwykle przy 429), respektuje tę wartość
 *   (nie mniej niż bazowy odstęp, żeby nie przyspieszyć ponowienia poniżej normalnego rytmu).
 * - W przeciwnym razie wykładniczy backoff: 8 s, 16 s, 32 s, 60 s (maks.), zresetowany
 *   do `attempt = 1` po pierwszym sukcesie od strony wywołującej.
 */
export function computeSyncRetryDelayMs(params: {
  /** Liczba kolejnych błędów od ostatniego sukcesu (1 = pierwszy błąd). */
  attempt: number;
  retryAfterSec?: number | null;
}): number {
  const attempt = Math.max(1, Math.floor(params.attempt));
  const { retryAfterSec } = params;
  if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
    return Math.max(SYNC_RETRY_BASE_DELAY_MS, Math.round(retryAfterSec * 1000));
  }
  const exponential = SYNC_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(SYNC_RETRY_MAX_DELAY_MS, exponential);
}

/**
 * Czy błąd oznacza brak sieci po stronie klienta (a nie odpowiedź serwera) — w tym
 * przypadku czekamy na zdarzenie `online` zamiast odpytywać w pętli (P2).
 */
export function isLikelyOfflineError(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
