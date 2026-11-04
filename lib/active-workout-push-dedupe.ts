/**
 * Z71: wykrywanie zmian przed PUT aktywnej sesji. Cykliczny tick (8 s) wysyłał
 * identyczny payload; teraz pomijamy zapis, gdy odcisk się nie zmienił, z
 * rzadkim „heartbeatem”, żeby wiersz w chmurze nie wyglądał na martwy.
 */
export const PUSH_HEARTBEAT_MS = 60_000;

export function payloadFingerprint(payload: unknown): string {
  return JSON.stringify(payload);
}

export type PushDedupe = {
  /** true → zapis można pominąć (brak zmian i heartbeat jeszcze nie minął). */
  shouldSkip: (fingerprint: string, now?: number) => boolean;
  markPushed: (fingerprint: string, now?: number) => void;
  reset: () => void;
  stats: () => { skipped: number; sent: number };
};

export function createPushDedupe(heartbeatMs = PUSH_HEARTBEAT_MS): PushDedupe {
  let lastFp: string | null = null;
  let lastAt = 0;
  let skipped = 0;
  let sent = 0;
  return {
    shouldSkip(fp, now = Date.now()) {
      const skip = lastFp === fp && now - lastAt < heartbeatMs;
      if (skip) skipped += 1;
      return skip;
    },
    markPushed(fp, now = Date.now()) {
      lastFp = fp;
      lastAt = now;
      sent += 1;
    },
    reset() {
      lastFp = null;
      lastAt = 0;
    },
    stats: () => ({ skipped, sent }),
  };
}
