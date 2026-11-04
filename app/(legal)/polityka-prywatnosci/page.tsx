import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocShell, LegalSection } from "@/components/legal/legal-doc-shell";
import { LEGAL_DOCS_UPDATED_LABEL } from "@/lib/legal-versions";
import { DELETE_ACCOUNT_PATH, getLegalSeller, REGULAMIN_PATH } from "@/lib/legal-seller";

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description:
    "Polityka prywatności i ochrony danych osobowych w serwisie GymBrat (RODO).",
  robots: { index: true, follow: true },
};

export default function PolitykaPrywatnosciPage() {
  const s = getLegalSeller();
  const updated = LEGAL_DOCS_UPDATED_LABEL;

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
            dane o zdrowiu i ciele (szczególna kategoria — art. 9 RODO), tylko
            za Twoją wyraźną zgodą: raporty ciała (waga, obwody, samopoczucie),
            tętno i inne parametry wpisane przy aktywności (np. kardio),
            zdjęcia sylwetki i zdjęcia z urządzeń treningowych; zgody udzielasz
            osobno dla danych o zdrowiu i dla zdjęć i możesz je wycofać w
            każdej chwili w Profilu → Konto,
          </li>
          <li>
            zgody i oświadczenia (m.in. wiek, zgody na przypomnienia i dane
            wrażliwe) wraz z wersją tekstu i czasem — jako dowód ich udzielenia,
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
          <li>
            zgoda — gdy jest wymagana (lit. a oraz, dla danych o zdrowiu i
            zdjęć sylwetki, art. 9 ust. 2 lit. a): dane o zdrowiu i ciele,
            zdjęcia, przypomnienia, analityka, reklamy.
          </li>
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
            reklamy przy braku aktywnego Pakietu,
          </li>
          <li>
            dostawcy monitoringu błędów i analityki (np. Sentry, PostHog) — tylko po
            Twojej zgodzie na analitykę, bez treści zdrowotnych,
          </li>
          <li>dostawca poczty e-mail (wiadomości transakcyjne i przypomnienia),</li>
          <li>
            dostawca generowania grafik AI (Pollinations) — otrzymuje wyłącznie
            ogólne opisy grafik, bez Twoich danych osobowych; grafiki AI są
            oznaczane.
          </li>
        </ul>
        <p>
          Część dostawców może przetwarzać dane poza Europejskim Obszarem
          Gospodarczym (np. w USA). W takim przypadku stosujemy mechanizmy z
          rozdziału V RODO (decyzja stwierdzająca odpowiedni stopień ochrony
          albo standardowe klauzule umowne). Aktualną listę podmiotów i
          mechanizmów udostępniamy na żądanie.
        </p>
      </LegalSection>

      <LegalSection id="okres" title="5. Okres przechowywania">
        <p>
          Dane Konta przechowujemy przez czas trwania umowy oraz przez okres
          przedawnienia roszczeń / obowiązków prawnych. Dane płatności — zgodnie
          z wymogami rachunkowymi i polityką operatora płatności (do 5 lat od końca
          roku podatkowego; po usunięciu Konta dokumentacja sprzedaży jest
          niepowiązana z Kontem).
        </p>
        <p>
          Konta nieaktywne przez 24 miesiące usuwamy po wcześniejszym ostrzeżeniu
          e-mail, a zdjęcia sylwetki — po 12 miesiącach nieaktywności. Zgłoszenia
          błędów usuwamy po 12 miesiącach od rozwiązania (zrzuty ekranu po 90
          dniach). Dane z dzienników technicznych przechowujemy od kilku dni do 180
          dni.
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
          eksport JSON/CSV oraz trwale usunąć Konto. Instrukcja usunięcia konta (także bez
          logowania): <Link href={DELETE_ACCOUNT_PATH} className="text-[var(--gym-gold)] underline-offset-2 hover:underline">{DELETE_ACCOUNT_PATH}</Link>.
        </p>
      </LegalSection>

      <LegalSection id="wiek" title="6a. Minimalny wiek">
        <p>
          Z Serwisu mogą korzystać osoby w wieku co najmniej 16 lat; zakup
          Pakietu jest dostępny dla osób pełnoletnich. Wiek potwierdzasz
          oświadczeniem przy rejestracji.
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

      <p className="border-t border-white/[0.08] pt-4 text-[13px] text-white/50">
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
