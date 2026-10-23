import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/legal-seller";

/** Informacja LR-25 o danych z Google/Facebooka (logowanie i krok „welcome” rejestracji). */
export function OAuthPrivacyNote() {
  return (
    <p className="text-center text-[13px] leading-relaxed text-white/65">
      Logując się przez Google lub Facebook, przekazujesz nam imię i adres e-mail z
      tego konta. Szczegóły w{" "}
      <Link
        href={PRIVACY_PATH}
        className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        Polityce prywatności
      </Link>
      .
    </p>
  );
}
