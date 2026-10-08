import {
  COMPLETE_PROFILE_PATH,
  isCompleteProfilePath,
} from "@/lib/profile-complete";

/** Ścieżki dostępne bez sesji NextAuth (proxy nie robi 307 na /login). */
export const ANONYMOUS_PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function isAnonymousPublicPath(pathname: string): boolean {
  return ANONYMOUS_PUBLIC_PATHS.has(pathname);
}

/** Zalogowany użytkownik nie powinien zostawać na formularzu auth. */
export function shouldBounceAuthenticatedFromAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
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
  return true;
}

export { COMPLETE_PROFILE_PATH, isCompleteProfilePath };
