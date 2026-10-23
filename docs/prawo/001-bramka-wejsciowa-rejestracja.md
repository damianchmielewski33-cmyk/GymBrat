# 001 - Bramka wejściowa (prawnik): rejestracja, weryfikacja e-maila, łączenie kont OAuth, rola admina

- Wersja: 0.1 (projekt roboczy), data: 2026-10-23. Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`.
- Wejście: `docs/analiza/001-rejestracja-kod-i-oauth.md`, `docs/zespol/decyzje-wlasciciela.md` (D3, D4, D6, D17, D18, D22), `docs/prawo/00-inwentaryzacja-danych.md`, `docs/prawo/01-podstawy-prawne-i-retencja.md` (LR-1 do LR-18).
- **Status: analiza robocza asystenta AI. Nie jest poradą prawną. Przed publikacją tekstów dla użytkowników, przed decyzją o zgłoszeniu do UODO i przed ewentualnym kasowaniem danych musi ją zatwierdzić prawnik-człowiek.**
- Weryfikacja stanu prawnego: w tym przebiegu NIE sprawdzano RODO, wytycznych EROD 9/2022 o naruszeniach, ustawy o ochronie danych osobowych, PKE ani ustawy o świadczeniu usług drogą elektroniczną w EUR-Lex/ISAP/UODO. Numery przepisów pochodzą z wiedzy asystenta. Data weryfikacji: [do uzupełnienia przez prawnika-człowieka].

## 1. Werdykt bramki wejściowej

**ZATWIERDZONE Z UWAGAMI.** Zadanie jest dopuszczalne i prawnie pożądane: usuwa lukę w zabezpieczeniach (art. 32 RODO) i ogranicza ryzyko niezgodnego z prawem dostępu do danych o zdrowiu. Warunki:

1. Zmiana w wymaganiach analityka: dane przy przejęciu konta (BR-7, US-5, DW-2), patrz sekcja 3. Bez tego wdrożenie samo spowodowałoby ujawnienie cudzych danych zdrowotnych.
2. Przed Promote na produkcję: właściciel wykonuje ocenę incydentu z sekcji 4 (rejestr, zabezpieczenie dowodów, sprawdzenie kont admina). To nie wstrzymuje implementacji, wstrzymuje wydanie.
3. Zadanie nie rozszerza zakresu na zgody art. 9, wiek 16+, retencję 24/12 mies. (osobne zadania z backlogu). Nowy tekst w formularzu nie może powtarzać "13 lat" (D18).

Brak potrzeby nowej zgody: weryfikacja e-maila i logowanie OAuth opierają się na umowie (art. 6 ust. 1 lit. b), a zabezpieczenia i dziennik zdarzeń na uzasadnionym interesie (lit. f). Brak nowych kategorii danych poza znacznikiem "e-mail zweryfikowany" i datą. DPIA osobna dla zadania nie jest potrzebna; zadanie wchodzi do DPIA produktu (LR-3) jako środek bezpieczeństwa.

## 2. Przetwarzanie e-maila i kodu weryfikacyjnego

| Operacja | Dane | Podstawa | Retencja | Uwagi |
|---|---|---|---|---|
| Wysłanie kodu na podany adres | e-mail, hash kodu, liczniki prób, czas, IP do limitów | art. 6 ust. 1 lit. b (działania na żądanie osoby przed zawarciem umowy) oraz lit. f (weryfikacja, że osoba kontroluje adres) | kod ważny 10 min; wiersz usuwany po użyciu; niewykorzystane i wygasłe najpóźniej po 24 h (dziś 14 dni w `lib/db-retention.ts`, do skrócenia) | adres może należeć do osoby trzeciej, która o nic nie prosiła: minimalizacja i szybkie kasowanie są kluczowe |
| Treść wiadomości | kod, nazwa administratora | j.w. | zależna od dostawcy SMTP | tylko kod i krótka informacja; bez danych zdrowotnych i bez treści marketingowych |
| Znacznik "e-mail zweryfikowany" i data | flaga, czas | lit. b / lit. f | jak konto | element bezpieczeństwa konta |
| Dziennik zdarzeń bezpieczeństwa (przejęcie, odmowa roli admina, powiązanie OAuth) | typ zdarzenia, id konta, czas | lit. f (art. 32, rozliczalność) | patrz LR-26 | bez e-maila, kodu, hasła, danych zdrowotnych |

Wiadomości z kodem wysyłane na cudzy adres przy próbie nadużycia nie są komunikacją handlową (PKE art. 172, 174 [weryfikacja]), pod warunkiem że zawierają wyłącznie kod i informację "jeśli to nie Ty, zignoruj", a wysyłka jest limitowana (limity IP, e-mail, 60 s).

## 3. Przejęcie niezweryfikowanego konta (BR-7, US-5) i dane w tym koncie

### 3.1 Czyje to dane
Dowód kontroli nad adresem e-mail (Google `email_verified`) nie dowodzi, że ta osoba jest osobą, której dotyczą dane w koncie. Konto niezweryfikowane mogły założyć:
- (A) prawdziwy właściciel adresu kodem 1234 na własny adres (zapomniał hasła lub nie zna go),
- (B) inna osoba na cudzy adres (atak, żart, literówka). Dane wpisane do konta (waga, obwody, zdjęcia sylwetki, posiłki, cele, notatki, kontuzje) dotyczą wtedy założyciela, nie właściciela adresu.

Administrator nie potrafi odróżnić (A) od (B). Dane o ciele i zdrowiu to dane art. 9 RODO. Udostępnienie ich osobie, której nie dotyczą, to ujawnienie danych szczególnej kategorii bez podstawy (naruszenie poufności, art. 5 ust. 1 lit. f, możliwe naruszenie ochrony danych).

### 3.2 Wniosek
1. Osoba, która zna hasło, jest już uwierzytelniona dotychczasową drogą (logowanie hasłem) i wszystko widzi. Przejęcie dotyczy więc tylko tego, kto hasła nie zna: albo prawdziwego właściciela adresu (A, zapomniane hasło), albo kogoś niezwiązanego z danymi (B). Tego nie da się rozstrzygnąć.
2. **Rekomendacja prawna: przy przejęciu (BR-7) nowy właściciel NIE otrzymuje dostępu do wcześniejszych danych użytkownika.** Dane o ciele i zdrowiu, zdjęcia, posiłki, treningi, cardio, plany, wpisy społeczności, czat, subskrypcje push i ustawienia powiązane z kontem są trwale usuwane w momencie przejęcia (nie tylko ukryte). Zostaje wiersz konta z adresem, nowe powiązanie Google i wpis zdarzenia (bez danych). Uzasadnienie: minimalizacja i integralność (art. 5 ust. 1 lit. c, f; art. 32), brak podstawy art. 9 ust. 2 lit. a wobec nieznanej osoby, brak jakiejkolwiek prośby o zachowanie ze strony założyciela.
3. Skutek dla przypadku (A): utrata danych osoby, która zapomniała hasła. Ryzyko niskie przy małej liczbie kont (Z7), ograniczane komunikatem i tym, że do czasu SMTP nie ma resetu hasła. Alternatywa łagodniejsza (do wyboru przez właściciela po konsultacji z prawnikiem): odroczone usunięcie po 30 dniach, w tym czasie dane są niedostępne dla kogokolwiek, a przywrócić je można tylko poprawnym logowaniem starym hasłem. Wymaga więcej kodu, a przechowywanie danych nieznanej osoby przez 30 dni jest słabo uzasadnione; nie rekomenduję.
4. Poinformowanie: nowy właściciel dostaje komunikat bez ujawniania, co konto zawierało ("Ten adres był wcześniej użyty bez potwierdzenia. Zabezpieczyliśmy konto, dotychczasowe hasło i dane konta zostały usunięte."). Poprzedni założyciel nie ma kanału kontaktu (jedyny adres należy do przejmującego), więc brak indywidualnej informacji art. 14 jest dopuszczalny jako niemożliwy do wykonania (art. 14 ust. 5 lit. b) [weryfikacja]; ogólną informację zapewnia polityka prywatności (LR-25).
5. Zdarzenie przejęcia jest wpisem do rejestru incydentów (art. 33 ust. 5), bo oznacza, że ktoś użył adresu bez uprawnienia.
6. Facebook (adres niezweryfikowany): konto z Facebooka nie przejmuje niczego, tylko tworzy nowe lub jest odrzucane (US-4). Komunikat o istnieniu konta przy kolizji ujawnia tylko fakt istnienia konta powiązanego z adresem podanym przez samego rozmówcę; ryzyko niskie, akceptowalne i zgodne z istniejącą enumeracją (N5), ale udokumentowane.

### 3.3 Oznaczenie istniejących kont jako niezweryfikowane
Dopuszczalne i zgodne z zasadą rzetelności: nie zmienia celów ani kategorii danych, jest środkiem bezpieczeństwa. Nie wymaga zgody ani indywidualnego powiadomienia wszystkich. Wymagane: (a) opis w polityce prywatności (LR-25), (b) po uruchomieniu SMTP baner "Potwierdź adres e-mail" (zadanie Should), (c) brak automatycznego usuwania kont w tym zadaniu. Opcjonalnie (Could, wymaga osobnej oceny): usuwanie kont niezweryfikowanych bez żadnej aktywności po uzgodnionym okresie (propozycja robocza: 90 dni, z ostrzeżeniem, o ile adres jest rzeczywisty) [prawnik-człowiek].

## 4. Ocena incydentu: kod 1234 w publicznym repozytorium na produkcji

### 4.1 Kwalifikacja
Naruszenie ochrony danych (art. 4 pkt 12 RODO) to naruszenie bezpieczeństwa prowadzące do przypadkowego lub bezprawnego zniszczenia, utraty, zmiany, nieuprawnionego ujawnienia lub dostępu do danych. Sama podatność (znany kod, kod w publicznym repo, stały adres admina) jest **uchybieniem art. 32 RODO (odpowiednie środki techniczne), nie jest jeszcze naruszeniem**. Naruszenie zachodzi, gdy ktoś faktycznie jej użył i uzyskał dostęp do danych. Scenariusze:

| # | Scenariusz | Czy naruszenie | Ryzyko |
|---|---|---|---|
| S1 | Ktoś zarejestrował się kodem 1234 na cudzy adres i niczego nie uzyskał (konto puste) | Nie dostęp do cudzych danych; przetwarzanie adresu osoby trzeciej bez podstawy (problem rzetelności, niski skutek) | niskie |
| S2 | Ktoś założył konto na adres osoby X; X później zalogowała się przez Google i konto zostało z nią dowiązane (`allowDangerousEmailAccountLinking`), a założyciel nadal zna hasło i widzi dane, które X wprowadza (waga, zdjęcia) | **Tak: nieuprawniony dostęp do danych art. 9** | wysokie |
| S3 | Ktoś zarejestrował `PRIMARY_ADMIN_EMAIL` (jeśli właściciel go nie użył) i dostał rolę admina | **Tak: dostęp do danych wszystkich użytkowników, w tym art. 9** | wysokie |
| S4 | Obcy dostał rolę admina przez inny adres z `ADMIN_EMAILS` | N/d: `ADMIN_EMAILS` puste (D4), ale stały adres działa | j.w. |

Dane z repozytorium nie dowodzą, czy S2 lub S3 wystąpiły. Nie można więc dziś orzec ani "jest naruszenie", ani "nie ma". Stan: **podejrzenie naruszenia do zbadania**. Zasada 72 h (art. 33 ust. 1) biegnie od stwierdzenia z rozsądnym stopniem pewności, że naruszenie nastąpiło (wytyczne EROD 9/2022 [weryfikacja]), ale zwłoka w badaniu po powzięciu informacji o luce nie jest dopuszczalna. Rekomenduję badanie bez zwłoki i zamknięcie wstępnej oceny w kilka dni, a jeśli któryś scenariusz S2/S3 się potwierdzi, liczyć 72 h od potwierdzenia.

### 4.2 Co właściciel powinien zrobić (kolejność)
1. **Dzisiaj: wpis w rejestrze incydentów** (art. 33 ust. 5): data uzyskania informacji o luce (2026-10-23), opis, status "w ocenie". Wpis jest wymagany niezależnie od wyniku. Jeśli nic się nie stało, rejestr dokumentuje wniosek "naruszenie niepotwierdzone, luka usunięta".
2. **Zabezpieczyć dowody przed sprzątaniem.** Cron `/api/cron/cleanup` kasuje `site_activity_log` po 45 dniach i `admin_audit_log` po 180 dniach; ślad `emailCodeMock: true` ginie. Wstrzymać cron albo wyeksportować obie tabele (i `users`, `oauth_accounts`, `email_verification_codes`) do bezpiecznego, szyfrowanego pliku na czas oceny. Eksport traktować jako dane osobowe i usunąć po zamknięciu sprawy.
3. **Konto admina (S3):** w `users` sprawdzić, czy konto z adresem `PRIMARY_ADMIN_EMAIL` istnieje i kiedy powstało (`createdAt`), czy w dzienniku jest wpis rejestracji z `emailCodeMock: true` dla tego konta, czy właściciel pamięta własną rejestrację i ostatnie logowania. Wylistować wszystkie konta z rolą admin (`/admin/users`). W razie wątpliwości przyjąć, że konto jest przejęte (jak DW-1) i założyć na nowo po wdrożeniu.
4. **Aktywność administracyjna:** przejrzeć `admin_audit_log` (dostęp do `api/admin/users/[id]/detail`, zmiany ról, ustawień) pod kątem działań, których właściciel nie wykonał; sprawdzić logi hostingu Render dla tras `/admin` i `/api/admin/*` z nieznanych adresów IP.
5. **Rejestracje kodem 1234 (S1/S2):** zestawić konta z wpisem `emailCodeMock: true` w dzienniku (tylko w zachowanym oknie 45 dni), a dla starszych: wszystkie konta e-mail/hasło bez powiązania OAuth. Szukać: konta z adresem niewłaściwym dla użytkownika (literówki, adresy osób znanych właścicielowi, domeny firmowe), konta z powiązaniem OAuth utworzonym po rejestracji hasłem (wpis "Powiązanie konta OAuth" po wcześniejszej rejestracji kodem), konta bez aktywności lub o aktywności nietypowej. Dla kont z zebranymi danymi ciała i podejrzanym adresem rozważyć kontakt z właścicielem adresu poprzez adres z konta (ostrożnie: nie ujawniać treści konta).
6. **Decyzja (prawnik-człowiek):** jeśli potwierdzono S2/S3, to naruszenie z prawdopodobnym ryzykiem. Zgłoszenie do UODO w 72 h od potwierdzenia (administrator osobiście, D17) i zawiadomienie osób, których dane widziano, o ile ryzyko wysokie (art. 34), co przy danych o zdrowiu i zdjęciach sylwetki należy zakładać; zawiadomienie prostym językiem: co się stało, jakie dane, jakie skutki, co robić, kontakt. Jeśli potwierdzono tylko S1: zwykle bez zgłoszenia (skutek mało prawdopodobny dla praw osób), ale z wpisem w rejestrze i uzasadnieniem. Brak dowodów po wyczerpaniu źródeł: wpis "nie stwierdzono", uzasadnienie (dostępne logi, ich okres) i środki naprawcze.
7. Po ocenie: dopisać do rejestru środki naprawcze (to zadanie 001, `ADMIN_EMAILS`, DPA SMTP).

Publiczność repozytorium (D6) zwiększa prawdopodobieństwo wykorzystania luki. Nie zmienia to kwalifikacji, a jedynie uzasadnia staranność badania. Czas obecności luki (od pierwszego commita z trybem mock) warto ustalić z `git log` i wpisać do rejestru [do ustalenia].

## 5. Informacje w polityce prywatności dla OAuth i weryfikacji (tekst do przeglądu, szczegóły w LR-25)

Projekt akapitów (do włączenia w politykę przez zadanie dokumentowe, wersja robocza, miejsca do uzupełnienia w nawiasach):

> **Logowanie przez Google lub Facebook.** Jeśli założysz konto lub zalogujesz się przez Google albo Facebook, otrzymujemy od dostawcy [adres e-mail, imię i nazwisko lub nazwę profilu, identyfikator Twojego konta u dostawcy]. Nie otrzymujemy hasła do tego konta ani listy znajomych. Podstawą jest umowa o prowadzenie konta (art. 6 ust. 1 lit. b RODO). Google i Meta są odrębnymi administratorami danych w zakresie własnego uwierzytelniania i przetwarzają dane według własnych zasad, także w USA [mechanizm transferu: do weryfikacji]. Powiązanie możesz zakończyć w ustawieniach konta Google lub Facebook oraz, [po wdrożeniu], w ustawieniach GymBrat.
> **Potwierdzanie adresu e-mail.** Aby chronić Twoje konto, potwierdzamy, że adres e-mail należy do Ciebie: wysyłamy jednorazowy kod, a przy Google korzystamy z potwierdzenia adresu przez Google. Facebook nie potwierdza adresu, więc konto założone przez Facebook ma adres niepotwierdzony. Kod przechowujemy w postaci skrótu do [24 godzin] lub do wpisania. Nie wysyłamy go w celach marketingowych.
> **Konta bez potwierdzonego adresu.** Jeśli ktoś zarejestruje konto na adres, do którego nie ma dostępu, właściciel adresu może przejąć to konto, logując się przez Google. Dotychczasowe hasło i dane takiego konta są wtedy usuwane.
> **Dziennik zdarzeń bezpieczeństwa.** Zapisujemy zdarzenia typu przejęcie konta czy połączenie z Google (typ zdarzenia, numer konta, czas) przez [180 dni] na podstawie uzasadnionego interesu (bezpieczeństwo, art. 6 ust. 1 lit. f).
> **Wysyłka e-maili.** E-maile wysyła dla nas [nazwa dostawcy poczty], który działa jako podmiot przetwarzający na podstawie umowy powierzenia.

Meta wymaga dla aplikacji z Facebook Login adresu polityki prywatności i instrukcji lub adresu usuwania danych [weryfikacja aktualnych wymogów Meta]; Google wymaga polityki prywatności na ekranie zgody OAuth. Te adresy muszą wskazywać na tę samą, aktualną politykę. Wersja robocza polityki jeszcze nie istnieje w `docs/prawo/`; tekst wymaga zatwierdzenia prawnika-człowieka.

## 6. Dedykowany SMTP jako podmiot przetwarzający
1. Dostawca poczty (skrzynka lub usługa transakcyjna) przetwarza adresy e-mail i treść z kodem w imieniu administratora: art. 28 RODO, umowa powierzenia (DPA) podpisywana przez administratora (osobę prywatną, D17). Prywatne konto Gmail nie spełnia tego wymogu i nie jest rekomendowane na produkcji (zgodnie z inwentaryzacją).
2. Zapisać w ewidencji dostawców: nazwa, siedziba, region przetwarzania, mechanizm transferu poza EOG (jeśli dotyczy), okres przechowywania logów dostawcy. Preferencja: dostawca z przetwarzaniem w EOG.
3. Środki bezpieczeństwa (art. 32): SPF, DKIM, DMARC dla domeny nadawcy; hasło SMTP tylko jako zmienna środowiska; połączenie szyfrowane (TLS); skrzynka wyłącznie na potrzeby aplikacji; kopie wysłanych wiadomości skasowane lub ograniczone w czasie.
4. Skrzynka kontaktowa do praw osób (D22) może być ta sama; wskazać w polityce.
5. Zgodnie z AGENTS.md: wpis w `lib/admin-config-status.ts` i opis w `env.example`. Wartości SMTP nie pojawiają się w logach ani w panelu (tylko obecność).

## 7. Reguły LR dla zadania 001

Numeracja kontynuuje LR-1 do LR-18 z `docs/prawo/01-podstawy-prawne-i-retencja.md`. Adresaci: `architekt` (projekt), `ux` (teksty), `backend`/`frontend` (wdrożenie), właściciel (czynności organizacyjne).

- **LR-19 (kod i weryfikacja, cel)**: kod weryfikacyjny służy wyłącznie do potwierdzenia adresu. E-mail zawiera tylko kod, nazwę administratora i informację "jeśli to nie Ty, zignoruj". Zabronione: treści marketingowe i dane zdrowotne w wiadomości. Rejestracja pokazuje komunikat sukcesu dopiero po faktycznej wysyłce.
- **LR-20 (retencja kodów)**: w bazie tylko hash kodu. Po poprawnym użyciu wiersz kodu jest usuwany od razu. Niewykorzystane i wygasłe kody usuwa `lib/db-retention.ts` najpóźniej po 24 h (zamiast 14 dni), cleanup uruchamiany co najmniej raz na dobę; aktualizacja kolumny "kody" w tabeli retencji. Kod ani adres nie trafia do logów, Sentry ani PostHog (LR-5, BR-10).
- **LR-21 (brak trybu testowego na produkcji)**: stały kod i `MOCK_REGISTER_EMAIL_CODE` nie istnieją w żadnej konfiguracji `NODE_ENV=production`; egzekwowanie po stronie serwera (art. 25, 32). Konto powstałe w trybie testowym ma e-mail niezweryfikowany.
- **LR-22 (dostawca SMTP)**: DPA z dostawcą przed pierwszą wysyłką produkcyjną; wpis w ewidencji (region, transfer, retencja logów); SPF, DKIM, DMARC; brak prywatnego Gmaila; wpis w `lib/admin-config-status.ts` i `env.example` oraz w polityce (LR-11, LR-13).
- **LR-23 (przejęcie konta)**: przy przejęciu niezweryfikowanego konta (BR-7) nowy właściciel nie otrzymuje wcześniejszych danych użytkownika. Trwałe usunięcie danych powiązanych z kontem (ciało, zdrowie, zdjęcia, posiłki, treningi, plany, społeczność, czat, push, ustawienia) w tej samej transakcji, w której unieważnia się hasło, powiązania i sesje. Komunikat nie ujawnia, co konto zawierało. Zdarzenie trafia do dziennika (LR-26) i do rejestru incydentów (ręcznie, wg LR-27).
- **LR-24 (istniejące konta)**: wszystkie konta e-mail/hasło sprzed wdrożenia otrzymują stan "niezweryfikowane"; konta Google "zweryfikowane". Brak automatycznego usuwania kont i brak powiadomienia masowego w tym zadaniu; opis w polityce (LR-25); po SMTP baner "Potwierdź adres e-mail". Usuwanie kont niezweryfikowanych tylko po osobnej ocenie prawnika.
- **LR-25 (informacja o OAuth i weryfikacji)**: polityka prywatności (i krótka informacja w ekranie logowania) zawiera akapity z sekcji 5: jakie dane przychodzą z Google/Facebooka, odrębni administratorzy, transfer, brak potwierdzenia adresu przez Facebook, zasada przejęcia konta niezweryfikowanego, dziennik bezpieczeństwa, SMTP jako procesor. Tekst ma zatwierdzić prawnik-człowiek przed Promote; adres polityki wpisany w konsolach Google i Meta (i później Google Play).
- **LR-26 (dziennik zdarzeń bezpieczeństwa)**: zdarzenia przejęcia, odrzuconego nadania roli admina, powiązania OAuth i odrzuconego powiązania zapisywane z minimum: typ, id konta, czas, powód jako kod. Bez e-maila, kodu, hasła, danych zdrowotnych. Retencja co najmniej 180 dni (równo z `admin_audit_log`; domyślne 45 dni `site_activity_log` jest za krótkie dla śladu incydentów), podstawa: uzasadniony interes (bezpieczeństwo). Decyzja o tabeli: `architekt`.
- **LR-27 (incydent i dowody)**: przed Promote właściciel (a) zakłada wpis w rejestrze incydentów, (b) zabezpiecza dane dowodowe przed sprzątaniem (sekcja 4.2 pkt 2), (c) wykonuje kontrole z sekcji 4.2 pkt 3-5, (d) zapisuje wniosek i decyzję (zgłoszenie UODO tak/nie, zawiadomienie osób tak/nie) z uzasadnieniem. Procedura 72 h: LR-18. Wdrożenie kodu nie może kasować dowodów (migracja bez usuwania istniejących wpisów).
- **LR-28 (rola admina)**: rola admina z konfiguracji tylko dla konta o zweryfikowanym e-mailu; brak adresu admina zapisanego w kodzie (dane osobowe właściciela nie powinny być w publicznym repozytorium bez potrzeby); lista kont admin przejrzana przed wdrożeniem (DW-1); dostęp admina do danych użytkowników pozostaje logowany (LR-17).
- **LR-29 (komunikaty)**: komunikaty błędów OAuth i rejestracji nie ujawniają stanu konta poza świadomym wyjątkiem Facebooka (US-4, ryzyko niskie, udokumentowane w sekcji 3.2 pkt 6); komunikat przejęcia zgodny z LR-23; bez słów sugerujących, że "e-mail wysłano", gdy go nie wysłano.
- **LR-30 (granice zadania)**: zadanie nie dodaje nowych kategorii danych ani zgód; nie powtarza progu 13 lat (D18 realizuje osobne zadanie); zgody art. 9 i wiek 16+ pozostają wymogiem przed otwarciem rejestracji szerszej publiczności (backlog #2, #3).

## 8. Wpływ na wymagania (do analityka)

1. **BR-7 / US-5 / DW-2 (zmiana wymagana):** przy przejęciu dane konta są usuwane, a nie "pozostają na koncie". Zmienić kryterium "dane pozostają na koncie" i treść komunikatu (LR-23). DW-2 uznać za rozstrzygnięte rekomendacją prawną (usuwanie), do potwierdzenia przez prawnika-człowieka i właściciela.
2. **Sekcja 6 analizy (konta 1234):** dodać zależność wstępną: ocena incydentu (LR-27) przed Promote, zabezpieczenie dowodów przed cronem; rozszerzyć DW-1 o pytanie, czy właściciel pamięta ostatnie logowania i czy w `admin_audit_log` są obce działania.
3. **BR-1 / retencja kodów:** dodać wymaganie usuwania kodu po użyciu i skrócenie retencji do 24 h (LR-20).
4. **US-9 / BR-10:** dodać retencję dziennika zdarzeń bezpieczeństwa min. 180 dni i brak e-maila w zdarzeniu (LR-26).
5. **Sekcja 7 Prywatność:** odpowiedź na pytanie do `prawnik`: tak, polityka wymaga aktualizacji (LR-25), ale bez nowej zgody.
6. **Nowe wymaganie:** SMTP: DPA, SPF/DKIM/DMARC (LR-22) jako warunek wydania, gdy SMTP zostanie podłączone.
7. Bez zmian: US-1 do US-4, US-6, US-7, US-8, Facebook (Z4) dopuszczalne prawnie.

## 9. Ryzyka (prawdopodobieństwo, skutek, środek)

| Ryzyko | P | S | Środek |
|---|---|---|---|
| Naruszenie ochrony danych (S2/S3) już zaszło, nie wykryte | niepewne | wysokie (art. 9, kary, zawiadomienia) | LR-27, sekcja 4.2 |
| Utrata dowodów przez cron sprzątania | wysokie (45 dni) | wysokie | wstrzymanie cron lub eksport przed Promote |
| Ujawnienie danych zdrowotnych przejmującemu | pewne bez zmiany BR-7 | wysokie | LR-23 |
| Utrata danych prawdziwego użytkownika, który zapomniał hasła | niskie | niskie/średnie | komunikat, brak resetu do SMTP, Z7 |
| Brak DPA ze SMTP | średnie | średnie | LR-22 |
| Polityka prywatności niezgodna z nowym działaniem | wysokie | średnie | LR-25 przed Promote |
| Zwłoka w zgłoszeniu po potwierdzeniu naruszenia | niskie | wysokie | LR-18, LR-27 |

## 10. Pytania otwarte

1. Czy konto na `PRIMARY_ADMIN_EMAIL` założył właściciel i kiedy (DW-1)? Czy w `admin_audit_log` są działania obce?
2. Czy cron `/api/cron/cleanup` działa na produkcji i od kiedy? (jakie okno logów jeszcze istnieje)
3. Ile kont e-mail/hasło istnieje na produkcji i ilu użytkowników je faktycznie używa (skala S1/S2)?
4. Który dostawca SMTP (siedziba, region, DPA)? Czy własna domena z SPF/DKIM/DMARC?
5. Czy aplikacja Facebook jest skonfigurowana i ma adres polityki prywatności oraz instrukcję usuwania danych w konsoli Meta?
6. Czy właściciel akceptuje usuwanie danych przy przejęciu (LR-23) czy preferuje wariant z odroczeniem 30 dni?

## 11. Do zatwierdzenia przez prawnika-człowieka

Cała analiza, w szczególności: kwalifikacja z sekcji 4 (naruszenie vs. podatność), decyzja o zgłoszeniu do UODO i zawiadomieniu osób; zasada usuwania danych przy przejęciu (sekcja 3.2) oraz art. 14 ust. 5 lit. b; podstawa art. 6 ust. 1 lit. b/f dla kodu i dziennika; retencja 24 h/180 dni; teksty polityki z sekcji 5; status SMTP jako procesora i transfer; wymogi Google/Meta dla polityki. Wszystkie przepisy i wytyczne wymagają weryfikacji w oficjalnych źródłach: [data weryfikacji].
