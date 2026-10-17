/**
 * Dane sprzedawcy do regulaminu i polityki prywatności.
 *
 * Env (produkcja):
 * - LEGAL_SELLER_NAME — pełna nazwa firmy albo imię i nazwisko
 * - LEGAL_SELLER_ADDRESS — pełny adres (ulica, nr, kod, miejscowość)
 * - LEGAL_SELLER_NIP — opcjonalnie (firma)
 * - LEGAL_SELLER_REGON — opcjonalnie
 * - LEGAL_SELLER_KRS — opcjonalnie
 * - LEGAL_CONTACT_EMAIL — obsługa klienta
 * - LEGAL_CONTACT_PHONE — telefon obsługi
 * - NEXT_PUBLIC_APP_URL — kanoniczny URL serwisu
 */

export type LegalSeller = {
  serviceName: string;
  sellerName: string;
  address: string;
  nip: string | null;
  regon: string | null;
  krs: string | null;
  email: string;
  phone: string | null;
  siteUrl: string;
  /** true = nazwa, adres i e-mail sprzedawcy są uzupełnione */
  complete: boolean;
};

function trimOrNull(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function getLegalSeller(): LegalSeller {
  const sellerName =
    process.env.LEGAL_SELLER_NAME?.trim() || "Sprzedawca GymBrat";
  const address =
    process.env.LEGAL_SELLER_ADDRESS?.trim() ||
    "Adres do uzupełnienia w LEGAL_SELLER_ADDRESS";
  const email =
    process.env.LEGAL_CONTACT_EMAIL?.trim() || "support@gymbrat.app";
  const phone = trimOrNull(process.env.LEGAL_CONTACT_PHONE);
  const nip = trimOrNull(process.env.LEGAL_SELLER_NIP);
  const regon = trimOrNull(process.env.LEGAL_SELLER_REGON);
  const krs = trimOrNull(process.env.LEGAL_SELLER_KRS);

  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://gym-brat.vercel.app"
  ).replace(/\/$/, "");

  const nameOk =
    Boolean(process.env.LEGAL_SELLER_NAME?.trim()) &&
    !sellerName.toLowerCase().includes("uzupełnić") &&
    sellerName !== "Sprzedawca GymBrat";
  const addressOk =
    Boolean(process.env.LEGAL_SELLER_ADDRESS?.trim()) &&
    !address.toLowerCase().includes("uzupełnić");
  const phoneOk = Boolean(phone);

  return {
    serviceName: "GymBrat",
    sellerName,
    address,
    nip,
    regon,
    krs,
    email,
    phone,
    siteUrl,
    complete: nameOk && addressOk && phoneOk && Boolean(email),
  };
}

export const REGULAMIN_PATH = "/regulamin";
export const PRIVACY_PATH = "/polityka-prywatnosci";

export function isLegalPublicPath(pathname: string): boolean {
  return pathname === REGULAMIN_PATH || pathname === PRIVACY_PATH;
}
