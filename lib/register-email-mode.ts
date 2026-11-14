import "server-only";

import { isSmtpConfigured } from "@/lib/email";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

/**
 * Jedno źródło prawdy o trybie kodu rejestracji (ADR 0001 D1).
 * - `smtp`: kod wysyłany e-mailem.
 * - `test`: tylko lokalnie (`NODE_ENV` development/test, brak SMTP, brak znaczników hostingu);
 *   kod {@link TEST_REGISTER_CODE} jest zapisywany w tabeli kodów jak prawdziwy, ale nie wysyłany.
 * - `disabled`: rejestracja e-mailem wyłączona (np. produkcja i Preview bez SMTP, LR-21).
 */
export type RegisterEmailMode = "smtp" | "test" | "disabled";

/**
 * Jak aktywuje się konto założone e-mailem.
 * - `instant`: od razu po rejestracji, bez potwierdzenia adresu (do czasu skonfigurowania SMTP).
 *   Konto zostaje z `emailVerifiedAt = NULL`, więc adres nie daje uprawnień admina (`resolveEffectiveRole`),
 *   a prawdziwy właściciel adresu może je przejąć przez Google (`lib/account-takeover.ts`).
 * - `link`: aktywacja linkiem z e-maila (etap 3 planu, jeszcze niewdrożony).
 * - `disabled`: rejestracja e-mailem wyłączona (np. awaryjnie); zostają Google/Facebook.
 */
export type RegisterActivationMode = "instant" | "link" | "disabled";

export type RegistrationAvailability = {
  emailMode: RegisterActivationMode;
  google: boolean;
  facebook: boolean;
  /** Nikt nie założy konta: e-mail wyłączony i brak dostawców OAuth (obecnie nie zdarza się). */
  blocked: boolean;
};

/** Jedno źródło prawdy o aktywacji kont. Do wdrożenia linku: zwracać `link`, gdy SMTP działa. */
export function getRegisterActivationMode(): RegisterActivationMode {
  return "instant";
}

/** Kod trybu testowego (6 cyfr, jak prawdziwy kod). Nigdy nie działa na hostingu. */
export const TEST_REGISTER_CODE = "123456";

const HOSTING_MARKERS = ["VERCEL", "RENDER"] as const;

export function getRegisterEmailMode(
  env: NodeJS.ProcessEnv = process.env,
): RegisterEmailMode {
  if (isSmtpConfigured(env)) return "smtp";
  const nodeEnv = env.NODE_ENV;
  const localEnv = nodeEnv === "development" || nodeEnv === "test";
  const onHosting = HOSTING_MARKERS.some((name) => Boolean(env[name]?.trim()));
  return localEnv && !onHosting ? "test" : "disabled";
}

export function getRegistrationAvailability(
  env: NodeJS.ProcessEnv = process.env,
): RegistrationAvailability {
  const emailMode = getRegisterActivationMode();
  const google = isGoogleAuthConfigured(env);
  const facebook = isFacebookAuthConfigured(env);
  return {
    emailMode,
    google,
    facebook,
    blocked: emailMode === "disabled" && !google && !facebook,
  };
}
