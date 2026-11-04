import { LEGAL_VERSIONS } from "@/lib/legal-versions";

/**
 * Zgody konsumenckie przy zakupie pakietu (Z6). Jedno źródło tekstu dla UI i serwera:
 * serwer zapisuje wersję i SHA-256 dokładnie tego tekstu jako dowód, co klient zaakceptował.
 *
 * UWAGA: treści to SZKIC do zatwierdzenia przez prawnika (US7/Z15). Po zmianie tekstu
 * podnieś `ORDER_TERMS_VERSION`.
 */
export const ORDER_TERMS_VERSION: string = LEGAL_VERSIONS.orderTerms;

export const ORDER_CONSENT_TEXTS = {
  terms: "Akceptuję Regulamin oraz Politykę prywatności.",
  immediateService:
    "Żądam rozpoczęcia świadczenia Pakietu przed upływem 14-dniowego terminu odstąpienia od umowy i przyjmuję do wiadomości, że po jej pełnym wykonaniu (aktywacji Pakietu) tracę prawo odstąpienia od umowy o treść cyfrową.",
} as const;

/** Kanoniczny ciąg do haszowania (wersja + oba teksty). */
export function orderConsentCanonicalText(): string {
  return [
    ORDER_TERMS_VERSION,
    ORDER_CONSENT_TEXTS.terms,
    ORDER_CONSENT_TEXTS.immediateService,
  ].join("\n");
}

export const ORDER_CONSENT_REQUIRED_MESSAGE =
  "Aby kupić pakiet, zaakceptuj Regulamin i zgodę na natychmiastowe rozpoczęcie świadczenia usługi.";
