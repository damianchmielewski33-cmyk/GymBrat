import { isLegalPublicPath } from "@/lib/legal-seller";
import {
  COMPLETE_PROFILE_PATH,
  isCompleteProfilePath,
} from "@/lib/profile-complete";

export const TAKEOVER_CONFIRM_PATH = "/login/zabezpiecz-konto";

/** Ścieżki dostępne bez sesji NextAuth (proxy nie robi 307 na /login). */
export const ANONYMOUS_PUBLIC_PATHS = new Set([
  "/",
  "/login",
  /** Potwierdzenie przejęcia konta niezweryfikowanego (ADR 0001 D4) — bez sesji. */
  TAKEOVER_CONFIRM_PATH,
  "/register",
  "/regulamin",
  "/polityka-prywatnosci",
]);

export function isAnonymousPublicPath(pathname: string): boolean {
  return ANONYMOUS_PUBLIC_PATHS.has(pathname) || isLegalPublicPath(pathname);
}

/**
 * Zalogowany użytkownik nie powinien zostawać na formularzu auth —
 * wyjątek: niepełny profil na /register (dokończenie rejestracji po Google/Facebook).
 */
export function shouldBounceAuthenticatedFromAuthPage(
  pathname: string,
  profileComplete?: boolean,
): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/register") {
    // Pełne konto → odbij; po OAuth bez wagi/wzrostu zostaje na wizardzie rejestracji.
    return profileComplete === true;
  }
  return false;
}

/** Po Google (lub innym niepełnym koncie) tylko ten ekran + auth API. */
export function postAuthDestination(profileComplete: boolean): string {
  return profileComplete ? "/" : COMPLETE_PROFILE_PATH;
}

export function mustCompleteProfile(
  pathname: string,
  profileComplete: boolean | undefined,
): boolean {
  if (profileComplete === true) return false;
  if (isCompleteProfilePath(pathname)) return false;
  // Regulamin / polityka — publiczne (także bez pełnego profilu).
  if (isLegalPublicPath(pathname)) return false;
  return true;
}

export { COMPLETE_PROFILE_PATH, isCompleteProfilePath };
