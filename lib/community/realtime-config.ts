/**
 * Realtime Community — tryb przyjazny hostingowi (Vercel Hobby / Render Free).
 *
 * Domyślnie `poll`: krótkie żądania HTTP zamiast długotrwałych SSE
 * (SSE trzymają funkcję otwartą i zjadają Fluid Active CPU / RAM).
 * `sse` tylko gdy świadomie włączysz NEXT_PUBLIC_COMMUNITY_REALTIME=sse (np. Pro).
 */

export type CommunityRealtimeMode = "poll" | "sse";

export function getCommunityRealtimeMode(): CommunityRealtimeMode {
  const raw = (
    process.env.NEXT_PUBLIC_COMMUNITY_REALTIME ??
    process.env.COMMUNITY_REALTIME ??
    "poll"
  )
    .trim()
    .toLowerCase();
  return raw === "sse" ? "sse" : "poll";
}

/** Interwały klienta (poll) — widoczna karta; przy ukrytej zakładce pauza. */
export const CLIENT_POLL = {
  notificationsMs: 20_000,
  feedMs: 15_000,
  chatMs: 8_000,
  /** Trening grupowy push+pull */
  groupPresenceMs: 5_000,
  /** Podgląd wybranego znajomego (aktywnie oglądasz) */
  friendLiveWatchMs: 8_000,
  /**
   * Lista „kto trenuje” (chip na dole) — wcześniej co 1 s przy każdej otwartej apce.
   * Rzadki poll wystarczy do zauważenia live.
   */
  friendLiveListMs: 30_000,
} as const;

/** Limit życia jednego połączenia SSE (gdy mode=sse) — wymusza krótkie invocacje. */
export const SSE_MAX_CONNECTION_MS = 25_000;
