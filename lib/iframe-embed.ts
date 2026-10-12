/**
 * GymBrat w iframe Akademii (cross-origin) nie trzyma sesji Auth.js
 * (ciasto third-party) ani OAuth Google — stąd pusty / „skaczący” ekran.
 */

export function isLikelyInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // cross-origin: dostęp do top rzuca — jesteśmy w iframe
    return true;
  }
}

export type IframePromoteResult = "bridge" | "top" | "none";

/**
 * Wyciąga GymBrat z iframe:
 * - most AWP APK → openExternalUrl
 * - inaczej nawigacja top (pełna karta / WebView bez iframe)
 */
export function promoteGymBratOutOfIframe(
  url: string = typeof window !== "undefined" ? window.location.href : "",
): IframePromoteResult {
  if (typeof window === "undefined" || !url) return "none";
  if (!isLikelyInIframe()) return "none";

  const bridge = window.AwpAndroid?.openExternalUrl;
  if (typeof bridge === "function") {
    try {
      bridge.call(window.AwpAndroid, url);
      return "bridge";
    } catch {
      /* fall through */
    }
  }

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.replace(url);
      return "top";
    }
  } catch {
    /* sandbox / blokada */
  }

  return "none";
}

/** Czy URL wygląda na wejście z Academii (`?from=awp`). */
export function isFromAcademyQuery(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  try {
    const q = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
    return q.get("from") === "awp";
  } catch {
    return false;
  }
}
