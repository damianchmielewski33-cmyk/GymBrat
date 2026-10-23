# 001 - Rejestracja: weryfikacja e-maila, łączenie kont OAuth, rola admina

Autor: analityk. Data: 2026-10-23. Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`. Źródła: W1 w `docs/bezpieczenstwo/00-model-zagrozen-bazowy.md`, decyzje D3, D4, D6, D7, D22 w `docs/zespol/decyzje-wlasciciela.md`. Dokument opisuje wymagania, nie rozwiązanie techniczne (to robi `architekt`).

Rewizja 2026-10-23 po bramce prawnej (`docs/prawo/001-bramka-wejsciowa-rejestracja.md`, LR-19 do LR-30): zmieniono BR-7, US-5, DW-2 (usuwanie danych przy przejęciu), BR-1 (retencja kodów), US-9/BR-10 i nowa BR-13 (dziennik zdarzeń bezpieczeństwa, min. 180 dni), BR-14 (zależność wydania od oceny incydentu), sekcje 6, 8, 9, 10, 11. Rozstrzygnięcia prawnika wymagają zatwierdzenia przez prawnika-człowieka i właściciela.

## 1. Kontekst i cel

### Stan obecny (potwierdzony w kodzie)
- `actions/auth.ts`: `isRegisterEmailMockMode()` włącza tryb testowy, gdy brak `SMTP_HOST/USER/PASS` (albo `MOCK_REGISTER_EMAIL_CODE=1`). W tym trybie `sendRegisterCode` nic nie wysyła i zwraca "ok", a `registerUser` przyjmuje stały kod `1234` dla dowolnego adresu. Tryb działa także na produkcji (D3: brak SMTP na Render). Formularz (`components/auth/register-form.tsx`) mówi "Kod wysłany. Sprawdź skrzynkę", choć nic nie wysłano. Walidacja (`lib/validations/register.ts`) dopuszcza 4 lub 6 cyfr tylko z powodu tego trybu.
- Rekord konta z kodem mock jest oznaczony wyłącznie w `site_activity_log.metaJson` (`emailCodeMock: true`); tabela `users` nie ma pola "e-mail zweryfikowany". Konta nie da się więc dziś odróżnić w samej tabeli użytkowników.
- `auth.ts`: `allowDangerousEmailAccountLinking: true` dla Google i Facebooka; callback `signIn` odrzuca tylko `email_verified === false` (brak pola = przepuszcza; Facebook go nie zwraca).
- `lib/google-auth.ts` (`resolveGoogleSignInUser`): jeśli istnieje konto z tym e-mailem, OAuth jest do niego dowiązywane bez żadnego warunku. `ensureOauthLink` potrafi też przenieść istniejące powiązanie (provider + providerAccountId) na inne konto. Nowe konto OAuth dostaje rolę admina, jeśli e-mail jest w `parseAdminEmails()`.
- `lib/admin-config.ts`: `PRIMARY_ADMIN_EMAIL` jest na stałe w kodzie (publiczne repo, D6) i zawsze daje rolę admina, niezależnie od pustego `ADMIN_EMAILS` (D4). `auth.ts` (Credentials i `jwt`) nadaje i zapisuje `appRole = admin` po samym e-mailu.
- Ekran logowania/rejestracji ma przyciski Google/Facebook wyłączane, gdy brak konfiguracji; e-mail jest przedstawiany jako zawsze działający ("e-mail działa od razu").

### Cel
Konto i rola admina mogą powstać tylko dla kogoś, kto udowodnił kontrolę nad adresem e-mail. Likwidujemy trzy drogi przejęcia konta z W1:
1. rejestracja na cudzy adres kodem `1234`,
2. automatyczne dowiązanie logowania OAuth do istniejącego konta po samym e-mailu,
3. rola admina nadawana po samym adresie e-mail.

Dane o ciele i zdrowiu (waga, zdjęcia sylwetki) są wrażliwe, więc przejęcie konta oznacza wyciek takich danych. Kontakt z `prawnik`: reguły LR dla logowania i bezpieczeństwa przetwarzania (art. 32 RODO) oraz informacja dla użytkowników, jeśli dojdzie do jakiejkolwiek zmiany stanu istniejących kont (sekcja 6).

## 2. Interesariusze
| Rola | Cel |
|---|---|
| Osoba rejestrująca się (początkująca, bez wiedzy technicznej) | Szybka rejestracja i jasny komunikat, co zrobić, gdy e-mail jest niedostępny. |
| Osoba z istniejącym kontem (e-mail/hasło lub Google) | Brak utraty danych o treningach i ciele; nikt obcy nie ma dostępu do konta. |
| Użytkownik logujący się przez Facebook | Możliwość wejścia bez dostępu do kont innych osób. |
| Administrator / właściciel (osoba prywatna, D17) | Admin tylko dla właściciela; widoczny w panelu stan konfiguracji; brak własnej utraty dostępu w trakcie wdrożenia. |
| Atakujący (perspektywa modelu zagrożeń) | Nie może przejąć konta ani roli admina na cudzy adres. |

## 3. Założenia
- Z1. Do czasu SMTP (D22) produkcja nie wysyła e-maili. Rejestracja e-mailem jest wtedy wyłączona (fail closed), a nie "otwarta bez weryfikacji". Google (i Facebook), jeśli skonfigurowane, pozostają jedynymi drogami założenia konta.
- Z2. Tryb testowy kodu istnieje wyłącznie poza produkcją (rozwój lokalny, testy automatyczne). Produkcja = `NODE_ENV=production`, czyli także Preview/staging na hostingu. Zmienna `MOCK_REGISTER_EMAIL_CODE` jest usuwana: nie może włączyć trybu testowego na produkcji w żadnych okolicznościach.
- Z3. "E-mail zweryfikowany" oznacza jedno z dwóch: poprawnie wpisany jednorazowy kod wysłany na ten adres albo OAuth Google z `email_verified === true`. Facebook (brak `email_verified`) nigdy nie liczy się jako weryfikacja.
- Z4. Dla Facebooka zachowujemy możliwość założenia nowego konta (jeśli skonfigurowany), ale e-mail z Facebooka jest traktowany jako niezweryfikowany. Właściciel może zdecydować o wycofaniu Facebooka (nie blokuje projektu).
- Z5. Rola `trener` w logowaniu jest poza zakresem (D7 osobne zadanie); to zadanie nie zmienia obsługi roli poza admin.
- Z6. Reset hasła nie istnieje i nie jest częścią tego zadania; skutki dla kont dotkniętych unieważnieniem hasła opisane w sekcji 6.
- Z7. Liczba kont na produkcji jest mała; rozstrzygnięcie sekcji 6 nie wymaga masowej komunikacji, ale wymaga decyzji właściciela.
- Z8. Zgodnie z AGENTS.md nowa/zmieniona zależność od zmiennych środowiska wymaga wpisu w `lib/admin-config-status.ts` oraz opisu w `env.example`.

## 4. User stories i kryteria akceptacji

### US-1 (Must) Rejestracja e-mailem wymaga prawdziwego kodu
Jako osoba rejestrująca się chcę potwierdzić swój adres kodem z wiadomości, aby nikt nie założył konta na mój e-mail.

- Given SMTP skonfigurowane na produkcji, When podaję e-mail i klikam "Wyślij kod", Then dostaję 6-cyfrowy kod ważny 10 minut, a komunikat "Kod wysłany" pojawia się dopiero po faktycznym nadaniu wiadomości.
- Given wpisuję kod `1234` (lub inny niż wysłany), When wysyłam formularz, Then konto nie powstaje i widzę komunikat o błędnym kodzie z liczbą pozostałych prób (limit 5 prób, potem nowy kod; zachowane).
- Given kod wygasł lub został użyty, When go wpisuję, Then odmowa z prośbą o nowy kod.
- Given wysyłka e-maila się nie powiodła (błąd SMTP), When klikam "Wyślij kod", Then widzę błąd "Nie udało się wysłać kodu" i nie widzę komunikatu o sukcesie; limity prób i odstęp 60 s działają bez zmian.
- Given adres ma już konto, When proszę o kod, Then komunikat jak dziś (enumeracja kont N5 pozostaje otwarta w osobnym zadaniu) i brak wysłania kodu.
- Brzeg: dwa urządzenia jednocześnie. Given proszę o kod na telefonie i na laptopie, When drugi kod nadpisuje pierwszy, Then ważny jest tylko ostatni, a pierwszy daje komunikat o błędnym kodzie.
- Brzeg: dwie równoległe rejestracje na ten sam adres. Then dokładnie jedna się powiedzie, druga dostaje "Konto z tym e-mailem już istnieje".
- Brzeg: strefa czasowa. Ważność kodu liczona w UTC po stronie serwera; zmiana strefy czasowej telefonu nie wpływa na ważność.
- Brzeg: brak sieci w trakcie wysyłania. Then formularz zachowuje wpisane dane, pokazuje błąd i pozwala ponowić; nie ma trybu offline dla rejestracji.

### US-2 (Must) Produkcja bez SMTP nie przyjmuje rejestracji e-mailem
Jako właściciel chcę, aby bez skonfigurowanej wysyłki e-maili nikt nie mógł założyć konta bez weryfikacji, aby nie powtórzyć W1.

- Given produkcja, brak `SMTP_HOST/USER/PASS`, When użytkownik otwiera ekran rejestracji, Then przycisk "Zarejestruj się przez e-mail" jest nieaktywny, a pod nim widać komunikat: "Rejestracja e-mailem jest chwilowo niedostępna. Skorzystaj z Google albo spróbuj później." (treść do dopracowania przez `ux`).
- Given ta sama sytuacja i skonfigurowany Google, When użytkownik wybiera "Zarejestruj się przez Google", Then rejestracja przechodzi normalnie (kroki OAuth: imię, parametry ciała, aktywność, cel).
- Given produkcja bez SMTP i bez Google/Facebooka, When otwarty jest ekran rejestracji, Then wszystkie metody są nieaktywne, widać komunikat "Rejestracja jest chwilowo niedostępna", a logowanie istniejących kont nadal działa.
- Given ktoś wywołuje `sendRegisterCode` lub `registerUser` bezpośrednio (poza UI), When serwer nie ma SMTP na produkcji, Then odpowiedź jest odmową (nie "ok") i nic nie jest zapisane w bazie; kod `1234` nigdy nie tworzy konta.
- Given przycisk Google jest dziś pokazywany jako nieaktywny z podpisem "będą dostępne po konfiguracji", When SMTP jest wyłączone, Then podpis nie sugeruje już, że "e-mail działa od razu".
- Given logowanie istniejących kont hasłem, When SMTP nie jest skonfigurowane, Then logowanie działa bez zmian (nie zależy od SMTP).

### US-3 (Must) Tryb testowy kodu tylko poza produkcją
Jako deweloper chcę lokalnie rejestrować konta bez skrzynki pocztowej, aby szybko testować, bez ryzyka przeniesienia tego na produkcję.

- Given `NODE_ENV` to `development` lub `test` i brak SMTP, When rejestruję konto, Then kod `1234` jest przyjmowany, a formularz jasno oznacza tryb testowy (np. etykieta "Tryb testowy: kod 1234", widoczna tylko w tym trybie).
- Given `NODE_ENV=production` (także Preview i testy end-to-end uruchamiane na buildzie produkcyjnym), When SMTP brak, Then tryb testowy jest nieaktywny. Testy e2e rejestracji muszą wtedy używać wstrzykniętego transportu lub trybu dev (do ustalenia przez `architekt`/`tester`).
- Given zmienna `MOCK_REGISTER_EMAIL_CODE=1` ustawiona na produkcji, When ktoś rejestruje się kodem `1234`, Then rejestracja jest odrzucona (zmienna jest ignorowana lub usunięta z kodu).
- Given konto utworzone w trybie testowym, Then ma status "e-mail niezweryfikowany" i nigdy nie otrzymuje roli admina po e-mailu (US-6).
- Given lokalnie jest SMTP, When rejestruję się, Then działa normalna ścieżka (kod losowy), bez `1234`.

### US-4 (Must) Łączenie kont OAuth tylko po zweryfikowanym e-mailu
Jako osoba z istniejącym kontem chcę, aby logowanie Google dołączyło się do mojego konta tylko wtedy, gdy Google potwierdza mój adres, aby nikt obcy nie wszedł na moje konto.

Reguły (BR-4 do BR-8) w kryteriach:
- Given istnieje konto e-mail/hasło z adresem X, e-mail zweryfikowany kodem, When loguję się przez Google z adresem X i `email_verified === true`, Then OAuth zostaje dowiązane do tego konta, widzę swoje dane (bez duplikatu konta), a w dzienniku aktywności powstaje wpis "Powiązanie konta OAuth".
- Given ta sama sytuacja, When Google zwraca `email_verified` fałszywe lub brak pola, Then logowanie jest odrzucone, nic nie jest dowiązane, a użytkownik widzi: "Nie udało się potwierdzić Twojego adresu e-mail u Google. Zaloguj się hasłem."
- Given istnieje konto z adresem X, When loguję się przez Facebooka z adresem X, Then OAuth nie jest dowiązywane (Facebook nie potwierdza adresu), logowanie jest odrzucone, a użytkownik widzi: "Konto z tym adresem już istnieje. Zaloguj się hasłem lub przez Google."
- Given nie istnieje konto z adresem X, When loguję się przez Google z potwierdzonym X, Then powstaje nowe konto z e-mailem oznaczonym jako zweryfikowany, a użytkownik przechodzi kroki dokończenia rejestracji.
- Given nie istnieje konto z adresem X, When loguję się przez Facebooka z adresem X, Then powstaje konto z e-mailem niezweryfikowanym (Z4); nie otrzymuje roli admina, a jego późniejsze przejęcie opisuje BR-7.
- Given Facebook nie zwrócił adresu e-mail, Then rejestracja/logowanie jest odrzucone z komunikatem, że potrzebny jest adres e-mail (zachowanie zbliżone do dzisiejszego).
- Given powiązanie (provider + providerAccountId) już należy do konta A, When ten sam wpis pojawia się z adresem należącym do konta B, Then powiązanie nie jest przenoszone na B (dziś `ensureOauthLink` je przenosi). Użytkownik zalogowany przez to powiązanie trafia na konto A. Przenoszenie powiązań pomiędzy kontami jest zakazane (BR-8).
- Brzeg: użytkownik zmienił adres e-mail w Google po założeniu konta. Then logowanie nadal działa przez powiązanie (provider + providerAccountId); adres z profilu Google nie nadpisuje adresu konta.
- Brzeg: Google bez skonfigurowanych zmiennych. Then przycisk jest nieaktywny, a konto z hasłem działa jak dotąd.
- Brzeg: dwa urządzenia logują się Google jednocześnie na nowy adres. Then powstaje jedno konto (unikalność e-maila i powiązania), drugie logowanie dochodzi do tego samego konta bez błędu 500.

### US-5 (Must) Przejęcie konta niezweryfikowanego przez prawdziwego właściciela adresu
Jako prawdziwy właściciel adresu, na który ktoś wcześniej założył konto bez weryfikacji, chcę odzyskać ten adres przez Google, aby atakujący nie zatrzymał "mojego" konta.

- Given konto z adresem X ma e-mail niezweryfikowany (utworzone kodem `1234` lub przez Facebooka), When loguję się przez Google z potwierdzonym X, Then konto zostaje przejęte przez mnie: hasło dotychczasowe jest unieważnione, wszystkie wcześniejsze powiązania OAuth tego konta są usunięte, wszystkie wcześniej wydane sesje przestają działać, e-mail dostaje status zweryfikowany, a mój Google zostaje jedynym powiązaniem.
- Given przejęcie się wykonało, Then użytkownik widzi jednorazowy komunikat (nie ujawnia, co konto zawierało): "Ten adres był wcześniej użyty bez potwierdzenia. Zabezpieczyliśmy konto: dotychczasowe hasło i dane konta zostały usunięte." Wpis o zdarzeniu trafia do dziennika zdarzeń bezpieczeństwa (BR-13), bez haseł i bez e-maila.
- Given konto niezweryfikowane zawierało dane (treningi, cardio, plany, waga, pomiary, zdjęcia sylwetki, posiłki, cele, notatki, wpisy społeczności, czat, subskrypcje push, ustawienia), When następuje przejęcie, Then wszystkie te dane są trwale usunięte (nie ukryte) w tej samej operacji co unieważnienie hasła, powiązań i sesji; zostaje wiersz konta z adresem, nowe powiązanie Google i wpis zdarzenia. Nowy właściciel zaczyna od czystego konta (jak pierwsze użycie, kroki dokończenia rejestracji).
- Given operacja przejęcia nie powiodła się w połowie, Then nie następuje stan częściowy: albo konto jest w pełni przejęte i wyczyszczone, albo logowanie jest odrzucone z komunikatem o błędzie, a stare dane nie są udostępnione nowemu właścicielowi.
- Given dwa urządzenia próbują przejęcia jednocześnie, Then przejęcie wykona się raz, a drugie logowanie dochodzi do już czystego konta tego samego właściciela.
- Brzeg: osoba, która sama zarejestrowała się kodem `1234` na swój prawdziwy adres i później loguje się przez Google (zapomniała hasła). Then traci dane konta (nie da się odróżnić jej od atakującego); wchodzi na czyste konto przez Google. Skutek akceptowalny przy małej liczbie kont (Z7); wariant odroczonego usunięcia po 30 dni odrzucony rekomendacją prawną.

### US-6 (Must) Rola admina tylko dla zweryfikowanego e-maila
Jako właściciel chcę, aby panel administratora i dane zdrowotne wszystkich użytkowników były dostępne tylko dla mnie, aby nikt nie dostał roli admina, rejestrując cudzy adres.

- Given adres jest na liście administratorów (konfiguracja `ADMIN_EMAILS`) i konto ma e-mail zweryfikowany, When się loguję (hasłem lub OAuth), Then dostaję rolę admina.
- Given adres jest na liście, ale konto ma e-mail niezweryfikowany (np. utworzone w trybie testowym albo przez Facebooka), When się loguję, Then nie dostaję roli admina ani nie ma zapisu `appRole = admin`; rola `zawodnik` bez komunikatu o powodzie widocznego dla użytkownika (powód w dzienniku zdarzeń bezpieczeństwa).
- Given adres jest na liście, a konto jeszcze nie istnieje, When ktoś rejestruje je kodem `1234`, Then rejestracja jest niemożliwa na produkcji (US-2), a poza produkcją konto powstaje bez admina.
- Given `ADMIN_EMAILS` jest puste, Then nikt nie dostaje roli admina z konfiguracji; zadanie usuwa stałe `PRIMARY_ADMIN_EMAIL` z kodu (publiczne repo, ujawnia cel, N7), a jedyna ścieżka nadania roli to `ADMIN_EMAILS` lub edycja w panelu przez istniejącego admina.
- Given już istniejące konto z `appRole = admin` w bazie, When wdrożenie się kończy, Then rola zostaje (ciągłość pracy właściciela), ale lista kont z rolą admina jest sprawdzona przed wdrożeniem (sekcja 6).
- Brzeg: usunięcie adresu z `ADMIN_EMAILS`. Then rola zapisana w bazie nie jest automatycznie cofana (zachowanie dzisiejsze); cofanie to edycja w panelu. Zapisane jako uwaga, nie zmiana.

### US-7 (Must) Widoczność w panelu administratora
Jako administrator chcę widzieć w panelu, że rejestracja e-mailem nie działa, aby ją naprawić.

- Given produkcja bez SMTP, When wchodzę do panelu, Then w banerze konfiguracji widzę, że wysyłka e-mail (SMTP) wymaga konfiguracji, a w Konfiguracji pozycja "Wysyłka e-mail (SMTP)" ma stan "brak" i opis skutku: "Rejestracja e-mailem jest wyłączona; konta można zakładać tylko przez Google/Facebook (jeśli skonfigurowane)."
- Given brak SMTP oraz brak Google i Facebooka, When wchodzę do panelu, Then widzę wyróżnione ostrzeżenie "Nikt nie może założyć konta" (osobne od zwykłego braku opcjonalnych integracji).
- Given brak SMTP, Then pozycja pozostaje na poziomie "zalecane" lub jest podniesiona do "wymagane" na produkcji (Założenie: podniesiona do "wymagane", bo bez niej produkt nie ma pełnej rejestracji; do potwierdzenia przez `architekt`, wpływa na licznik `requiredIssues`).
- Given wartości zmiennych, Then panel dalej pokazuje tylko obecność, nigdy wartość (zachowane).
- Given funkcja zależna od zmiennych, Then `env.example` opisuje SMTP jako wymagane do rejestracji e-mailem (obecnie opisuje jako opcjonalne) i nie zawiera `MOCK_REGISTER_EMAIL_CODE`.

### US-8 (Should) Jasna informacja na ekranie logowania
Jako osoba, która próbuje się zalogować przez OAuth z odmową, chcę zrozumiały komunikat, aby wiedzieć, co zrobić dalej.

- Given logowanie OAuth zostało odrzucone z powodu niezweryfikowanego e-maila lub kolizji adresu, When wracam na `/login`, Then widzę dedykowany komunikat (nie ogólny błąd), zgodny z US-4.
- Given błąd OAuth, Then komunikat nie zdradza, czy konto o takim adresie istnieje, poza przypadkiem Facebooka z kolizją (US-4), gdzie komunikat jest świadomym wyjątkiem (enumeracja i tak istnieje w rejestracji, N5).

### US-9 (Should) Ślad zdarzeń bezpieczeństwa
Jako administrator chcę mieć w dzienniku ślad przejęć niezweryfikowanych kont i odrzuconych prób nadania roli, aby wykryć nadużycia.

- Given zdarzenia z US-1 (rejestracja), US-4 (łączenie OAuth, odrzucenia), US-5 (przejęcie), US-6 (nadanie lub odmowa roli admina), When występują, Then trafiają do dziennika zdarzeń bezpieczeństwa (BR-13) z typem, identyfikatorem konta, czasem i kodem powodu, bez e-maila, haseł, kodów i danych zdrowotnych, i bez wysyłania ich do Sentry/PostHog.
- Given wpis zdarzenia ma mniej niż 180 dni, When działa czyszczenie danych, Then wpis nie jest usuwany; starsze mogą być.
- Given administrator przegląda dziennik, Then widzi tylko pola z BR-13 (dostęp admina do danych użytkowników pozostaje logowany, LR-28).

### US-10 (Could) Zmiana polityki dla Facebooka
Jako właściciel chcę mieć możliwość wyłączenia Facebooka, jeśli jego brak weryfikacji adresu uznam za zbyt ryzykowny. Poza kodem to decyzja konfiguracyjna (nie ustawiamy `AUTH_FACEBOOK_*`); wymaga tylko, by UI bez Facebooka działało poprawnie (już działa).

## 5. Reguły biznesowe
- BR-1. Konto z hasłem powstaje tylko po wpisaniu poprawnego, nieużytego, niewygasłego kodu wysłanego na ten adres. Kod: 6 cyfr, ważność 10 minut, maks. 5 prób, odstęp wysyłki 60 s, limity IP i e-mail (bez zmian względem dzisiejszych wartości). Retencja kodów (LR-20): w bazie tylko skrót kodu; rekord kodu jest usuwany od razu po poprawnym użyciu, a niewykorzystane i wygasłe najpóźniej po 24 h (dziś 14 dni w `lib/db-retention.ts`), z czyszczeniem uruchamianym co najmniej raz na dobę. Kod i adres nie trafiają do logów, Sentry ani PostHog. E-mail zawiera tylko kod, nazwę administratora i "jeśli to nie Ty, zignoruj" (LR-19).
- BR-2. Stały kod `1234` nie istnieje na produkcji (`NODE_ENV=production`, w tym Preview) w żadnej konfiguracji. Istnieje wyłącznie w rozwoju i testach, tylko przy braku SMTP, z widoczną etykietą trybu testowego.
- BR-3. Bez SMTP na produkcji rejestracja e-mailem jest niedostępna i odmowa jest egzekwowana po stronie serwera, nie tylko w interfejsie. Logowanie istniejących kont hasłem i OAuth działa.
- BR-4. OAuth można dowiązać do istniejącego konta po adresie e-mail tylko wtedy, gdy dostawca potwierdza ten adres (Google: `email_verified === true`). Brak pola `email_verified` = niepotwierdzone. Facebook nigdy nie potwierdza adresu.
- BR-5. Dowiązanie OAuth do istniejącego konta wymaga także, aby e-mail tego konta był zweryfikowany. Konto z niezweryfikowanym e-mailem jest obsługiwane wyłącznie przez BR-7.
- BR-6. Konto ma stan "e-mail zweryfikowany" (tak/nie). Tak: rejestracja z prawdziwym kodem albo konto założone przez Google z `email_verified`. Nie: konta z trybu testowego `1234`, konta z Facebooka, wszystkie konta założone przed wdrożeniem tej zmiany, dopóki nie zostaną potwierdzone (sekcja 6).
- BR-7. Zweryfikowany właściciel adresu (Google, `email_verified`) może przejąć konto niezweryfikowane z tym adresem. Przejęcie, w jednej niepodzielnej operacji: unieważnia hasło, usuwa wszystkie inne powiązania OAuth, unieważnia sesje wydane wcześniej, trwale usuwa wszystkie dane użytkownika powiązane z kontem (ciało i zdrowie, zdjęcia, posiłki, treningi, cardio, plany, społeczność, czat, push, ustawienia; LR-23) i oznacza e-mail jako zweryfikowany. Nowy właściciel nigdy nie otrzymuje wcześniejszych danych. Przejęcie jest zapisane w dzienniku zdarzeń bezpieczeństwa (BR-13) i ręcznie w rejestrze incydentów przez właściciela.
- BR-8. Powiązanie (provider + providerAccountId) należy do jednego konta i nie jest nigdy przenoszone automatycznie na inne konto.
- BR-9. Rola admina z konfiguracji (`ADMIN_EMAILS`) jest nadawana tylko kontu z zweryfikowanym e-mailem. W kodzie nie ma na stałe wpisanego adresu administratora. Rola zapisana już w bazie zostaje do ręcznej zmiany w panelu.
- BR-10. Dane z rejestracji i OAuth nie trafiają do logów aplikacji, Sentry ani PostHog (e-mail, kod, hasło). W dzienniku zdarzeń bezpieczeństwa (BR-13) zapisujemy zdarzenie i identyfikator konta, bez e-maila, wartości kodu i hasła.
- BR-11. Wymagane środowisko: brak `SMTP_*` na produkcji jest w panelu Konfiguracja widoczny i opisuje skutek (US-7). `env.example` jest zgodne z kodem (AGENTS.md, Z8).
- BR-12. Minimalny wiek (16 lat, D18) i zgody w rejestracji są poza zakresem tego zadania; kryterium wieku w formularzu (dziś 13) jest śledzone osobno, a nowe teksty nie powtarzają "13 lat" (LR-30). Zadanie nie dodaje nowych kategorii danych ani zgód.
- BR-13. Dziennik zdarzeń bezpieczeństwa: zdarzenia rejestracji, przejęcia konta (BR-7), powiązania OAuth (udane i odrzucone), odrzuconego nadania roli admina i nadania roli admina są zapisywane z minimum: typ zdarzenia, identyfikator konta, czas, powód jako kod. Bez e-maila, kodu, hasła i danych zdrowotnych. Retencja co najmniej 180 dni (LR-26). Stan istniejących mechanizmów: `admin_audit_log` (`lib/admin-audit.ts`, retencja 180 dni w `lib/db-retention.ts`) istnieje i jest rozszerzalnym kandydatem; `site_activity_log` ma 45 dni, co jest za krótkie. Wybór tabeli i zmiany retencji należą do `architekt`; migracja nie może kasować istniejących wpisów (LR-27).
- BR-14. Zależność wydania: Promote na produkcję dopiero po ocenie incydentu przez właściciela (LR-27): wpis w rejestrze incydentów, zabezpieczenie dowodów przed cronem `/api/cron/cleanup`, kontrola kont admina i rejestracji kodem `1234`, zapisana decyzja (zgłoszenie UODO / zawiadomienie osób tak lub nie). Wstrzymuje wydanie, nie implementację. Dodatkowo przed Promote: zatwierdzony przez prawnika-człowieka tekst polityki prywatności (LR-25) i adresy polityki w konsolach Google/Meta; po podłączeniu SMTP: DPA, SPF/DKIM/DMARC (LR-22).

## 6. Konta już założone kodem 1234 i stan istniejących danych

Fakty: na produkcji brak SMTP od początku (D3), więc każde konto e-mail/hasło na produkcji mogło powstać kodem `1234`. W bazie nie ma flagi weryfikacji; ślad zostaje tylko w `site_activity_log.metaJson` (`emailCodeMock: true`), o ile wpisy nie zostały usunięte przez sprzątanie danych (`api/cron/cleanup`). Konta Google są zweryfikowane w momencie zakładania; konta Facebook nie.

Proponowane działania (do zatwierdzenia przez właściciela, decyzja DW-1):

0. Ocena incydentu (BR-14, LR-27), przed Promote: wpis w rejestrze incydentów, zabezpieczenie dowodów (eksport `site_activity_log`, `admin_audit_log`, `users`, `oauth_accounts`, kodów albo wstrzymanie crona `/api/cron/cleanup`, który kasuje `site_activity_log` po 45 dniach), kontrole z sekcji 4.2 dokumentu prawnika i zapisana decyzja. Kod zadania nie może kasować tych dowodów.
1. Przegląd (właściciel, zanim kod wejdzie na produkcję): w panelu lub przez zapytanie do bazy wylistować wszystkie konta z rolą admin i sprawdzić, czy każde należy do właściciela; sprawdzić też `admin_audit_log` pod kątem działań, których właściciel nie wykonał, i czy pamięta własne ostatnie logowania. Adres z kodu (`PRIMARY_ADMIN_EMAIL`) to ten sam adres co w dokumentacji repozytorium: jeśli konto na ten adres założył ktoś inny kodem `1234`, ma pełny dostęp do danych użytkowników. To ma priorytet nad wszystkim innym.
2. Oznaczenie wszystkich istniejących kont e-mail/hasło jako "niezweryfikowane" (BR-6) przy wdrożeniu; konta z Google jako zweryfikowane.
3. Skutek dla użytkownika: nie wylogowujemy nikogo przy wdrożeniu (brak powodu), nie blokujemy logowania hasłem. Skutki: takie konto nie może być łączone z OAuth po e-mailu inaczej niż przez BR-7, nie dostaje roli admina z konfiguracji.
4. Gdy SMTP zacznie działać (D22): dla kont niezweryfikowanych pokazać po zalogowaniu baner "Potwierdź adres e-mail" z wysłaniem kodu; po potwierdzeniu stan zmienia się na zweryfikowany. To osobne zadanie po SMTP (Should/Could); nie blokuje tego.
5. Rekomendacja dotycząca kont z podejrzaną rejestracją (np. nieistniejący adres, brak aktywności): pozostawić; usuwanie kont wymaga oceny `prawnik` (D8 dotyczy usuwania na żądanie) i nie jest częścią tego zadania.

DW-2 (ZAMKNIĘTE rekomendacją prawną, LR-23): po przejęciu konta według BR-7 dane niezweryfikowanego użytkownika są trwale usuwane, a nowy właściciel dostaje czyste konto. Powód: nie da się odróżnić właściciela adresu, który zapomniał hasła, od obcej osoby; udostępnienie danych art. 9 nieznanej osobie jest niedopuszczalne. Do potwierdzenia przez prawnika-człowieka i właściciela (prawnik pyta w pkt 6 pytań otwartych, czy właściciel akceptuje utratę danych, czy preferuje wariant odroczony 30 dni; analityk go nie rekomenduje).

## 7. Wymagania niefunkcjonalne
- Telefon/PWA/Android: rejestracja i logowanie działają w WebView aplikacji Android i PWA; komunikaty błędów czytelne w jednej kolumnie, pola kodu z `inputMode=numeric` i `autocomplete=one-time-code` (zachowane). Brak zmian w mostku `window.GymBratAndroid`; flow OAuth w WebView bez zmian (`ensureTopLevelForOauth`).
- Offline: rejestracja i logowanie wymagają sieci; to samo zachowanie co dziś, z komunikatem błędu i zachowaniem wpisanych danych.
- Szybkość: wysłanie kodu odpowiada w kilka sekund; bcrypt i limity nie ulegają pogorszeniu. Wpływ na Turso minimalny (jedno pole i zapisy w dzienniku przy zdarzeniach bezpieczeństwa).
- Dostępność: komunikat o wyłączonej rejestracji dostępny dla czytników (rola/`aria-live`), przyciski nieaktywne mają wyjaśnienie tekstowe, nie tylko kolor.
- Bezpieczeństwo: ASVS V2 (weryfikacja tożsamości adresu), V3 (unieważnienie sesji), V4 (rola admina). Sesje są JWT (30 dni), więc BR-7 wymaga mechanizmu unieważnienia (np. wersja sesji) - decyzja `architekt`.
- Koszty: SMTP dedykowanej skrzynki (D22) ma limity dzienne dostawcy; limity IP/e-mail na wysyłkę kodu ograniczają zużycie. Brak wpływu na limity Upstash ponad dzisiejsze.
- Prywatność: zbieramy tylko e-mail i imię z OAuth jak dotąd; dodajemy jedynie flagę/datę weryfikacji e-maila. Do `prawnik`: czy zmiana wymaga aktualizacji polityki prywatności (nie dotyczy nowych kategorii danych; dotyczy opisu zabezpieczeń).

## 8. Priorytety MoSCoW i zależności
| Priorytet | Pozycje |
|---|---|
| Must | US-1, US-2, US-3, US-4, US-5, US-6, US-7 |
| Should | US-8, US-9, baner potwierdzenia adresu po wprowadzeniu SMTP (sekcja 6 pkt 4) |
| Could | US-10 (wycofanie Facebooka), czyszczenie kont niezweryfikowanych |
| Won't (w tym zadaniu) | reset hasła, zmiana adresu e-mail, N5 (enumeracja), usunięcie roli trener (D7), wiek 16 (D18) |

Zależności:
- Bramka wydania (BR-14): Promote na produkcję dopiero po ocenie incydentu przez właściciela (LR-27) i zatwierdzeniu polityki prywatności (LR-25); implementacja i Preview mogą iść wcześniej.
- Dziennik zdarzeń bezpieczeństwa (BR-13) jest zależnością US-4, US-5, US-6; `admin_audit_log` jest istniejącym mechanizmem do oceny przez `architekt`.
- Kolejność wdrożenia: najpierw przegląd adminów (sekcja 6 pkt 1) i ustawienie `ADMIN_EMAILS` na Render, potem wdrożenie kodu; inaczej właściciel może stracić dostęp do panelu, jeśli jego rola w bazie nie jest zapisana.
- Konfiguracja: Google OAuth na Render musi być ustawione, jeśli ktokolwiek ma się rejestrować przed uruchomieniem SMTP. Inaczej produkcja jest zamknięta dla nowych użytkowników.
- Java backend: brak wpływu (uwierzytelnianie w Next; Java dostaje `X-GymBrat-User-Id` po stronie Next). Do potwierdzenia przez `architekt`, że unieważnienie sesji nie wpływa na proxy.
- Android: WebView ładuje produkcję, więc zmiany widoczne od razu; kontrakty `/api/android/*` bez zmian. Użytkownicy zalogowani w aplikacji zachowują sesję, chyba że konto zostało przejęte (BR-7).
- Schemat bazy: potrzebny znacznik weryfikacji e-maila i mechanizm unieważnienia sesji - zakres i migracja decyduje `architekt` (Turso: migracja przez `db:generate`/`db:migrate`; konta istniejące mają dostać wartość "niezweryfikowane").
- Wpis w `components/changelog/changelog-data.ts` (`planned: true`) oraz `npm run deploy:check` przed merge (karta zadania).

## 9. Pytania otwarte do właściciela (blokujące)
1. DW-1 (blokuje start wdrożenia, nie projekt): czy konto na adres z `PRIMARY_ADMIN_EMAIL` zostało założone przez Ciebie, i czy w produkcyjnej bazie są konta z rolą admin należące do kogoś innego? Potrzebne: lista kont z rolą admin z panelu (`/admin/users`). Jeśli nie masz pewności, traktujemy konto jako przejęte i zakładamy je od nowa po wdrożeniu BR-7/BR-9.
2. DW-3: czy przed wdrożeniem ustawisz `ADMIN_EMAILS` na Render na swój adres? Po usunięciu stałego adresu z kodu (BR-9) tylko ta zmienna i rola w bazie dają Ci panel. (Rekomendacja: tak.)
3. DW-4: czy Google OAuth jest skonfigurowany na produkcji (`AUTH_GOOGLE_ID/SECRET`)? Jeśli nie, od wdrożenia nowi użytkownicy nie założą konta do czasu SMTP. Czy to akceptujesz, czy ma pierwszeństwo szybkie uruchomienie SMTP (D22)?

Pytania niższej wagi z przyjętym założeniem (nie blokują): DW-2 zamknięte (dane po przejęciu usuwane, sekcja 6; potwierdzenie przez prawnika-człowieka i właściciela), Facebook zostaje, ale z niezweryfikowanym e-mailem (Z4/US-10), tryb testowy zawsze dozwolony w dev/test (Z2).

## 10. Ryzyka
| # | Ryzyko | Skutek | Mitigacja |
|---|---|---|---|
| R1 | Konto na adres admina założone już wcześniej przez obcego | Wgląd w dane zdrowotne wszystkich | DW-1 przed wdrożeniem; BR-7, BR-9 |
| R2 | Usunięcie stałego admina bez ustawienia `ADMIN_EMAILS` | Brak dostępu do panelu | Kolejność wdrożenia (sekcja 8), DW-3 |
| R3 | Produkcja bez Google i bez SMTP | Nikt nie może się zarejestrować | Baner w panelu (US-7), DW-4 |
| R4 | Przejęcie BR-7 dotyka prawdziwego użytkownika, który zapomniał hasła (brak resetu do SMTP) | Utrata dostępu hasłem i trwała utrata danych konta | Akceptowalne dla małej liczby kont (Z7); komunikat dla użytkownika; reset hasła po SMTP |
| R11 | Utrata dowodów incydentu przez cron sprzątania (45 dni) | Brak możliwości oceny naruszenia | BR-14, sekcja 6 pkt 0 |
| R12 | Wydanie przed oceną incydentu lub bez zatwierdzonej polityki | Naruszenie wymogów art. 33/13 RODO | Bramka wydania BR-14 |
| R5 | Sesje JWT 30 dni nie dają się unieważnić dzisiejszym mechanizmem | Atakujący zachowuje dostęp po przejęciu | Wymóg unieważnienia sesji w BR-7 (projekt `architekt`) |
| R6 | Testy e2e/CI na buildzie produkcyjnym polegały na `1234` | Wywrócone testy rejestracji | Ustalić z `tester`/`architekt` transport testowy; nie osłabiać BR-2 |
| R7 | Brak weryfikacji adresu w Facebooku | Konta Facebook z cudzym adresem | Niezweryfikowane, bez admina, przejmowalne przez właściciela (BR-6, BR-7) |
| R8 | Zmiana wymusza komunikację z użytkownikami | Wymogi informacyjne (prywatność) | Ocena `prawnik` w etapie 2 |
| R9 | Zmiana wartości `NODE_ENV` na hostingu (np. Preview z NODE_ENV=development) | Przypadkowe włączenie trybu testowego | Dodatkowy warunek środowiskowy w projekcie; test regresji |
| R10 | Kody w historii publicznego repo (D6) ujawniają przez lata znany kod `1234` i stały adres admina | Wiedza atakującego | Nie do cofnięcia; zmniejsza wartość tajności, więc zabezpieczenia muszą być po stronie logiki |

## 11. Do przekazania dalej
- `prawnik` (etap 2, wykonany): wnioski wprowadzone w tej rewizji. Pozostaje potwierdzenie przez prawnika-człowieka: usuwanie danych przy przejęciu, retencje 24 h i 180 dni, polityka prywatności (LR-25).
- `architekt` (etap 3): niepodzielne usunięcie danych konta przy przejęciu (BR-7) i lista powiązanych tabel, retencja kodów 24 h i usuwanie po użyciu, wybór tabeli dziennika BR-13 (czy rozszerzyć `admin_audit_log`) i retencja 180 dni, model weryfikacji e-maila, unieważnianie sesji, warunek środowiskowy trybu testowego, ponowne użycie istniejących funkcji (`resolveGoogleSignInUser`, `ensureOauthLink`), usunięcie `PRIMARY_ADMIN_EMAIL` z kodu, zmiana `lib/admin-config-status.ts` i `env.example`, wpływ na Java i e2e.
- `ux` (etap 4): ekran rejestracji bez SMTP, komunikaty błędów OAuth, baner w panelu, etykieta trybu testowego.
