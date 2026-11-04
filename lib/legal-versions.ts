/**
 * Jedno źródło wersji tekstów prawnych (Z15), powiązane z zapisem zgód (Z6/Z11).
 * Zmiana treści regulaminu/polityki/zgód ⇒ podbij odpowiednią wersję; wersje zapisywane przy
 * zamówieniu (`subscription_orders.terms_version`) i w rejestrze zgód (`user_consents.text_version`)
 * pozwalają wykazać, jaki tekst zaakceptował użytkownik.
 *
 * WSZYSTKIE teksty to SZKICE do zatwierdzenia przez prawnika-człowieka. Gdy prawnik je zatwierdzi,
 * ustaw `LEGAL_DOCS_APPROVED_BY_LAWYER = true` i podbij wersje bez przyrostka „szkic” — dopiero wtedy
 * baner „wersja robocza” znika ze stron prawnych.
 */
export const LEGAL_VERSIONS = {
  /** Regulamin + Polityka prywatności + /usun-konto (wyświetlane na stronach). */
  documents: "2026-11-szkic-v1",
  /** Zgody przy zakupie pakietu (`lib/order-consents.ts`). */
  orderTerms: "2026-11-orders-szkic-v1",
  /** Zgody na dane wrażliwe: zdrowie, zdjęcia, push (`lib/consents-client.ts`). */
  sensitiveConsents: "2026-11-sensitive-szkic-v1",
} as const;

export const LEGAL_DOCS_APPROVED_BY_LAWYER = false;

export const LEGAL_DOCS_UPDATED_LABEL = "2 listopada 2026";
