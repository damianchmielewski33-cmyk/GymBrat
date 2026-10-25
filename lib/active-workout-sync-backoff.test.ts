import { describe, expect, it, vi, afterEach } from "vitest";
import {
  SYNC_RETRY_BASE_DELAY_MS,
  SYNC_RETRY_MAX_DELAY_MS,
  computeSyncRetryDelayMs,
  isAuthErrorStatus,
  isLikelyOfflineError,
} from "@/lib/active-workout-sync-backoff";

describe("active-workout-sync-backoff (005, P1/P2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isAuthErrorStatus", () => {
    it("true dla 401 i 403 (sesja nieważna/brak — nie ponawiaj automatycznie, P1)", () => {
      expect(isAuthErrorStatus(401)).toBe(true);
      expect(isAuthErrorStatus(403)).toBe(true);
    });

    it("false dla innych statusów i wartości brakujących", () => {
      expect(isAuthErrorStatus(200)).toBe(false);
      expect(isAuthErrorStatus(409)).toBe(false);
      expect(isAuthErrorStatus(429)).toBe(false);
      expect(isAuthErrorStatus(500)).toBe(false);
      expect(isAuthErrorStatus(null)).toBe(false);
      expect(isAuthErrorStatus(undefined)).toBe(false);
    });
  });

  describe("computeSyncRetryDelayMs", () => {
    it("wykładniczy backoff bez Retry-After: 8s, 16s, 32s, 60s (maks.)", () => {
      expect(computeSyncRetryDelayMs({ attempt: 1 })).toBe(SYNC_RETRY_BASE_DELAY_MS);
      expect(computeSyncRetryDelayMs({ attempt: 2 })).toBe(16_000);
      expect(computeSyncRetryDelayMs({ attempt: 3 })).toBe(32_000);
      expect(computeSyncRetryDelayMs({ attempt: 4 })).toBe(SYNC_RETRY_MAX_DELAY_MS);
      expect(computeSyncRetryDelayMs({ attempt: 5 })).toBe(SYNC_RETRY_MAX_DELAY_MS);
    });

    it("attempt < 1 jest traktowany jak 1 (bez ujemnych/zerowych odstępów)", () => {
      expect(computeSyncRetryDelayMs({ attempt: 0 })).toBe(SYNC_RETRY_BASE_DELAY_MS);
      expect(computeSyncRetryDelayMs({ attempt: -5 })).toBe(SYNC_RETRY_BASE_DELAY_MS);
    });

    it("respektuje Retry-After (429) z serwera, nie mniej niż odstęp bazowy", () => {
      expect(computeSyncRetryDelayMs({ attempt: 1, retryAfterSec: 20 })).toBe(20_000);
      expect(computeSyncRetryDelayMs({ attempt: 1, retryAfterSec: 2 })).toBe(
        SYNC_RETRY_BASE_DELAY_MS,
      );
    });

    it("ignoruje Retry-After niepoprawny (0, ujemny, NaN) i wraca do backoffu", () => {
      expect(computeSyncRetryDelayMs({ attempt: 2, retryAfterSec: 0 })).toBe(16_000);
      expect(computeSyncRetryDelayMs({ attempt: 2, retryAfterSec: -1 })).toBe(16_000);
      expect(computeSyncRetryDelayMs({ attempt: 2, retryAfterSec: Number.NaN })).toBe(16_000);
    });
  });

  describe("isLikelyOfflineError", () => {
    it("true, gdy navigator.onLine === false", () => {
      vi.stubGlobal("navigator", { onLine: false });
      expect(isLikelyOfflineError()).toBe(true);
    });

    it("false, gdy navigator.onLine === true albo navigator niedostępny", () => {
      vi.stubGlobal("navigator", { onLine: true });
      expect(isLikelyOfflineError()).toBe(false);
    });
  });
});
