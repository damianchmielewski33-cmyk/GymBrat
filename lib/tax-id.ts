/** Walidacja polskiego NIP (10 cyfr + suma kontrolna); akceptuje myślniki i spacje. */
export function normalizeNip(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^PL/i, "");
}

export function isValidNip(raw: string): boolean {
  const nip = normalizeNip(raw);
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}
