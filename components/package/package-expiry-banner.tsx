import Link from "next/link";
import { expiryBannerText, shouldShowExpiryBanner } from "@/lib/package-expiry";
import { getUserPackageStatus } from "@/lib/user-package";

/** Z24: informacja o końcu pakietu (≤ 7 dni) z przejściem do przedłużenia. Błąd odczytu nie psuje layoutu. */
export async function PackageExpiryBanner({ userId }: { userId: string }) {
  let pkg;
  try {
    pkg = await getUserPackageStatus(userId);
  } catch {
    return null;
  }
  if (!shouldShowExpiryBanner(pkg) || pkg.daysLeft == null) return null;
  return (
    <div
      role="status"
      className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 px-4 py-2.5 text-[13px] text-[var(--gym-gold)]"
    >
      <span>{expiryBannerText(pkg.daysLeft)}</span>
      <Link href="/package" className="font-medium underline">
        Przedłuż
      </Link>
    </div>
  );
}
