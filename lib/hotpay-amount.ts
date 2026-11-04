/**
 * Kwota z powiadomienia HotPay (`KWOTA`, np. "19.99") → grosze.
 * Zwraca `null` dla wszystkiego, co nie jest dodatnią kwotą z co najwyżej dwoma miejscami po przecinku
 * (puste, ujemne, "abc", "1.999", "1e2") — takie powiadomienie traktujemy jak niezgodne z zamówieniem.
 */
export function hotpayKwotaToGrosze(kwota: string): number | null {
  const normalized = kwota.trim().replace(",", ".");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const zloty = Number(match[1]);
  const grosze = Number((match[2] ?? "").padEnd(2, "0") || "0");
  return zloty * 100 + grosze;
}
