/**
 * Lekki in-process TTL cache pod Community (Turso + Vercel).
 * Nie zastępuje Redis przy multi-instance — ogranicza hot-path QPS w jednym procesie
 * (presence <1s, unread count, SSE idle).
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const MAX_KEYS = 5_000;

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (store.size >= MAX_KEYS) {
    // Usuń najstarsze ~10%
    let i = 0;
    const drop = Math.ceil(MAX_KEYS * 0.1);
    for (const k of store.keys()) {
      store.delete(k);
      if (++i >= drop) break;
    }
  }
  store.set(key, { value, expiresAt: Date.now() + Math.max(50, ttlMs) });
}

export function cacheInvalidate(prefixOrKey: string): void {
  if (store.has(prefixOrKey)) {
    store.delete(prefixOrKey);
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefixOrKey)) store.delete(k);
  }
}

/** Interwały SSE Community — adaptive (idle vs aktywność). */
export const SSE_POLL = {
  /** Feed / notyfikacje przy braku eventów */
  idleMs: 5_000,
  /** Po evencie — szybszy tick przez chwilę */
  activeMs: 1_500,
  /** Chat: nieco szybciej (typing) */
  chatIdleMs: 3_500,
  chatActiveMs: 1_200,
  /** Presence list cache (GET) */
  presenceTtlMs: 450,
  /** Unread badge cache */
  unreadTtlMs: 2_000,
  /** SSE event-head (feed/chat) — współdzielone ticki w jednym procesie */
  eventsHeadTtlMs: 400,
} as const;
