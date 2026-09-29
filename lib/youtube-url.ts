/**
 * Walidacja / normalizacja linków YouTube do techniki ćwiczeń.
 */

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function isAllowedYoutubeUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (!YT_HOSTS.has(host)) return false;
    if (host === "youtu.be" || host === "www.youtu.be") {
      return u.pathname.replace(/^\//, "").length > 0;
    }
    if (u.pathname.startsWith("/watch")) return u.searchParams.has("v");
    if (u.pathname.startsWith("/shorts/")) return u.pathname.length > "/shorts/".length;
    if (u.pathname.startsWith("/embed/")) return u.pathname.length > "/embed/".length;
    if (u.pathname.startsWith("/live/")) return u.pathname.length > "/live/".length;
    return false;
  } catch {
    return false;
  }
}

/** Zwraca https URL albo null gdy pusty/niepoprawny. */
export function normalizeYoutubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let candidate = t;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  if (!isAllowedYoutubeUrl(candidate)) return null;
  try {
    const u = new URL(candidate);
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}
