import type { UserPackageStatus } from "@/lib/user-package";

/** Baner w aplikacji przy ≤ 7 dniach do końca pakietu (Z24). */
export const PACKAGE_EXPIRY_BANNER_DAYS = 7;
/** E-mail przypominający (za zgodą `push`) przy ≤ 3 dniach do końca pakietu — raz na okres. */
export const PACKAGE_EXPIRY_EMAIL_DAYS = 3;
export const PACKAGE_EXPIRY_DISPATCH_KIND = "package_expiry";

export function shouldShowExpiryBanner(pkg: Pick<UserPackageStatus, "active" | "daysLeft">): boolean {
  return pkg.active && pkg.daysLeft != null && pkg.daysLeft <= PACKAGE_EXPIRY_BANNER_DAYS;
}

/** Klucz deduplikacji: data końca pakietu (czas polski) — po przedłużeniu to nowy klucz, więc nowe przypomnienie. */
export function expiryDispatchKey(endsAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(endsAt);
}

export function expiryBannerText(daysLeft: number): string {
  if (daysLeft <= 1) return "Twój pakiet kończy się dziś lub jutro.";
  return `Twój pakiet kończy się za ${daysLeft} dni.`;
}
