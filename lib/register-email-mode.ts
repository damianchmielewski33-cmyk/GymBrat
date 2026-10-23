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

export type RegistrationAvailability = {
  emailMode: RegisterEmailMode;
  google: boolean;
  facebook: boolean;
  /** Nikt nie założy konta: brak SMTP (i trybu testowego) oraz brak dostawców OAuth. */
  blocked: boolean;
};

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
  const emailMode = getRegisterEmailMode(env);
  const google = isGoogleAuthConfigured(env);
  const facebook = isFacebookAuthConfigured(env);
  return {
    emailMode,
    google,
    facebook,
    blocked: emailMode === "disabled" && !google && !facebook,
  };
}
