# 01 - Podstawy prawne, retencja, ocena D8 i konsekwencje decyzji właściciela

- Wersja: 0.1 (projekt roboczy), data: 2026-10-23
- Poprzedza: `docs/prawo/00-inwentaryzacja-danych.md`. Wejście: `docs/zespol/decyzje-wlasciciela.md` (D1-D25).
- **Status: projekt roboczy asystenta AI. Nie jest poradą prawną. Przed użyciem w dokumentach dla użytkowników i w kodzie musi go zatwierdzić prawnik-człowiek.**
- Weryfikacja stanu prawnego: z oficjalnych źródeł sprawdzono tylko zasady Google Play dotyczące usuwania konta (support.google.com/googleplay/android-developer/answer/13327111, 2026-10-23). RODO, ustawa o ochronie danych osobowych, KC, ordynacja podatkowa, ustawa o rachunkowości, PKE, DSA i AI Act NIE zostały sprawdzone w ISAP/EUR-Lex/UODO. Numery przepisów poniżej pochodzą z wiedzy asystenta i wymagają weryfikacji (wpisać datę: [data weryfikacji]).
- Decyzja D21: właściciel deleguje wybór podstawy prawnej i retencji. Poniżej rekomendacja; ostateczny wybór po zatwierdzeniu przez prawnika.

## 1. Zasady przyjęte w rekomendacji

1. Dane o ciele i zdrowiu (waga, obwody, samopoczucie, zdjęcia sylwetki, dieta i cele żywieniowe, kontuzje) traktujemy ostrożnościowo jako dane art. 9 RODO. Sama umowa (art. 6 ust. 1 lit. b) nie znosi zakazu z art. 9 ust. 1. Podstawą art. 9 jest **wyraźna zgoda (art. 9 ust. 2 lit. a)**, a podstawą art. 6 równolegle umowa (lit. b) dla świadczenia samej usługi dziennika.
2. Zgody są rozdzielne: (a) dane o zdrowiu i ciele, (b) zdjęcia sylwetki, (c) udostępnianie w społeczności, (d) analityka, (e) reklamy (AdMob/UMP), (f) powiadomienia push/e-mail (jeśli przypomnienia zostaną). Zgody (a) i (b) odmówione = konto działa bez tych funkcji tam, gdzie to technicznie możliwe; jeśli dziennik ciała jest istotą usługi, brak zgody (a) oznacza brak dostępu do modułów ciała (nie do całej aplikacji).
3. Retencja: dane żyją tak długo, jak trwa konto, z wyjątkiem danych o długim cyklu życia ograniczonych nieaktywnością. Proponowany próg nieaktywności: **24 miesiące** (ostrzeżenie e-mailem 30 dni przed usunięciem), dla zdjęć sylwetki **12 miesięcy** nieaktywności konta.
4. "Nieaktywność" = brak logowania i brak wpisów. Zdarzeniem kończącym retencję zawsze jest też: usunięcie konta, wycofanie zgody (dla danych opartych na zgodzie) albo usunięcie rekordu przez użytkownika.
5. Backupy: usunięcie z kopii zapasowych w cyklu rotacji, max 35 dni [do ustalenia po wyborze VPS/Render]. Do uzupełnienia w polityce.

## 2. Tabela podstaw prawnych i retencji (numeracja jak w inwentaryzacji)

Skróty: B = art. 6 ust. 1 lit. b (umowa), A = zgoda (art. 6 ust. 1 lit. a), F = uzasadniony interes (lit. f), C = obowiązek prawny (lit. c). Z9-A = art. 9 ust. 2 lit. a (wyraźna zgoda).

| # | Kategoria | Podstawa art. 6 / art. 9 | Uzasadnienie | Retencja i zdarzenie kończące | Sposób usunięcia |
|---|---|---|---|---|---|
| 1 | Konto i tożsamość (email, hash, imię, rola) | B | konieczne do umowy o dostarczanie konta | do usunięcia konta; nieaktywność 24 mies. (ostrzeżenie 30 dni wcześniej) | kasowanie wiersza `users` + kaskada |
| 2 | OAuth (Google/Facebook) | B | logowanie wybrane przez użytkownika | j.w.; wycofanie połączenia = usunięcie wpisu | kaskada; informacja o odwołaniu aplikacji w panelu Google/Meta |
| 3 | Kody weryfikacyjne e-mail | F (bezpieczeństwo, weryfikacja adresu) / B | zapobiega zakładaniu kont na cudze adresy | 14 dni obecnie; zalecane skrócenie do 24 h-7 dni | cron `db-retention` (istnieje) |
| 4 | Dane ciała w profilu (waga, wzrost, wiek, płeć, aktywność) | B + Z9-A (zgoda "dane o zdrowiu i ciele") | służą do obliczeń kcal; ujawniają stan ciała | do wycofania zgody lub usunięcia konta; nieaktywność 24 mies. | zerowanie pól (wycofanie zgody) / kaskada |
| 5 | Waga, check-iny (sen, energia, stres, notatki) | B + Z9-A | dziennik postępów; notatki wolnotekstowe mogą zawierać dowolne dane zdrowotne | j.w. + pojedyncze wpisy kasowane przez użytkownika od razu | kasowanie rekordów |
| 6 | Raporty ciała (obwody, samopoczucie, trawienie) | B + Z9-A | j.w. | j.w. | kasowanie rekordu / kaskada |
| 7 | Zdjęcia sylwetki i zdjęcie startowe | Z9-A (osobna zgoda "zdjęcia sylwetki") + B | obraz ciała; możliwe dane szczególnie wrażliwe; wizerunek | do usunięcia przez użytkownika, wycofania zgody (kasowanie w ciągu 30 dni, w praktyce natychmiast) lub 12 mies. nieaktywności konta; **koniec wyjątku "zdjęcia nigdy nie są usuwane"** | fizyczne kasowanie z DB (nie flaga); lokalnie także z cache SW |
| 8 | Dziennik posiłków, cele żywieniowe, szablony | B + Z9-A | dieta i cele kaloryczne ujawniają stan zdrowia | j.w. (konto / zgoda / 24 mies.) | j.w. |
| 9 | Treningi, cardio, plany, aktywne sesje, GPS, zdjęcie z urządzenia cardio | B; Z9-A dla pól o kontuzjach/ograniczeniach (`injuriesOrLimitations`) i dla zdjęć urządzeń; GPS: A (zgoda przeglądarki/systemu) | dziennik treningowy pośrednio ujawnia kondycję | konto / zgoda / 24 mies.; aktywne sesje 7 dni (istnieje); trasa GPS: nie zapisywać dłużej niż potrzeba do wpisu [do potwierdzenia] | kaskada, cron |
| 10 | Cele i preferencje | B (+ Z9-A dla celów wagowych/sylwetkowych) | personalizacja | konto | kaskada |
| 11 | Zamówienia pakietów (kwota, status, hotpayPaymentId) | B (realizacja), C (księgowość, podatki) | obowiązek przechowywania dokumentów rozliczeniowych | **5 lat od końca roku podatkowego** transakcji [do weryfikacji: ordynacja podatkowa, ustawa o rachunkowości, VAT] | po usunięciu konta: anonimizacja (odcięcie od `users`, usunięcie e-maila i imienia poza wymaganym minimum); nie kaskada |
| 12 | Treści społeczności: posty, zdjęcia, komentarze, czat | B (świadczenie funkcji), A/Z9-A gdy zdjęcie lub treść ujawnia ciało/zdrowie | domyślnie prywatne (LR-9); upublicznienie = świadomy akt użytkownika + zgoda "udostępnianie w społeczności" | konto; czat 90 dni (istnieje); zdjęcia feedu: z postem, max 24 mies. od publikacji [do decyzji]; zgłoszone naruszenia: do zakończenia sprawy + 6 mies. | kasowanie przez autora, moderatora, kaskada |
| 13 | Profil społecznościowy, znajomi, live, XP, odznaki | B; widoczność w rankingu/wyszukiwaniu: A (opt-in zamiast obecnego opt-out) | dane aktywności fizycznej na żywo ujawniają zachowanie | konto; `friend_live_presence` 2 dni (istnieje) | kaskada |
| 14 | Powiadomienia, push (endpoint, klucze), przypomnienia | A (art. 399 PKE [weryfikacja] + zgoda przeglądarki) | PWA push to dostęp do urządzenia | do wycofania zgody lub 6 mies. po ostatnim błędzie dostarczenia; **jeśli przypomnienia PWA zostaną usunięte (D8): skasować wszystkie `push_subscriptions` i `reminder_dispatches`** | kasowanie tabel / kaskada |
| 15 | Analityka własna (`page_views`, `site_activity_log`) | `page_views`: A (zgoda "analityka"); `site_activity_log`: F (bezpieczeństwo, rozliczalność) z zakazem treści zdrowotnych w `metaJson` | | 21 / 45 dni (istnieje) | cron |
| 16 | PostHog (zdarzenia z userId) | A (zgoda "analityka" zapisana na serwerze) | PKE + RODO; obecnie brak bramki po stronie serwera | do wycofania zgody; dane w PostHog max 12 mies. [ustawić w projekcie]; distinctId pseudonimizowany (hash z solą) | API usuwania PostHog przy usunięciu konta; wycofanie = stop wysyłki |
| 17 | Logi błędów, Sentry | F (diagnostyka, bezpieczeństwo - art. 32) po teście równowagi; Sentry klienta preferencyjnie po zgodzie, serwerowego z scrubbingiem | bez treści zdrowotnych (LR-5) | Sentry 30-90 dni; logi serwera 30 dni | retencja po stronie dostawcy; ustawić jawnie |
| 18 | Zgłoszenia błędów + zrzuty ekranu | B (obsługa zgłoszenia) + A dla załączonych zrzutów (informacja o ryzyku danych na ekranie) | zrzut może ujawnić dane zdrowotne | 12 mies. od zamknięcia zgłoszenia; zrzuty 90 dni od zamknięcia | cron |
| 19 | Dziennik audytowy admina | F / C (rozliczalność, art. 32) | | 180 dni (istnieje); dostęp do danych wrażliwych logowany | cron |
| 20 | Reklamy AdMob/UMP | A (zgoda UMP, zgodnie z TCF) | identyfikator reklamowy; odrębny administrator (Google) | zgoda ważna do wycofania; zapis w rejestrze zgód serwera | wycofanie w UMP + w ustawieniach |
| 21 | Zapytania do Open Food Facts / USDA | F (świadczenie katalogu produktów; bez ID użytkownika) | | nie przechowywane (cache produktów bez powiązania z kontem) | n/d |
| 22 | **Rejestr zgód i żądań (nowy)**: userId, typ, wersja, status, czas, źródło; log żądań usunięcia/eksportu | C (art. 7 ust. 1, art. 5 ust. 2 - rozliczalność) / F | dowód zgody | czas przetwarzania + **3 lata** po jego zakończeniu (przedawnienie roszczeń) [prawnik: 3 czy 6 lat] ; przy usunięciu konta zostaje zapis zanonimizowany (skrót ID bez e-maila) | cron po upływie |
| 23 | Wiek / data urodzenia (nowe, D18) | B / C (wykazanie spełnienia progu 16+) | patrz sekcja 4.2 | wiek bez daty urodzenia: zapisujemy tylko oświadczenie "mam co najmniej 16 lat" + wersję + czas (w rejestrze zgód) | j.w. |

Uwaga do pozycji 12 i D19: D19 ("tylko dla właściciela") interpretuję jako: **zdjęcia sylwetki widoczne tylko dla ich autora** (nie dla innych użytkowników ani społeczności). Czat z natury widzą uczestnicy rozmowy. Proszę o potwierdzenie (pytanie PO-1). Dla admina/właściciela serwisu zasada: brak rutynowego dostępu do zdjęć sylwetki; podgląd tylko w sprawie zgłoszenia i z zapisem w `admin_audit_log`.

## 3. Ocena D8 (usunięcie eksportu danych i usunięcia konta)

**Werdykt: NIE można usunąć obu funkcji bez zastąpienia ich innym kanałem. Przypomnienia PWA można usunąć.**

| Funkcja | Obowiązek | Minimalna dopuszczalna forma |
|---|---|---|
| Usunięcie konta | art. 17 RODO (zgoda i umowa jako podstawy: prawo do usunięcia, cofnięcie zgody) oraz **Google Play** (D23): aplikacja z kontem musi mieć (1) ścieżkę usunięcia w aplikacji i (2) publiczny link w sieci do wniosku o usunięcie; deaktywacja/zamrożenie nie wystarcza; trzeba ujawnić, co zostaje (np. zamówienia) | **Przycisk w aplikacji (zachować istniejący `DELETE /api/user/account`)** z ponownym uwierzytelnieniem (hasło lub e-mail), informacją o skutkach i anonimizacją zamówień; **plus** publiczna strona `/usun-konto` (z formularzem lub adresem e-mail dedykowanej skrzynki) dla osób bez dostępu do aplikacji. Samo usuwanie "na żądanie przez e-mail" bez przycisku NIE spełnia Google Play |
| Eksport danych | art. 15 ust. 3 i art. 20 RODO (przenoszenie dla danych przetwarzanych na podstawie zgody/umowy w sposób zautomatyzowany) | RODO nie wymaga przycisku: wystarczy realizacja żądania w **1 miesiąc** (art. 12 ust. 3), w formacie powszechnie używanym i maszynowo czytalnym. Minimalna forma: procedura "na żądanie z dedykowanej skrzynki" z weryfikacją tożsamości i ręcznym uruchomieniem istniejącego skryptu eksportu. Rekomendacja: **zachować gotowy endpoint i przycisk**, bo kod już istnieje, a ręczna obsługa obciąża osobę prywatną; usunięcie przycisku nie zwalnia z obowiązku i zwiększa ryzyko terminu. Eksport musi być kompletny (inwentaryzacja, braki pkt 8) |
| Przypomnienia PWA (push) | brak obowiązku prawnego; ich usunięcie zmniejsza ryzyko PKE | Można usunąć. Wymagane: skasować istniejące subskrypcje push i dane `reminder_dispatches`, wyrejestrować service worker w części push, zaktualizować politykę i listę technologii |

Dodatkowo: zgłoszenia realizujemy też tym samym kanałem co inne prawa (sprzeciw, sprostowanie, cofnięcie zgody) - dedykowana skrzynka (D22) musi być wpisana w politykę.

## 4. Konsekwencje decyzji właściciela

### 4.1 D17 - administrator jest osobą prywatną
1. Osoba fizyczna może być administratorem danych. Wyjątek "czynności czysto osobiste lub domowe" (art. 2 ust. 2 lit. c RODO) nie obejmuje publicznie oferowanej aplikacji z kontami i płatnościami.
2. **Sprzedaż pakietów**: stałe, zarobkowe, zorganizowane oferowanie płatnych usług będzie najpewniej działalnością gospodarczą (definicja w ustawie Prawo przedsiębiorców [weryfikacja]). Bez rejestracji działalności (CEIDG), VAT/podatkowo i prawa konsumenta (podmiot "przedsiębiorca") pojawia się ryzyko. Rekomendacja: **przed uruchomieniem płatności zarejestrować działalność (lub spółkę)** i wskazać ją jako administratora/sprzedawcę. Do tego czasu pakiety nie powinny być sprzedawane lub należy je wyłączyć (checkout HotPay).
3. **Dane w polityce prywatności i regulaminie**: nazwa/imię i nazwisko administratora, adres do doręczeń, adres e-mail kontaktowy (dedykowana skrzynka), dla przedsiębiorcy NIP/REGON. Dla osoby prywatnej oznacza to publikację imienia, nazwiska i adresu domowego; można użyć adresu korespondencyjnego/skrytki lub, po rejestracji działalności, adresu do doręczeń z CEIDG. Ustawa o świadczeniu usług drogą elektroniczną i prawa konsumenta wymagają danych identyfikujących usługodawcę. Zmienne `LEGAL_*` muszą być uzupełnione (dziś placeholdery).
4. W polityce: sformułowanie "administratorem danych jest [imię i nazwisko]" (zamiast "ADO"; ADO to pojęcie z nieobowiązującej ustawy z 1997 r.). IOD: nie jest obowiązkowy (brak organu publicznego; zakres "na dużą skalę" danych art. 9 wymaga oceny - patrz pytanie PO-3).
5. Umowy powierzenia (DPA) z dostawcami zawiera administrator osobiście; rejestr czynności (art. 30) i DPIA obowiązują niezależnie od formy prawnej. DPIA wymagana (dane o zdrowiu, zdjęcia sylwetki, małoletni 16-17).
6. Odpowiedzialność: administrator-osoba fizyczna odpowiada całym majątkiem; rozważyć spółkę. Obowiązek zgłaszania naruszeń 72 h do UODO spoczywa na administratorze osobiście.
7. DSA: platforma z treściami użytkowników = prawdopodobnie usługa hostingowa/platforma internetowa; punkt kontaktowy i mechanizm zgłoszeń (art. 11-12, 16) mimo statusu osoby prywatnej; małe/mikroprzedsiębiorstwa mają złagodzenia dla platform [weryfikacja].

### 4.2 D18 - minimalny wiek 16 lat
1. Art. 8 RODO (zgoda dziecka w usługach społeczeństwa informacyjnego): w Polsce próg 16 lat. Przy 16+ rodzic nie musi wyrażać zgody, więc **nie potrzeba weryfikacji zgody opiekuna**. Zmiana z 13 na 16 oznacza: usunąć/zablokować rejestrację 13-15 lat, a istniejące konta osób poniżej 16 (jeśli są) wymagają procedury: powiadomienie, zablokowanie, usunięcie w uzgodnionym terminie [pytanie PO-2: czy są takie konta].
2. Weryfikacja wieku: nie żądać dokumentów (minimalizacja). Wystarczy **pole daty urodzenia lub oświadczenie "mam co najmniej 16 lat"** zapisane w rejestrze zgód (wersja tekstu, czas). Rekomendacja: oświadczenie + w polu profilu wiek obliczany z `age` (już istnieje); nie zapisywać pełnej daty urodzenia, jeśli nie jest potrzebna.
3. Osoby 16-17 lat: pełna zdolność do zgody RODO, ale **ograniczona zdolność do czynności prawnych** (art. 15, 17 KC): zakup płatnych pakietów wymaga zgody przedstawiciela ustawowego (poza drobnymi umowami życia codziennego). Rekomendacja: **płatne pakiety od 18 lat** (oświadczenie przy zakupie) albo zgoda opiekuna.
4. Zabezpieczenia dla 16-17: brak domyślnych celów deficytu kalorycznego poniżej bezpiecznego minimum, ostrzeżenie o zaburzeniach odżywiania i odesłanie do lekarza; zdjęcia sylwetki bez udostępniania społeczności (i tak tylko dla autora); profil prywatny domyślnie; brak reklam spersonalizowanych bez zgody. To nie jest wymóg wprost z RODO, lecz element oceny ryzyka (DPIA) i DSA art. 28 [weryfikacja].
5. Google Play: ustawić docelową grupę wiekową 16+ (lub 18+), nie dzieci (polityka Families nie dotyczy).

### 4.3 D25 - dane użytkownika w promptach Pollinations
1. Skoro dane trafiają do odbiorcy (Pollinations) i prawdopodobnie poza EOG, każda taka wysyłka wymaga podstawy i mechanizmu transferu (rozdział V RODO: decyzja adekwatności, SCC art. 46, albo wyjątek art. 49 - zgoda szczególna). Nie zweryfikowano: siedziby dostawcy, DPA, retencji promptów po jego stronie.
2. **Rekomendacja (wariant podstawowy, preferowany): minimalizacja.** Do promptu nie trafiają żadne dane osobowe ani zdrowotne: bez imienia, nazwiska, nazwy użytkownika, wagi/udźwigu, tytułów wpisów użytkownika. Prompt składany z kontrolowanych fragmentów (nazwa ćwiczenia z katalogu, nazwa potrawy z przepisu aplikacji, styl). Wtedy nie ma danych osobowych u odbiorcy i transfer nie dotyczy tej funkcji; pozostaje wpis w polityce o użyciu AI i oznaczenie grafik jako wygenerowanych (AI Act art. 50 [weryfikacja]).
3. Wariant alternatywny (jeśli właściciel chce personalizować grafiki "NOWY MAX" liczbą kg lub nazwiskiem): osobna zgoda "grafiki AI z moich danych" (art. 6 ust. 1 lit. a; a przy wartościach udźwigu/wagi także Z9-A) + wyraźna informacja o transferze i ryzyku (art. 49 ust. 1 lit. a) lub SCC z dostawcą + wpis w polityce + `aiFeaturesDisabled` honorowane. Nie rekomendowane: nieproporcjonalne do celu.
4. Należy wskazać w kodzie dokładnie, które pola trafiają do promptu (zadanie backendu: audyt `lib/pr-achievement-image.ts` i generatorów przepisów). Do czasu audytu uznajemy za naruszenie LR-10.

### 4.4 D23 - Android w Google Play (Data safety i inne wymogi)
1. Wymagane: adres URL polityki prywatności (publiczny, w aplikacji i w konsoli), formularz Data safety, deklaracja usunięcia konta (in-app + link WWW; patrz sekcja 3), deklaracja aplikacji zdrowotnych (Health apps declaration) i zastrzeżenie niemedyczne, docelowa grupa wiekowa (16+/18+), deklaracja reklam (AdMob po konfiguracji, D24) i UMP.
2. Data safety - kategorie do zadeklarowania (propozycja, po audycie kodu): dane osobowe (imię, e-mail, ID użytkownika), zdrowie i fitness (waga, pomiary, posiłki, treningi), zdjęcia (sylwetka, post), aktywność w aplikacji, dzienniki awarii i diagnostyka (Sentry), identyfikatory urządzeń/reklamowe (AdMob), lokalizacja (GPS cardio, jeśli używany w WebView), dane płatnicze zbiera HotPay (nie aplikacja); dla każdej: czy udostępniane, czy opcjonalne, cel; "dane szyfrowane w tranzycie: tak"; "użytkownik może zażądać usunięcia: tak".
3. Spójność: deklaracja Data safety, polityka prywatności i faktyczne działanie (SDK AdMob, PostHog, Sentry) muszą być zgodne; sprzeczność = odrzucenie lub zawieszenie.
4. Uprawnienia: `REQUEST_INSTALL_PACKAGES` (instalacja APK) jest ograniczone w Play i niezgodne z dystrybucją przez sklep - usunąć z wersji Play. `SCHEDULE_EXACT_ALARM` wymaga uzasadnienia; przy rezygnacji z przypomnień (D8) usunąć. `CAMERA` i `POST_NOTIFICATIONS` opisać w polityce. [weryfikacja aktualnych zasad Play na dzień publikacji]
5. WebView ładuje stronę z Render/VPS: polityka prywatności musi opisywać dane przetwarzane po stronie serwera, nie tylko aplikacji natywnej. Logowanie Google/Facebook w WebView może być blokowane przez dostawców (osobny temat techniczny).

## 5. Zaktualizowane reguły LR (zastępują sekcję 5 inwentaryzacji tam, gdzie się różnią)

- **LR-1 (podstawa)**: operacja na danych ma podstawę z sekcji 2; dane ciała/zdrowia/zdjęcia: Z9-A (wyraźna zgoda) + art. 6 ust. 1 lit. b. Wpis do rejestru czynności.
- **LR-2 (zgody)**: osobne zgody (zdrowie/ciało, zdjęcia sylwetki, społeczność, analityka, reklamy, push, grafiki AI jeśli wariant 4.3.3), nieprzedwybrane, wersjonowane, zapis serwerowy (userId, typ, wersja, status, czas, źródło), wycofanie jednym kliknięciem; wycofanie z Z9-A skutkuje kasowaniem danych tej kategorii (z potwierdzeniem) lub blokadą modułu.
- **LR-3 (DPIA)**: DPIA przed wdrożeniem funkcji ciała/zdjęć/społeczności/profilowania; pierwsza DPIA dla całego produktu przed publikacją w Google Play.
- **LR-4 (wiek)**: rejestracja wymaga oświadczenia 16+ zapisanego w rejestrze; poniżej 16 zakaz; 16-17: zabezpieczenia z 4.2.4, pakiety od 18 lat.
- **LR-5 (logi)**: bez wartości zdrowotnych, treści i notatek w logach, Sentry, PostHog, `metaJson`.
- **LR-6 (analityka)**: tylko po zgodzie zapisanej na serwerze (klient i serwer); distinctId pseudonimizowany.
- **LR-7 (retencja)**: retencja z sekcji 2 zapisana w `lib/db-retention.ts` (w tym nieaktywność 24/12 mies. i ostrzeżenie); zmiana = zmiana polityki.
- **LR-8 (usuwanie/eksport)**: **usunięcie konta w aplikacji i na stronie WWW jest obowiązkowe (Google Play + art. 17)**; eksport kompletny, przycisk lub procedura 1 miesiąca; zamówienia anonimizowane, nie kaskadowo kasowane; usunięcie obejmuje PostHog, Sentry (o ile możliwe), Pollinations (n/d jeśli minimalizacja), kopie zapasowe w cyklu rotacji.
- **LR-9 (UGC)**: domyślnie prywatne; zdjęcia sylwetki widoczne tylko dla autora (D19) i niepublikowalne w feedzie bez osobnej zgody; zgłoszenie naruszenia, moderacja, blokowanie, kontakt DSA.
- **LR-10 (AI)**: prompty bez danych osobowych i zdrowotnych (4.3.2); oznaczenie grafik jako AI; `aiFeaturesDisabled` respektowane; każda zmiana pól w promptach wymaga przeglądu prawnika.
- **LR-11 (dostawcy)**: lista z inwentaryzacji + DPA podpisywane przez administratora; potwierdzenie regionów (D2) i mechanizmu transferu; kolumna "region" w ewidencji.
- **LR-12 (zdrowie)**: zastrzeżenie niemedyczne w ekranach z rekomendacjami; ostrzeżenie o zaburzeniach odżywiania przy celach deficytu; deklaracja Health apps w Play.
- **LR-13 (teksty prawne)**: wersjonowanie w `docs/prawo/`; polityka wskazuje administratora z imienia i nazwiska/firmy, adres, skrzynkę kontaktową, odbiorców, transfery, retencje (tabela), prawa, cofnięcie zgody, skargę do UODO; zmiany po zatwierdzeniu prawnika.
- **LR-14 (płatności)**: **brak sprzedaży pakietów bez rejestracji działalności**; informacje przedumowne, zgoda na rozpoczęcie świadczenia i utratę prawa odstąpienia zapisana w zamówieniu; sprzedaż osobom 18+.
- **LR-15 (licencje)**: j.w.; atrybucja ODbL dla Open Food Facts.
- **LR-16 (nowa, Android/sklepy)**: zgodność Data safety, polityki i kodu; brak uprawnień nieuzasadnionych; docelowy wiek 16+.
- **LR-17 (nowa, dostęp admina)**: brak rutynowego dostępu do zdjęć sylwetki i treści prywatnych; dostęp logowany; zasada minimalnych uprawnień.
- **LR-18 (nowa, naruszenia)**: procedura 72 h (UODO) i powiadomienie osób, rejestr incydentów, kto zgłasza (administrator osobiście).

## 6. Zadania wdrożeniowe w kolejności priorytetu (bez implementacji)

| Pr. | Zadanie | Wykonawca | LR |
|---|---|---|---|
| 1 | Usunąć tryb kodu `1234` na produkcji; skonfigurować SMTP z dedykowanej skrzynki (D3/D22); wpis w `lib/admin-config-status.ts` | backend | LR-11 |
| 2 | Tabela `user_consents` (+ rejestr żądań) i endpointy nadania/wycofania; migracja istniejących użytkowników: jednorazowy ekran zgód (zdrowie/ciało, zdjęcia); do czasu zgody moduły ciała zablokowane | backend + frontend + ux | LR-1, LR-2 |
| 3 | Próg wieku 16+: walidacja rejestracji, oświadczenie w rejestrze, obsługa kont <16, ograniczenie pakietów do 18+, zabezpieczenia kaloryczne dla 16-17 | backend + frontend | LR-4, LR-12 |
| 4 | Usuwanie konta: reautoryzacja, anonimizacja zamówień, kasowanie w PostHog, publiczna strona `/usun-konto` z adresem/formularzem (wymóg Google Play); kompletny eksport; zachować przyciski | backend + frontend | LR-8 |
| 5 | Pollinations: audyt i usunięcie danych osobowych z promptów, oznaczenie grafik AI | backend | LR-10 |
| 6 | Retencja: nieaktywność 24/12 mies. z ostrzeżeniem, koniec wyjątku dla zdjęć, bug_reports, push; skrócenie kodów e-mail | backend | LR-7 |
| 7 | Bramka zgody analityki po stronie serwera (PostHog, `site_activity_log`), Sentry scrubbing i konfiguracja po zgodzie, jawna retencja | backend | LR-5, LR-6 |
| 8 | Społeczność: domyślnie prywatne (zmiana `discoverable`, `showOnGlobal`), zgłoszenia naruszeń, kontakt DSA, zdjęcia sylwetki tylko dla autora, log dostępu admina | backend + frontend | LR-9, LR-17 |
| 9 | Usunięcie przypomnień PWA (D8) razem z czyszczeniem `push_subscriptions` oraz uprawnień Androida | backend + frontend | D8 |
| 10 | Dokumenty: polityka prywatności (ze zmianą administratora, tabelą retencji, odbiorców), regulamin, polityka cookies/technologii, DPIA, rejestr czynności, procedura naruszeń, Data safety Play, uzupełnienie `LEGAL_*`; rejestracja działalności przed sprzedażą | prawnik + właściciel | LR-13, LR-14, LR-16, LR-18 |

## 7. Ryzyka (prawdopodobieństwo, skutek, środek)

| Ryzyko | P | S | Środek |
|---|---|---|---|
| Sprzedaż pakietów przez osobę prywatną bez działalności | wysokie | wysoki (prawo, podatki) | rejestracja działalności lub wyłączenie płatności |
| Brak przycisku usunięcia konta w Play | wysokie (jeśli D8 wykonane) | odrzucenie publikacji | zachować przycisk + strona WWW |
| Dane do Pollinations bez podstawy transferu | średnie | wysoki | minimalizacja promptu |
| Konta poniżej 16 lat po zmianie progu | niepewne | średni | audyt bazy, procedura |
| Brak DPA/regionów (D2) | wysokie | średni | potwierdzić w panelach, podpisać DPA |
| Hosting Render -> VPS: zmiana lokalizacji danych i podmiotów | pewne | średni | aktualizacja polityki przy migracji; backupy i szyfrowanie `APP_ENCRYPTION_KEY` wymagane |

## 8. Pytania otwarte

- PO-1: Czy D19 oznacza "tylko autor zdjęcia" (założenie) czy "tylko właściciel serwisu"? Co z czatem między użytkownikami?
- PO-2: Czy w bazie są konta osób poniżej 16 lat? Skąd to wiemy (pole `age`)?
- PO-3: Czy prawnik uzna potrzebę IOD (przetwarzanie danych art. 9 "na dużą skalę")?
- PO-4: Czy właściciel zarejestruje działalność przed sprzedażą pakietów (D10 jeszcze nieustalony)?
- PO-5: Siedziba i DPA Pollinations; region Turso/Sentry/PostHog/Upstash (D2).
- PO-6: Backupy: gdzie i jak długo (Render/VPS).
- PO-7: Czy GPS jest zapisywany na serwerze (cardio)?

## 9. Do zatwierdzenia przez prawnika-człowieka

Całość, w szczególności: klasyfikacja Z9 i wybór zgody jako podstawy art. 9; retencje 24/12 mies. i 3 lata dla rejestru zgód; okres 5 lat dla zamówień; ocena statusu przedsiębiorcy; ocena obowiązków DSA dla osoby prywatnej; ocena transferu do Pollinations; progi wieku i zdolność do czynności prawnych 16-17 lat; zgodność z Google Play.
