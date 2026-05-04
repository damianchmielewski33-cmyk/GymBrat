/** Wspólna weryfikacja Custom Search (bez `server-only`) — serwer i akcje. */
export function isWebSearchConfigured(): boolean {
  const k =
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim() ||
    process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx =
    process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim() ||
    process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
  return Boolean(k && cx);
}
