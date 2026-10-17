import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocShell, LegalSection } from "@/components/legal/legal-doc-shell";
import { getLegalSeller, PRIVACY_PATH } from "@/lib/legal-seller";

export const metadata: Metadata = {
  title: "Regulamin | GymBrat",
  description:
    "Regulamin świadczenia usług drogą elektroniczną i sprzedaży pakietów dostępu do aplikacji GymBrat.",
  robots: { index: true, follow: true },
};

export default function RegulaminPage() {
  const s = getLegalSeller();
  const updated = "17 października 2026";

  return (
    <LegalDocShell title="Regulamin" updated={updated} incomplete={!s.complete}>
      <p>
        Niniejszy Regulamin określa zasady korzystania z serwisu internetowego{" "}
        <strong className="text-white/90">{s.serviceName}</strong> dostępnego pod
        adresem{" "}
        <a
          href={s.siteUrl}
          className="text-[#DDBB6D] underline-offset-2 hover:underline"
        >
          {s.siteUrl}
        </a>{" "}
        (dalej: „Serwis”) oraz warunki zawierania umów o dostęp do funkcji
        premium (pakietów) w aplikacji GymBrat.
      </p>

      <LegalSection id="sprzedawca" title="§1. Sprzedawca / Usługodawca">
        <p>
          Sprzedawcą i Usługodawcą jest:
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
          {s.regon ? (
            <>
              <br />
              REGON: {s.regon}
            </>
          ) : null}
          {s.krs ? (
            <>
              <br />
              KRS: {s.krs}
            </>
          ) : null}
        </p>
        <p>
          Kontakt w sprawach Serwisu, zamówień i reklamacji:
          <br />
          e-mail:{" "}
          <a
            href={`mailto:${s.email}`}
            className="text-[#DDBB6D] underline-offset-2 hover:underline"
          >
            {s.email}
          </a>
          {s.phone ? (
            <>
              <br />
              telefon:{" "}
              <a
                href={`tel:${s.phone.replace(/\s+/g, "")}`}
                className="text-[#DDBB6D] underline-offset-2 hover:underline"
              >
                {s.phone}
              </a>
            </>
          ) : (
            <>
              <br />
              telefon: zostanie podany w ustawieniach Serwisu
            </>
          )}
        </p>
        <p>
          Dane Sprzedawcy podane w niniejszym Regulaminie są danymi podmiotu
          prowadzącego Serwis i rozliczającego sprzedaż Pakietów.
        </p>
      </LegalSection>

      <LegalSection id="definicje" title="§2. Definicje">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white/85">Klient / Użytkownik</strong> —
            osoba fizyczna, osoba prawna lub jednostka organizacyjna korzystająca
            z Serwisu.
          </li>
          <li>
            <strong className="text-white/85">Konsument</strong> — Klient
            będący osobą fizyczną zawierającą umowę niezwiązaną bezpośrednio z
            jej działalnością gospodarczą lub zawodową.
          </li>
          <li>
            <strong className="text-white/85">Konto</strong> — indywidualne
            konto Użytkownika w Serwisie, chronione loginem (e-mail) i hasłem
            albo logowaniem OAuth (np. Google).
          </li>
          <li>
            <strong className="text-white/85">Pakiet</strong> — płatny dostęp
            premium na oznaczoną liczbę dni (np. 7 / 30 / 90 / 365), ograniczający
            lub wyłączający wyświetlanie reklam pełnoekranowych oraz aktywujący
            uzgodnione funkcje Serwisu.
          </li>
          <li>
            <strong className="text-white/85">Zamówienie</strong> — oświadczenie
            woli Klienta zmierzające do zawarcia umowy sprzedaży Pakietu.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="zakres" title="§3. Rodzaj oferty i zakres usług">
        <p>
          Serwis GymBrat jest aplikacją webową / mobilną do planowania i
          rejestrowania treningów siłowych oraz diety (dziennik żywieniowy,
          cele makro, historia, społeczność i powiązane funkcje).
        </p>
        <p>W ramach Serwisu oferowane są w szczególności:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>dostęp do Konta oraz podstawowych funkcji treningowych i dietetycznych,</li>
          <li>
            sprzedaż cyfrowych Pakietów dostępu premium na czas określony
            (treść cyfrowa / usługa cyfrowa dostarczana niezwłocznie po
            opłaceniu),
          </li>
          <li>
            opcjonalnie: treści pomocnicze (np. katalog przepisów, wskazówki),
            o ile są dostępne w danej wersji Serwisu.
          </li>
        </ul>
        <p>
          Serwis <strong className="text-white/85">nie sprzedaje</strong>{" "}
          towarów fizycznych. Nie ma kosztów ani terminów dostawy przesyłki —
          świadczenie ma charakter wyłącznie cyfrowy.
        </p>
        <p>
          Opisy Pakietów (liczba dni, cena w PLN, zakres) prezentowane są na
          stronie{" "}
          <Link
            href="/package"
            className="text-[#DDBB6D] underline-offset-2 hover:underline"
          >
            /package
          </Link>{" "}
          przed złożeniem Zamówienia. Cena zawiera należny podatek, o ile
          wynika z obowiązujących przepisów i statusu Sprzedawcy; ostateczna
          kwota do zapłaty jest widoczna przed przekierowaniem do płatności.
        </p>
      </LegalSection>

      <LegalSection id="konto" title="§4. Konto i zawarcie umowy o usługi elektroniczne">
        <p>
          Korzystanie z pełnych funkcji Serwisu wymaga założenia Konta
          (rejestracja e-mail albo Google/Facebook, o ile są włączone) oraz
          akceptacji niniejszego Regulaminu.
        </p>
        <p>
          Umowa o świadczenie usług drogą elektroniczną (prowadzenie Konta)
          zawierana jest z chwilą rejestracji i trwa do usunięcia Konta przez
          Użytkownika lub Sprzedawcę na zasadach określonych w Regulaminie.
        </p>
        <p>
          Użytkownik zobowiązuje się podawać prawdziwe dane, chronić dane
          logowania oraz nie udostępniać Konta osobom trzecim.
        </p>
        <p>
          Sprzedawca może zawiesić lub usunąć Konto w razie rażącego naruszenia
          Regulaminu, działań bezprawnych albo zagrożenia bezpieczeństwa
          Serwisu — po uprzednim poinformowaniu Użytkownika na e-mail Konta,
          o ile jest to możliwe.
        </p>
      </LegalSection>

      <LegalSection id="zamowienie" title="§5. Składanie Zamówienia i realizacja">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Klient wybiera Pakiet na stronie /package.</li>
          <li>
            Przed płatnością Klient akceptuje Regulamin (oraz — w przypadku
            Konsumenta — treść o rozpoczęciu świadczenia przed upływem terminu
            odstąpienia, o ile dotyczy).
          </li>
          <li>
            Klient zostaje przekierowany do zewnętrznej bramki płatniczej w celu
            uiszczenia ceny.
          </li>
          <li>
            Po otrzymaniu potwierdzenia płatności od operatora płatności Pakiet
            jest aktywowany automatycznie na Koncie — zwykle w ciągu kilku
            sekund, nie później niż w ciągu 24 godzin od zaksięgowania
            płatności.
          </li>
        </ol>
        <p>
          Termin realizacji Zamówienia: niezwłocznie po potwierdzeniu płatności
          przez operatora płatności (dostawa cyfrowa na Konto).
        </p>
        <p>
          Ograniczenia: Pakiet przypisany jest do Konta Kupującego; nie
          obejmuje dostawy towarów fizycznych ani eksportu produktów fizycznych.
          Dostęp wymaga działającego połączenia internetowego oraz
          kompatybilnej przeglądarki / aplikacji.
        </p>
      </LegalSection>

      <LegalSection id="platnosci" title="§6. Płatności">
        <p>
          Dostępne formy płatności: metody udostępnione przez zewnętrznego
          operatora płatności (m.in. BLIK, szybkie przelewy online / Pay-by-Link
          oraz inne metody widoczne w oknie płatności w chwili zakupu).
        </p>
        <p>
          <strong className="text-white/90">
            Rozliczenia transakcji elektronicznych przeprowadzane są za
            pośrednictwem zewnętrznego operatora płatności
          </strong>{" "}
          — zgodnie z komunikatami i regulaminem tego operatora w procesie
          płatności.
        </p>
        <p>
          Sprzedawca nie przechowuje pełnych danych kart płatniczych. Status
          płatności wynika z powiadomień operatora.
        </p>
        <p>Waluta rozliczeniowa: polski złoty (PLN).</p>
      </LegalSection>

      <LegalSection id="odstapienie" title="§7. Prawo odstąpienia (Konsument)">
        <p>
          Konsumentowi co do zasady przysługuje prawo odstąpienia od umowy
          zawartej na odległość w terminie 14 dni bez podania przyczyny — na
          zasadach ustawy o prawach konsumenta.
        </p>
        <p>
          W przypadku treści cyfrowych / usług cyfrowych niedostarczanych na
          nośniku materialnym, Konsument traci prawo odstąpienia, jeżeli:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            wyraził wyraźną zgodę na rozpoczęcie świadczenia przed upływem
            terminu odstąpienia,
          </li>
          <li>został poinformowany o utracie prawa odstąpienia, oraz</li>
          <li>
            Sprzedawca rozpoczął świadczenie (aktywacja Pakietu na Koncie).
          </li>
        </ul>
        <p>
          Składając Zamówienie i zaznaczając wymaganą zgodę przy zakupie,
          Konsument potwierdza powyższe. W pozostałych przypadkach oświadczenie
          o odstąpieniu należy wysłać na e-mail: {s.email}.
        </p>
      </LegalSection>

      <LegalSection id="reklamacje" title="§8. Reklamacje">
        <p>
          Reklamacje dotyczące Pakietu, płatności lub działania Serwisu należy
          składać na adres {s.email}
          {s.phone ? ` lub telefonicznie: ${s.phone}` : ""}.
        </p>
        <p>
          Reklamacja powinna zawierać: dane Kontaktowe, opis problemu oraz —
          jeśli dotyczy — identyfikator płatności / datę zakupu.
        </p>
        <p>
          Sprzedawca rozpatruje reklamację w terminie 14 dni od otrzymania i
          odpowiada na e-mail wskazany w reklamacji lub przypisany do Konta.
        </p>
      </LegalSection>

      <LegalSection id="rekojmia" title="§9. Rękojmia i gwarancja">
        <p>
          Wobec Konsumentów zastosowanie mają przepisy o rękojmi za wady
          wynikające z Kodeksu cywilnego / ustawy o prawach konsumenta — w
          zakresie, w jakim dotyczą usług i treści cyfrowych.
        </p>
        <p>
          Sprzedawca nie udziela odrębnej gwarancji producenta na Pakiety (brak
          towarów fizycznych). Ewentualne usterki techniczne Serwisu zgłasza się
          w trybie reklamacyjnym.
        </p>
      </LegalSection>

      <LegalSection id="odpowiedzialnosc" title="§10. Odpowiedzialność">
        <p>
          Serwis ma charakter narzędziowy (trening, dieta). Nie stanowi porady
          medycznej. Użytkownik korzysta z Serwisu na własną odpowiedzialność,
          szczególnie przy problemach zdrowotnych — po konsultacji z lekarzem.
        </p>
        <p>
          Sprzedawca dokłada starań, by Serwis działał ciągle, lecz nie
          gwarantuje nieprzerwanej dostępności (przerwy techniczne, siła
          wyższa, awarie operatorów).
        </p>
      </LegalSection>

      <LegalSection id="dane" title="§11. Dane osobowe">
        <p>
          Zasady przetwarzania danych osobowych określa{" "}
          <Link
            href={PRIVACY_PATH}
            className="text-[#DDBB6D] underline-offset-2 hover:underline"
          >
            Polityka prywatności
          </Link>
          , stanowiąca integralną część dokumentacji Serwisu.
        </p>
      </LegalSection>

      <LegalSection id="zmiany" title="§12. Zmiany Regulaminu">
        <p>
          Sprzedawca może zmienić Regulamin z ważnych przyczyn (prawo, bezpieczeństwo,
          nowe funkcje płatności). O zmianie poinformuje w Serwisie lub e-mailem.
          Dalsze korzystanie z Serwisu po dacie wejścia zmian oznacza ich
          akceptację, o ile przepisy nie stanowią inaczej.
        </p>
      </LegalSection>

      <LegalSection id="prawo" title="§13. Prawo właściwe">
        <p>
          Do umów stosuje się prawo polskie. W sporach z Konsumentem właściwe
          są przepisy o właściwości sądów oraz możliwość skorzystania z
          pozasądowych sposobów rozpatrywania sporów (m.in. platforma ODR UE).
        </p>
      </LegalSection>

      <p className="border-t border-white/[0.08] pt-4 text-[13px] text-white/45">
        Adres Regulaminu:{" "}
        <a
          href={`${s.siteUrl}/regulamin`}
          className="break-all text-[#DDBB6D] underline-offset-2 hover:underline"
        >
          {s.siteUrl}/regulamin
        </a>
      </p>
    </LegalDocShell>
  );
}
