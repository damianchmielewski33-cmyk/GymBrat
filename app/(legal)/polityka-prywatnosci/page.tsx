import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocShell, LegalSection } from "@/components/legal/legal-doc-shell";
import { getLegalSeller, REGULAMIN_PATH } from "@/lib/legal-seller";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description:
    "Polityka prywatności i ochrony danych osobowych w serwisie GymBrat (RODO).",
  robots: { index: true, follow: true },
};

export default function PolitykaPrywatnosciPage() {
  const s = getLegalSeller();
  const updated = "17 października 2026";

  return (
    <LegalDocShell
      title="Polityka prywatności"
      updated={updated}
      incomplete={!s.complete}
    >
      <p>
        Niniejsza Polityka prywatności opisuje zasady przetwarzania danych
        osobowych w serwisie <strong className="text-white/90">GymBrat</strong>{" "}
        ({s.siteUrl}), prowadzonym przez Sprzedawcę wskazanego poniżej.
      </p>

      <LegalSection id="admin" title="1. Administrator danych">
        <p>
          Administratorem danych osobowych jest:
          <br />
          <strong className="text-white/90">{s.sellerName}</strong>
          <br />
          {s.address}
          {s.nip ? (
            <>
              <br />
              NIP: {s.nip}
            </>
          ) : null}
        </p>
        <p>
          Kontakt w sprawach ochrony danych:{" "}
          <a
            href={`mailto:${s.email}`}
            className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
          >
            {s.email}
          </a>
          {s.phone ? (
            <>
              {" "}
              / tel.{" "}
              <a
                href={`tel:${s.phone.replace(/\s+/g, "")}`}
                className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
              >
                {s.phone}
              </a>
            </>
          ) : null}
          .
        </p>
      </LegalSection>

      <LegalSection id="zakres" title="2. Jakie dane przetwarzamy">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>dane konta: e-mail, imię i nazwisko, hasło (w formie hash),</li>
          <li>
            dane profilu fitness: waga, wzrost, wiek, aktywność, cele treningowe
            / żywieniowe — podane przez Użytkownika,
          </li>
          <li>
            dane o aktywności w aplikacji: treningi, serie, dziennik posiłków,
            raporty, ustawienia,
          </li>
          <li>
            dane płatności pakietu: identyfikatory zamówienia / transakcji u
            operatora płatności (bez pełnych danych kart),
          </li>
          <li>
            dane techniczne: logi, identyfikatory urządzenia / sesji, w zakresie
            niezbędnym do bezpieczeństwa i diagnostyki.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cele" title="3. Cele i podstawy prawne">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            wykonanie umowy o Konto i Pakiet (art. 6 ust. 1 lit. b RODO),
          </li>
          <li>
            obowiązki prawne (rachunkowość / podatki — lit. c), o ile dotyczą,
          </li>
          <li>
            prawnie uzasadniony interes Administratora: bezpieczeństwo Serwisu,
            przeciwdziałanie nadużyciom, statystyki zagregowane (lit. f),
          </li>
          <li>zgoda — gdy jest wymagana (lit. a), np. marketing.</li>
        </ul>
      </LegalSection>

      <LegalSection id="odbiorcy" title="4. Odbiorcy danych">
        <p>Dane mogą być powierzane zaufanym podmiotom przetwarzającym, m.in.:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>hosting / infrastruktura (np. Vercel, baza danych),</li>
          <li>
            zewnętrzny operator płatności — w zakresie realizacji płatności za
            Pakiety,
          </li>
          <li>
            dostawcy logowania społecznościowego (Google / Facebook), jeśli
            Użytkownik z nich skorzysta,
          </li>
          <li>
            dostawcy analityki / reklam (np. AdMob) — gdy wyświetlane są
            reklamy przy braku aktywnego Pakietu.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="okres" title="5. Okres przechowywania">
        <p>
          Dane Konta przechowujemy przez czas trwania umowy oraz przez okres
          przedawnienia roszczeń / obowiązków prawnych. Dane płatności — zgodnie
          z wymogami rachunkowymi i polityką operatora płatności.
        </p>
      </LegalSection>

      <LegalSection id="prawa" title="6. Prawa osoby, której dane dotyczą">
        <p>
          Przysługuje m.in. prawo dostępu, sprostowania, usunięcia, ograniczenia
          przetwarzania, przenoszenia danych oraz sprzeciwu — w granicach RODO.
          Skargi można składać do Prezesa UODO.
        </p>
        <p>
          Wnioski: {s.email}. W Profilu → „Prywatność i zgody” możesz pobrać
          eksport JSON/CSV oraz trwale usunąć Konto.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="7. Pliki cookies / lokalne dane">
        <p>
          Serwis używa niezbędnych plików cookies / magazynu lokalnego do sesji
          logowania, CSRF i bezpieczeństwa — bez nich aplikacja nie działa.
        </p>
        <p>
          Opcjonalnie, tylko po Twojej zgodzie w bannerze cookies (lub w Profilu):
          analityka wejść (page-view) oraz marketing / reklamy pełnoekranowe
          AdMob (gdy nie masz aktywnego Pakietu). W aplikacji Android zgody
          reklamowe AdMob są dodatkowo zbierane przez Google UMP.
        </p>
        <p>
          Zgodę możesz zmienić lub wycofać w każdej chwili w Profilu → Prywatność
          i zgody. Wycofanie zgody marketingowej zatrzymuje pokazywanie reklam;
          niezbędne cookies pozostają aktywne.
        </p>
      </LegalSection>

      <p className="border-t border-white/[0.08] pt-4 text-[13px] text-white/45">
        Zobacz także{" "}
        <Link
          href={REGULAMIN_PATH}
          className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
        >
          Regulamin
        </Link>
        .
      </p>
    </LegalDocShell>
  );
}
