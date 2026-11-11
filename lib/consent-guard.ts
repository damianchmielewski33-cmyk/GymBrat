import "server-only";

import { NextResponse } from "next/server";
import { isConsentGranted } from "@/lib/consents";
import type { SensitiveConsentType } from "@/lib/consents-client";

/** Kod w odpowiedziach API/akcji, po którym klient pokazuje okno zgody i ponawia zapis. */
export const CONSENT_REQUIRED_CODE = "CONSENT_REQUIRED" as const;

export const CONSENT_REQUIRED_MESSAGES: Record<SensitiveConsentType, string> = {
  health:
    "Aby zapisać dane o ciele lub zdrowiu, najpierw wyraź zgodę na ich przetwarzanie (Profil → Prywatność i dane).",
  photos:
    "Aby zapisać zdjęcia, najpierw wyraź zgodę na ich przetwarzanie (Profil → Prywatność i dane).",
};

/** true = użytkownik NIE ma aktualnej zgody (ostatnia decyzja ≠ zgoda albo brak decyzji). */
export async function lacksSensitiveConsent(
  userId: string,
  type: SensitiveConsentType,
): Promise<boolean> {
  return !(await isConsentGranted(userId, type));
}

/** Odpowiedź 403 dla tras API (`ok:false` + kod + typ zgody do okna zgody po stronie klienta). */
export function consentRequiredResponse(type: SensitiveConsentType): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: CONSENT_REQUIRED_MESSAGES[type],
      code: CONSENT_REQUIRED_CODE,
      consent: type,
    },
    { status: 403 },
  );
}

/** Wynik dla akcji serwerowych. */
export function consentRequiredResult(type: SensitiveConsentType) {
  return {
    ok: false as const,
    error: CONSENT_REQUIRED_MESSAGES[type],
    code: CONSENT_REQUIRED_CODE,
    consent: type,
  };
}
