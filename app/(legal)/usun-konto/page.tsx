import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocShell, LegalSection } from "@/components/legal/legal-doc-shell";
import { getLegalSeller, PRIVACY_PATH } from "@/lib/legal-seller";

export const metadata: Metadata = {
  title: "Usuwanie konta i danych",
  description: "Jak usunąć konto GymBrat i powiązane dane — także bez logowania do aplikacji.",
  robots: { index: true, follow: true },
};

export default function UsunKontoPage() {
  const s = getLegalSeller();

  return (
    <LegalDocShell title="Usuwanie konta i danych" updated="2 listopada 2026" incomplete={!s.complete}>
      <p>
        Na tej stronie opisujemy, jak usunąć konto <strong className="text-white/90">GymBrat</strong>{" "}
        (aplikacja internetowa i Android) oraz co dzieje się z Twoimi danymi.
      </p>

      <LegalSection id="w-aplikacji" title="1. Usunięcie w aplikacji">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Zaloguj się i wejdź w Profil → Konto.</li>
          <li>W sekcji „Usuń konto” wybierz „Usuń konto”.</li>
          <li>
            Wpisz frazę potwierdzającą oraz hasło do konta. Jeśli logujesz się przez Google lub
            Facebook, zamiast hasła zaloguj się ponownie tym dostawcą — okno usuwania otworzy się po
            powrocie.
          </li>
        </ol>
        <p>Usunięcie jest natychmiastowe i nieodwracalne. Wcześniej możesz pobrać eksport swoich danych (JSON/CSV) w tym samym miejscu.</p>
      </LegalSection>

      <LegalSection id="bez-dostepu" title="2. Nie masz dostępu do konta?">
        <p>
          Napisz z adresu e-mail przypisanego do konta na{" "}
          <a href={`mailto:${s.email}`} className="text-[var(--gym-gold)] underline-offset-2 hover:underline">
            {s.email}
          </a>{" "}
          z prośbą o usunięcie konta. Możemy poprosić o potwierdzenie tożsamości. Odpowiadamy najpóźniej
          w ciągu miesiąca.
        </p>
      </LegalSection>

      <LegalSection id="zakres" title="3. Co zostaje usunięte">
        <p>
          Konto, profil, dane o treningach, diecie i ciele (w tym raporty i zdjęcia), zgody, przypomnienia,
          subskrypcje powiadomień push, powiązania logowania Google/Facebook oraz aktywne sesje.
        </p>
      </LegalSection>

      <LegalSection id="zatrzymane" title="4. Co zachowujemy i dlaczego">
        <p>
          Dokumentację sprzedaży pakietów (zamówienia, dane do potwierdzenia zakupu) przechowujemy w formie
          niepowiązanej z kontem przez okres wymagany przepisami (do 5 lat), po czym ją usuwamy. Szczegóły:{" "}
          <Link href={PRIVACY_PATH} className="text-[var(--gym-gold)] underline-offset-2 hover:underline">
            Polityka prywatności
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocShell>
  );
}
