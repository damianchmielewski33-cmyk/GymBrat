/**
 * Mikrokopia ekranów logowania i rejestracji (UX 001, sekcje 1 i 3).
 * Czyste funkcje: stan liczy serwer, tu tylko wybór tekstu.
 */

import { OAUTH_ERROR_CODES, type OAuthErrorCode } from "@/lib/auth-error-codes";
import type { RegistrationAvailability } from "@/lib/register-email-mode";

/**
 * Odmowy z callbacku `signIn` (ADR 0001 D3); komunikaty nie ujawniają stanu konta (LR-29).
 * `OAuthLinkRefused` dotyczy Facebooka i Google (konto admina), a URL niesie tylko kod,
 * więc kopia nie nazywa dostawcy.
 */
const OAUTH_REFUSAL_MESSAGES: Record<OAuthErrorCode, string> = {
  OAuthEmailUnverified:
    "Google nie potwierdził Twojego adresu e-mail, więc nie możemy Cię tak zalogować. Potwierdź adres w ustawieniach konta Google albo zaloguj się e-mailem i hasłem.",
  OAuthLinkRefused:
    "Nie możemy połączyć tego logowania z tym adresem e-mail. Zaloguj się e-mailem i hasłem.",
  OAuthNoEmail:
    "Facebook nie przekazał nam adresu e-mail. Zezwól na udostępnienie adresu w ustawieniach Facebooka albo wybierz inną metodę.",
  OAuthSignInFailed:
    "Nie udało się dokończyć logowania. Niczego nie zmieniliśmy. Spróbuj ponownie za chwilę.",
};

function isOAuthRefusal(code: string): code is OAuthErrorCode {
  return (OAUTH_ERROR_CODES as readonly string[]).includes(code);
}

/** Komunikat dla `/login?error=<kod>` (kody z `lib/auth-error-codes.ts` i Auth.js). */
export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (isOAuthRefusal(code)) return OAUTH_REFUSAL_MESSAGES[code];
  switch (code) {
    case "AccessDenied":
    case "OAuthCallback":
    case "OAuthSignin":
      return "Logowanie przez Google lub Facebook zostało przerwane. Spróbuj ponownie.";
    case "Configuration":
      return "Logowanie przez Google lub Facebook jest chwilowo niedostępne. Zaloguj się e-mailem i hasłem.";
    default:
      return "Nie udało się zalogować przez konto zewnętrzne. Spróbuj ponownie.";
  }
}

export const SESSION_EXPIRED_MESSAGE = "Sesja wygasła. Zaloguj się ponownie.";

export const OFFLINE_REGISTER_MESSAGE =
  "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie. Wpisane dane zostają.";

export type RegisterWelcomeCopy =
  | { kind: "closed"; headline: string; support: string }
  | {
      kind: "open";
      support: string;
      /** Tekst banera, gdy e-mail jest niedostępny, a OAuth działa (UX 1B/1C). */
      emailUnavailableProvider: "Google" | "Facebook" | null;
    };

function joinAlternatives(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} albo ${items[items.length - 1]}`;
}

/** Jedyne źródło tekstów błędów ekranu przejęcia konta; akcja zwraca tylko kody (UX 001, 4A). */
export const TAKEOVER_ERROR_MESSAGES = {
  expired: "Ten link wygasł. Zaloguj się ponownie przez Google.",
  failed: "Nie udało się zabezpieczyć konta. Niczego nie zmieniliśmy. Spróbuj ponownie.",
  offline:
    "Brak połączenia z internetem. Niczego nie zmieniliśmy. Spróbuj ponownie, gdy wrócisz do sieci.",
} as const;

const REGISTRATION_CLOSED: RegisterWelcomeCopy = {
  kind: "closed",
  headline: "Rejestracja jest chwilowo niedostępna",
  support: "Pracujemy nad tym. Spróbuj ponownie później.",
};

/**
 * Wybór wariantu kroku „welcome” rejestracji (UX 1A-1D). Stan „zamknięte” daje serwer
 * (`availability.blocked`); `emailRefused` to odmowa `registration_disabled` w trakcie
 * rejestracji (UX 1F) — bez dostawców OAuth zamyka rejestrację tak samo.
 */
export function registerWelcomeCopy(
  availability: RegistrationAvailability,
  emailRefused = false,
): RegisterWelcomeCopy {
  if (availability.blocked) return REGISTRATION_CLOSED;
  const methods = {
    email: availability.emailMode !== "disabled" && !emailRefused,
    google: availability.google,
    facebook: availability.facebook,
  };
  if (!methods.email) {
    if (!methods.google && !methods.facebook) return REGISTRATION_CLOSED;
    const provider = methods.google ? "Google" : "Facebook";
    return {
      kind: "open",
      support: methods.google
        ? "Najszybciej założysz konto przez Google."
        : "Załóż konto przez Facebook.",
      emailUnavailableProvider: provider,
    };
  }
  const available = [
    methods.google ? "Google" : null,
    "e-mail",
    methods.facebook ? "Facebook" : null,
  ].filter((v): v is string => v !== null);
  return {
    kind: "open",
    support:
      available.length === 1
        ? "Załóż konto przez e-mail."
        : `Wybierz sposób rejestracji: ${joinAlternatives(available)}.`,
    emailUnavailableProvider: null,
  };
}
