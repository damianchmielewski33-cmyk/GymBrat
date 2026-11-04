/**
 * Flagi produktowe (US5). Domyślnie wyłączone — włączane zmienną środowiskową na hostingu.
 */

/** Zakup pakietu (DK-13): checkout działa dopiero po `PREMIUM_CHECKOUT_ENABLED=1`. */
export function isPackageCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PREMIUM_CHECKOUT_ENABLED?.trim() === "1";
}

/**
 * Strony bez zdefiniowanego produktu (Z54/DK-9: `/promo-codes`, `/labs`) — ukryte,
 * dopóki `NEXT_PUBLIC_SHOW_UNFINISHED_PAGES=1`. Zmienna publiczna, bo steruje też menu w kliencie.
 */
export function showUnfinishedPages(value?: string): boolean {
  // Bezpośredni odczyt `process.env.NEXT_PUBLIC_*` — tylko tak Next wstawia wartość do kodu klienta.
  return (value ?? process.env.NEXT_PUBLIC_SHOW_UNFINISHED_PAGES)?.trim() === "1";
}
