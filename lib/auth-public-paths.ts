/** Ścieżki dostępne bez sesji NextAuth (proxy nie robi 307 na /login). */
export const ANONYMOUS_PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function isAnonymousPublicPath(pathname: string): boolean {
  return ANONYMOUS_PUBLIC_PATHS.has(pathname);
}

/** Zalogowany użytkownik nie powinien zostawać na formularzu auth. */
export function shouldBounceAuthenticatedFromAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}
