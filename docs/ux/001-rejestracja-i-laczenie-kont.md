# 001 - Rejestracja i łączenie kont: specyfikacja ekranów i mikrokopii

Autor: ux. Data: 2026-10-23. Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`.
Wejście: `docs/analiza/001-rejestracja-kod-i-oauth.md` (US-1 do US-8), `docs/prawo/001-bramka-wejsciowa-rejestracja.md` (LR-19, LR-21, LR-23, LR-25, LR-29), `docs/ux/00-system-projektowy-stan.md`. Mechanizmy techniczne (kody błędów, flaga stanu rejestracji, stan "przejęcie oczekuje na potwierdzenie") ustala ADR `docs/adr/0001-rejestracja-weryfikacja-i-laczenie-kont.md`; ten dokument określa tylko, co użytkownik widzi.

## 0. Zasady wspólne dla wszystkich stanów

- **Bez nowych komponentów i bez nowych kolorów.** Wszystko składamy z:
  - `components/auth/auth-hero-brand.tsx` (`AuthHeroBrand`, `compact` w krokach),
  - kontener karty auth jak w `components/auth/login-screen.tsx` i `register-form.tsx` (`glass-panel gold-panel` + dwa orby `--neon`; zostaje, bo to istniejący język ekranów auth),
  - `components/ui/inline-banner.tsx` (`InlineBanner` warianty `info`, `warning`, `error`, `success`; `role="alert"` dla błędów, `role="status"` dla informacji),
  - `components/ui/button.tsx` (`variant="cta"` 48 px dla akcji głównej, `variant="outline"` dla drugorzędnej, `variant="link"` dla akcji tekstowych), `components/auth/google-sign-in-button.tsx` (`GoogleSignInButton`, `FacebookSignInButton`, `AuthProviderDivider`),
  - panel admina: wyłącznie `components/admin/admin-ui.tsx` (`AdminNotice` z `tone` i `action`, `AdminPill`).
  - ikony lucide-react: `MailX` (e-mail niedostępny), `FlaskConical` (tryb testowy), `ShieldAlert` (przejęcie, ostrzeżenie), `ShieldCheck` (po przejęciu), `UserX` (nikt nie założy konta). Ikona w banerze zawsze obok tekstu, `aria-hidden`, rozmiar `h-4 w-4`, nigdy jako jedyny nośnik.
- **Kolory**: tylko tokeny i istniejące tony banerów. Złoto wyłącznie `var(--gym-gold)` / `var(--neon)` (linki, pasek postępu). Zakaz `#d4af37`, `#DDBB6D` i innych z tabeli niespójności nr 1.
- **Kontrast**: nowe teksty pomocnicze minimum `text-white/65` i `text-[13px]`. Nie używać `text-white/40` ani `text-[11px]` dla treści, od których zależy decyzja (dzisiejsza notka "będą dostępne po konfiguracji" ma `white/40` przy 11 px, poniżej 4,5:1 - do zastąpienia).
- **Nieaktywny przycisk zawsze ma widoczny powód** w tekście obok (nie tylko w `title`), powiązany przez `aria-describedby`. Nieaktywnych przycisków nie da się zfokusować, więc tekst powodu stoi w kolejności czytania bezpośrednio pod grupą przycisków.
- **Mikrokopia (LR-29)**: nie mówimy "wysłaliśmy", gdy nic nie wyszło; komunikaty OAuth nie mówią "konto istnieje" / "konto nie istnieje"; komunikat przejęcia nie mówi, co konto zawierało. Ton: na "ty", krótko, co się stało + co zrobić.
- **Ruch**: nowe banery bez własnej animacji wejścia (pojawiają się razem z krokiem kreatora, który już ma `AnimatePresence`). Frontend nie dodaje nowych animacji framer-motion.

## 1. Rejestracja: krok "welcome" (`components/auth/register-form.tsx`, `/register`)

Stan zależy od trzech flag przekazanych z `app/(auth)/register/page.tsx`: `emailRegistrationEnabled` (prod: SMTP skonfigurowane; dev/test: zawsze), `googleEnabled`, `facebookEnabled`. Nazwa propsa do potwierdzenia w ADR; wartość liczy serwer, nie klient.

### 1A. Wszystko dostępne (stan docelowy z SMTP)
Bez zmian w układzie: Google, e-mail, Facebook. Usuwamy tylko notkę "e-mail działa od razu".
- Support pod nagłówkiem: "Wybierz sposób rejestracji: Google, e-mail albo Facebook."

### 1B. E-mail niedostępny (produkcja bez SMTP), Google dostępny - główny przypadek D3
Układ (od góry, jedna kolumna, `space-y-3`):
1. `AuthHeroBrand` headline "Dołącz do GymBrat", support: **"Najszybciej założysz konto przez Google."**
2. `GoogleSignInButton` label "Zarejestruj się przez Google" - pierwsza pozycja (jak dziś), jedyna wyróżniona.
3. Przycisk "Zarejestruj się przez e-mail" - `disabled`, `aria-describedby="register-email-unavailable"`. Ikona `Mail` zostaje.
4. `FacebookSignInButton` (jeśli skonfigurowany, inaczej nie renderujemy go wcale - patrz niżej).
5. `InlineBanner variant="info" role="status" id="register-email-unavailable"` z ikoną `MailX`:
   - **"Rejestracja e-mailem jest chwilowo niedostępna. Załóż konto przez Google. Jeśli masz już konto z hasłem, zaloguj się normalnie."**
   - "zaloguj się" to `Link` do `/login` (kolor `var(--neon)`, podkreślenie przy hover i focus).

Wariant info, a nie warning: to nie błąd użytkownika, tylko ograniczenie, a obok jest działająca droga.

### 1C. E-mail niedostępny, Google niedostępny, Facebook dostępny
Jak 1B, ale support "Załóż konto przez Facebook." i baner: **"Rejestracja e-mailem jest chwilowo niedostępna. Załóż konto przez Facebook. Jeśli masz już konto z hasłem, zaloguj się normalnie."** Facebook staje się pierwszym przyciskiem.

### 1D. Żadna metoda niedostępna (brak SMTP i OAuth)
Nie pokazujemy trzech wyszarzonych przycisków (ściana nieaktywnych kontrolek nic nie mówi). Zamiast nich:
1. `AuthHeroBrand` headline "Rejestracja jest chwilowo niedostępna", support "Pracujemy nad tym. Spróbuj ponownie później."
2. `InlineBanner variant="warning" role="status"` z ikoną `UserX`: **"Nie można teraz założyć nowego konta. Logowanie na istniejące konto działa bez zmian."**
3. `Button variant="cta"` "Przejdź do logowania" (link do `/login`).
Stopka "Masz już konto?" znika (zdublowałaby CTA); linki do Regulaminu i Polityki zostają.

### 1E. Ukrywanie przycisków dostawców bez konfiguracji
Dziś Google/Facebook bez konfiguracji są wyszarzone z notką "będą dostępne po konfiguracji na serwerze" - to komunikat dla admina, nie dla użytkownika. Zmiana: nieskonfigurowanego dostawcy OAuth **nie renderujemy** (jak już robi `login-form.tsx`). Wyszarzamy tylko e-mail, bo jego niedostępność jest tymczasowa i wymaga wyjaśnienia. Notka z `white/40` znika w całości.

### 1F. Odmowa z serwera w trakcie (wyścig: SMTP zniknęło między renderem a kliknięciem)
Jeśli `sendRegisterCode` zwróci odmowę "rejestracja niedostępna" (kod do ustalenia w ADR) na kroku "email":
- `InlineBanner variant="error" role="alert"`: **"Rejestracja e-mailem jest teraz niedostępna. Wróć i wybierz Google."**
- pod banerem `Button variant="outline"` "Wróć do wyboru metody" (przejście na krok "welcome", fokus na pierwszy przycisk dostawcy).

## 2. Rejestracja: krok "email" - kod, tryb testowy, stany wysyłki

### 2A. Tryb testowy (tylko `NODE_ENV` development/test i brak SMTP, LR-21)
Flaga `emailCodeTestMode` liczona po stronie serwera; na produkcji nie może przyjść `true` (test regresji u `tester`).
- Nad polem "E-mail", jako pierwszy element kroku: `InlineBanner variant="warning" role="status"` z ikoną `FlaskConical`:
  - pierwsza linia pogrubiona: **"Tryb testowy"**
  - druga: **"E-maile nie są wysyłane. Wpisz kod 1234."**
- Placeholder pola kodu: "1234" (zamiast "6 cyfr").
- Po kliknięciu "Wyślij kod": komunikat pod polem **"Tryb testowy: wiadomość nie została wysłana. Użyj kodu 1234."** Nigdy "Kod wysłany" (LR-19, LR-29).
- Uwaga dla `frontend`: dziś fokus przeskakuje do hasła po 6 cyfrach; w trybie testowym po 4.
- Wariant warning (amber), bo to stan, który nie powinien wyglądać jak normalna aplikacja; zrzut ekranu z tym banerem od razu pokazuje, że to nie produkcja.

### 2B. Wysyłka prawdziwego kodu (US-1)
| Stan | Element | Kopia |
|---|---|---|
| Wysyłanie | przycisk "Wyślij kod" `disabled`, `aria-busy` | "Wysyłanie…" |
| Sukces (tylko po faktycznym nadaniu) | tekst pod polem, `role="status"`, `text-white/65` 13 px | "Kod wysłany na {email}. Sprawdź skrzynkę i folder SPAM. Kod jest ważny 10 minut." |
| Odstęp 60 s | przycisk `disabled` | "Wyślij ponownie (42 s)"; `aria-label` "Wyślij kod ponownie za 42 sekundy" (bez odczytu co sekundę: licznik poza `aria-live`) |
| Błąd SMTP | `InlineBanner error role=alert` | "Nie udało się wysłać kodu. Spróbuj ponownie za chwilę." |
| Offline | `InlineBanner error role=alert` | "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie. Wpisane dane zostają." |
| Błędny kod | błąd pola kodu | "Nieprawidłowy kod. Zostały 3 próby." (odmiana: 1 próba, 2-4 próby, 5 prób) |
| Wyczerpane próby / wygasły | błąd pola kodu | "Kod wygasł albo wykorzystano limit prób. Wyślij nowy kod." |

## 3. Logowanie: błędy i odmowy OAuth (`components/auth/login-form.tsx`, `/login?error=...`)

NextAuth kieruje błędy na `/login` (`auth.ts`, `pages.error`), także gdy użytkownik zaczynał na `/register`, więc każda kopia musi mieć sens w obu kontekstach.

### Układ
- Baner błędu OAuth przenosimy na **samą górę formularza**, przed przyciskami dostawców (dziś stoi między przyciskami a polami). Użytkownik wraca z Google i pierwsze, co widzi i co czyta czytnik, to powód odmowy.
- `InlineBanner variant="error" role="alert" id="login-banner"`.
- Błąd OAuth **nie ustawia** `aria-invalid` na polach e-mail i hasło (dziś każdy `error` je oznacza - pola nie są winne).
- Po odczytaniu `?error` frontend czyści parametr (`router.replace` bez `error`), żeby odświeżenie nie powtarzało komunikatu.

### Komunikaty (kody nazwane roboczo; ostateczne nazwy w ADR 0001)
| Przypadek | Kod roboczy | Kopia | Ujawnia stan konta? |
|---|---|---|---|
| Google bez `email_verified === true` (bez względu na to, czy konto istnieje) | `OAuthEmailUnverified` | "Google nie potwierdził Twojego adresu e-mail, więc nie możemy Cię tak zalogować. Potwierdź adres w ustawieniach konta Google albo zaloguj się e-mailem i hasłem." | Nie. Warunek: serwer odrzuca identycznie także przy braku konta (do potwierdzenia w ADR) |
| Facebook z adresem, który ma już konto | `OAuthLinkRefused` | "Nie możemy połączyć logowania przez Facebook z tym adresem e-mail. Zaloguj się e-mailem i hasłem albo przez Google." | Nie wprost. Sam fakt odmowy jest świadomym wyjątkiem z US-4 / LR-29; kopia nie używa słów "konto istnieje" |
| Facebook bez adresu e-mail | `OAuthNoEmail` | "Facebook nie przekazał nam adresu e-mail. Zezwól na udostępnienie adresu w ustawieniach Facebooka albo wybierz inną metodę." | Nie |
| Przejęcie nie powiodło się (wycofana transakcja) | `OAuthTakeoverFailed` | "Nie udało się dokończyć logowania. Niczego nie zmieniliśmy. Spróbuj ponownie za chwilę." | Nie |
| Dzisiejszy `OAuthAccountNotLinked` | zastąpiony przez `OAuthLinkRefused` | Usuwamy obecną kopię "Ten e-mail ma już konto... konta się połączą" - ujawnia konto i obiecuje łączenie, które po zmianie nie zachodzi dla kont niezweryfikowanych | - |
| Anulowanie / błąd dostawcy (`AccessDenied`, `OAuthCallback`, `OAuthSignin`) | bez zmian | "Logowanie przez Google lub Facebook zostało przerwane. Spróbuj ponownie." | Nie |
| `Configuration` | bez zmian | "Logowanie przez Google lub Facebook jest chwilowo niedostępne. Zaloguj się e-mailem i hasłem." | Nie |
| Odmowa roli admina (US-6) | brak | brak komunikatu; użytkownik loguje się jako zawodnik | Nie |

Uwaga dla `architekt`: jeśli `AccessDenied` zostaje kodem zbiorczym dla wszystkich odmów z callbacku `signIn`, UI nie rozróżni przypadków i pokaże ogólny komunikat, co łamie US-8. Potrzebne osobne kody w przekierowaniu.

### Informacja o OAuth na ekranie logowania (LR-25)
Pod `AuthProviderDivider`, tylko gdy jakikolwiek dostawca jest włączony, `text-[13px] text-white/65` wyśrodkowany:
"Logując się przez Google lub Facebook, przekazujesz nam imię i adres e-mail z tego konta. Szczegóły w Polityce prywatności." ("Polityce prywatności" to link do `/polityka-prywatnosci`). Ostateczny tekst zatwierdza prawnik-człowiek; to samo zdanie na kroku "welcome" rejestracji, nad linkami do Regulaminu.

## 4. Przejęcie konta niezweryfikowanego (US-5, BR-7, LR-23)

### Rekomendacja: ekran potwierdzenia przed przejęciem (wariant A)
Uzasadnienie: R4 - prawdziwy właściciel, który zapomniał, że ma konto z hasłem, traci dane bez ostrzeżenia. Ekran potwierdzenia daje mu szansę zalogować się hasłem i zachować dane. Ekran widzi wyłącznie osoba, której Google potwierdził adres, więc informacja "na ten adres jest konto" nie jest enumeracją (dostaje ją właściciel adresu). Wymaga stanu "przejęcie oczekuje" po stronie serwera (krótkotrwały, podpisany, jednorazowy) - decyzja `architekt` w ADR 0001. Jeśli ADR odrzuci wariant A, obowiązuje wariant B (sekcja 4B) bez zmian w kopii po przejęciu.

### 4A. Ekran "Zabezpiecz adres e-mail" (trasa w grupie `(auth)`, rama `AuthPageFrame`; ścieżka do ustalenia w ADR)
Układ (mobile-first, jedna kolumna, karta auth jak w `login-screen.tsx`):
1. `AuthHeroBrand compact` headline **"Ten adres ma już konto"**, support **"Zostało założone bez potwierdzenia adresu e-mail."**
2. W karcie, `InlineBanner variant="warning" role="status"` z ikoną `ShieldAlert`:
   **"Jeśli kontynuujesz przez Google, zabezpieczymy adres: dotychczasowe hasło i wszystkie dane tego konta zostaną trwale usunięte. Tego nie da się cofnąć."**
3. Tekst `text-sm text-white/75`: **"To Twoje konto i pamiętasz hasło? Zaloguj się hasłem, a dane zostaną."**
4. Akcje (`space-y-3`, pełna szerokość, każda min. 48 px):
   - `Button variant="outline"` **"Zaloguj się hasłem"** - na `/login`; to akcja domyślnie fokusowana (bezpieczniejsza).
   - `Button variant="destructive"` (istniejący wariant, bez nowych kolorów) **"Usuń dane i kontynuuj"**; w trakcie: `disabled`, `aria-busy`, etykieta **"Zabezpieczanie konta…"**.
   - `Button variant="link"` **"Anuluj"** - wylogowanie z sesji OAuth i powrót na `/login` bez zmian w koncie.
5. Kolejność akcji: bezpieczna przed destrukcyjną. Nie stosujemy dodatkowego `ConfirmDialog` - ekran sam jest potwierdzeniem, a etykieta przycisku mówi wprost, co się stanie.

Kopia nie wymienia rodzajów danych (zdjęcia, waga itd.) - LR-23: nie ujawniamy, co konto zawierało; "wszystkie dane tego konta" wystarcza.

Stany ekranu:
| Stan | Zachowanie |
|---|---|
| Ładowanie (weryfikacja stanu oczekującego) | `ScreenLoading` jak `app/(auth)/loading.tsx` |
| Stan oczekujący wygasł / już użyty | `InlineBanner error`: "Ten link wygasł. Zaloguj się ponownie przez Google." + `Button cta` "Przejdź do logowania" |
| Błąd przejęcia | powrót na ekran z `InlineBanner error role=alert`: "Nie udało się zabezpieczyć konta. Niczego nie zmieniliśmy. Spróbuj ponownie." |
| Offline przy kliknięciu | `InlineBanner error`: "Brak połączenia z internetem. Niczego nie zmieniliśmy. Spróbuj ponownie, gdy wrócisz do sieci." |
| Drugie urządzenie przejęło już konto | brak ekranu; użytkownik trafia na czyste konto (US-5) |
| Sukces | przejście do 4B |

### 4B. Komunikat po przejęciu (oba warianty)
Miejsce: pierwszy krok dokończenia rejestracji OAuth (`register-form.tsx`, krok "name" w `oauthContinue`), nad polami, raz.
- `InlineBanner variant="info" role="status"` z ikoną `ShieldCheck`:
  - pogrubione: **"Zabezpieczyliśmy Twój adres"**
  - treść (LR-23, prawnik): **"Ten adres był wcześniej użyty bez potwierdzenia. Zabezpieczyliśmy konto: dotychczasowe hasło i dane konta zostały usunięte. Zaczynasz od nowa."**
- Zamykany `Button variant="ghost" size="icon"` z `aria-label="Zamknij komunikat"` (40 px; cel 44 px zapewnia `touch-target`). Po zamknięciu i po przejściu dalej nie wraca (jednorazowość po stronie serwera, ADR).
- Wariant info, nie success: to informacja o stracie danych, nie powód do gratulacji; nie warning, bo nic już nie jest zagrożone.
- Fokus: na nagłówku kroku jak zwykle (baner czytany przez `role="status"`), żeby nie wyrywać fokusu przy pierwszym renderze.

### 4C. Poprzedni posiadacz sesji (wylogowany przez unieważnienie)
Trafia na `/login` jak przy wygaśnięciu sesji. Bez komunikatu o przejęciu (nie ujawniamy zdarzenia nieuwierzytelnionej osobie). Jeśli ADR doda sygnał wygaśnięcia sesji, kopia neutralna: "Sesja wygasła. Zaloguj się ponownie."

## 5. Panel administratora - ostrzeżenia konfiguracji

Źródło stanu: `lib/admin-config-status.ts` (pozycje `email`, `google`, `facebook`), endpoint `app/api/admin/config-status/route.ts`. Stan rejestracji (`email` / `oauth-only` / `closed`) wylicza serwer w podsumowaniu (pole do ustalenia w ADR); klient go nie wylicza z nazw zmiennych.

### 5A. Baner w ramie panelu (`components/admin/admin-shell.tsx`, nad `children`)
Jeden baner na raz, priorytet od góry:
1. **Nikt nie założy konta** (prod, brak SMTP i brak Google i Facebooka): `AdminNotice tone="danger"` (ma już `role="alert"`), ikona `UserX` przed tytułem:
   - pogrubione: **"Nikt nie może teraz założyć konta"**
   - treść: **"Brak wysyłki e-mail (SMTP) i logowania przez Google lub Facebook. Istniejące konta logują się normalnie. Skonfiguruj SMTP albo Google na hostingu."**
   - dopisek, gdy są inne braki: "Łącznie do skonfigurowania: {formatHostingFunctionCount(n)}."
   - `action`: link **"Otwórz Konfigurację"** (jak dziś).
2. **Brak SMTP, OAuth jest** (prod): `AdminNotice tone` jak dziś (`danger`, jeśli SMTP stanie się "wymagane" na produkcji - decyzja ADR; inaczej `warn`), ikona `MailX`:
   - pogrubione: **"Rejestracja e-mailem jest wyłączona"**
   - treść: **"Brak wysyłki e-mail (SMTP). Nowe konta można zakładać tylko przez {Google | Facebook | Google lub Facebook}."**
   - dopisek o pozostałych brakach jak wyżej.
3. Pozostałe braki: dzisiejszy baner bez zmian ("Trzeba skonfigurować na hostingu N funkcji...").

Baner zastępuje, a nie dokłada się do dzisiejszego - jeden komunikat na górze panelu. Poza produkcją (dev) bez SMTP banerów 1-2 nie pokazujemy (działa tryb testowy); pozycja SMTP w Konfiguracji ma wtedy opis "Lokalnie działa tryb testowy kodu (1234)."

### 5B. Strona Konfiguracja (`components/admin/admin-settings-client.tsx`)
Rama ukrywa baner na `/admin/settings`, więc tu:
- Ten sam `AdminNotice` 1 lub 2 nad kartą gotowości (bez linku "Otwórz Konfigurację", z linkiem "Przejdź do SMTP" przewijającym do karty `email`, kotwica `#config-email`).
- `IntegrationCard` dla `email`: `effectWhenMissing` (tekst w `lib/admin-config-status.ts`) **"Rejestracja e-mailem jest wyłączona. Konta można zakładać tylko przez Google lub Facebook (jeśli są skonfigurowane). Dzienny skrót e-mail z przypomnień nie wychodzi."** Pill poziomu zgodnie z ADR ("Wymagane" na produkcji).
- `google` i `facebook`: dzisiejsze "Użytkownicy logują się tylko e-mailem i hasłem." przestaje być prawdą bez SMTP. Nowy tekst: **"Brak przycisku logowania przez {Google|Facebook}. Bez SMTP i bez tego logowania nowi użytkownicy nie założą konta."**
- Dopisek przy SMTP (LR-22, `description` lub `hostingHint`): "Przed pierwszą wysyłką: umowa powierzenia z dostawcą oraz rekordy SPF, DKIM i DMARC. Nie używaj prywatnej skrzynki Gmail."

### 5C. Przegląd (`components/admin/admin-overview-client.tsx`)
Dziś na `/admin/overview` wyświetlają się dwa banery o konfiguracji (rama i strona). Dla tego zadania: strona przeglądu nie renderuje własnego, zostaje tylko baner ramy (5A). Priorytet P2 - jeśli frontend uzna to za poza zakresem, wpis do backlogu.

### Stany panelu
- Ładowanie statusu: brak banera do czasu odpowiedzi (bez migania pustego miejsca; dzisiejsze zachowanie).
- Błąd pobrania statusu: bez banera w ramie; na stronie Konfiguracja istniejący `AdminNotice tone="danger"` z błędem.
- Brak uprawnień: bez zmian (istniejący stan w `app/admin/(panel)/layout.tsx`).

## 6. Dostępność - lista kontrolna dla `frontend` i `tester`
- Wszystkie banery: `role="status"` (informacja) lub `role="alert"` (błąd); bez dodatkowego `aria-live` na elementach już mających rolę.
- Nieaktywny przycisk e-mail: `aria-describedby` na baner 1B; tekst powodu widoczny.
- Ikony w banerach `aria-hidden`; znaczenie zawsze w tekście (kolor nie jest jedynym nośnikiem).
- Ekran przejęcia: fokus startowy na "Zaloguj się hasłem"; Tab: Zaloguj się hasłem, Usuń dane i kontynuuj, Anuluj; przyciski 48 px; przycisk destrukcyjny nie reaguje na Enter z innego pola (brak formularza z submit).
- Kontrast tekstów nowych min. 4,5:1 (`white/65` lub jaśniej, 13 px+).
- Licznik ponownej wysyłki nie jest ogłaszany co sekundę.
- `prefers-reduced-motion`: brak nowych animacji.

## 7. Baseline wizualny dla `tester` (do zatwierdzenia przez ux w etapie 7-8)
Zrzuty 390 px i 1280 px: `/register` 1A, 1B, 1D; krok "email" w trybie testowym 2A; `/login?error=` dla każdego kodu z sekcji 3; ekran 4A (stan domyślny, w trakcie, błąd); krok "name" z banerem 4B; `/admin/overview` z banerem 5A-1 i 5A-2; `/admin/settings` z kartą SMTP w stanie "brak".

## 8. Zależności od ADR 0001 i otwarte punkty
1. Flagi z serwera: `emailRegistrationEnabled`, `emailCodeTestMode` oraz stan rejestracji w podsumowaniu konfiguracji.
2. Osobne kody błędów OAuth w przekierowaniu (sekcja 3), w tym identyczna odmowa niezweryfikowanego Google przy istniejącym i nieistniejącym koncie.
3. Wariant A przejęcia (stan oczekujący + trasa ekranu) albo wariant B.
4. Jednorazowość komunikatu 4B.
5. Poziom SMTP ("wymagane" na produkcji) - wpływa na ton banera 5A-2.
6. Teksty LR-25 (sekcja 3) i komunikat przejęcia: do zatwierdzenia przez prawnika-człowieka.

## Werdykt
ZATWIERDZONE Z UWAGAMI - projekt kompletny dla wszystkich stanów; uwagi to zależności od ADR 0001 (sekcja 8), bez których frontend nie zbuduje rozróżnień z sekcji 3 i 4.
