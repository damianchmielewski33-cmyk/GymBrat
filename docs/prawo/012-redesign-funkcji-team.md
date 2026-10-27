# 012 - Ocena prawna redesignu funkcji Team (bramka wejściowa, etap 2)

- **Wersja**: 0.1 (projekt roboczy do przeglądu prawnika-człowieka)
- **Data**: 2026-10-26
- **Karta zadania**: `docs/zadania/012-redesign-funkcji-team.md`
- **Wejście**: `docs/analiza/012-redesign-funkcji-team.md` (etap 1, analityk)
- **Poprzedza**: architekt (etap 3, ADR 0011), ux (etap 4)
- **Powiązane**: `docs/prawo/00-inwentaryzacja-danych.md` (kategorie 9, 12, 13; ryzyka R1, R2, R4, R5, R7, R9), `docs/prawo/01-podstawy-prawne-i-retencja.md` (LR-1 do LR-18, wiersze 12-16, 23; zadania wdrożeniowe 2, 3, 4, 8), `docs/zespol/decyzje-wlasciciela.md` (D5, D9, D10, D17, D18, D19, D21, D25)

> **Status: projekt roboczy asystenta AI. Nie jest poradą prawną.** Każdy tekst przeznaczony dla użytkowników (zgody, komunikaty, polityka prywatności, regulamin) musi przed publikacją zatwierdzić prawnik-człowiek. Stan prawny wskazany poniżej został sprawdzony tylko częściowo (patrz sekcja 12).

---

## 0. Werdykt

**ODRZUCONE w zakresie widoczności wyników** (ranking, tablica, odznaki widoczne dla innych, widoczność poza grupą, wyszukiwanie). Zadanie nie wraca do etapu 1, bo problemy da się rozwiązać w projekcie (etap 3 i 4) i w warunkach wdrożenia.

**ZATWIERDZONE dla dalszej pracy architekta i ux** w zakresie, który nie pokazuje danych aktywności innym osobom poza uczestnikiem: własne XP, katalog odznak (tylko dla właściciela), pierścienie i seria tygodni widoczne tylko dla właściciela, wskazówki "co zrobić" dla siebie, XP grupy jako suma bez danych osób.

Blokujące (szczegóły w sekcji 9):

| Kod | Problem | Typ | Kiedy musi być zamknięte |
|---|---|---|---|
| B-1 | Wyszukiwanie znajomych dopasowuje e-mail i pokazuje prefiks e-maila jako nazwę (istnieje w kodzie, domyślnie włączone) | Istniejący defekt w produkcji | Hotfix niezależny od zadania 012; przed etapem 3 jako ograniczenie |
| B-2 | Publiczna grupa pokazuje członków i ranking osobom spoza grupy (istnieje w kodzie) | Istniejący defekt w produkcji | Hotfix niezależny od zadania 012; przed etapem 3 jako ograniczenie |
| B-3 | Domyślne ustawienia profilu społecznościowego są typu opt-out (widoczność w globalu i wyszukiwaniu) | Istniejący stan, wymaga zmiany | Przed wdrożeniem nowej widoczności; migracja istniejących kont |
| B-4 | Brak rejestru zgód po stronie serwera (zgoda bez dowodu nie spełnia art. 7 ust. 1 RODO) | Zależność (01, zadanie 2) | Warunek wdrożenia rankingu, auto-postów i pojedynków |
| B-5 | Brak wieku 16+ w kodzie (`min(13)`) i brak zasad dla kont 16-17 w publicznej rywalizacji | Zależność (D18, 01, zadanie 3) | Warunek wdrożenia każdej funkcji widocznej dla innych osób |

---

## 1. Zakres oceny i założenia

Oceniam: rankingi grupowe (FCS), tablicę i auto-posty w grupie, odznaki i katalog, pierścienie (trening i cardio), serie tygodni, misje i wyzwania grupowe, widoczność wyniku w grupie i poza nią, wyszukiwanie, pojedynki 1 na 1 (v1.1, ocena wstępna).

Założenia (zgodne z 00 i 01):
- Administrator: osoba prywatna (D17). Rejestracja działalności przed sprzedażą pakietów pozostaje otwarta (PO-4 z 01). Nie zmienia to oceny zespołu funkcji Team, bo Team jest darmowy (Q2).
- Hosting i regiony nie są potwierdzone (D2, PO-5). Zakładam przetwarzanie w EOG, ale tego nie zweryfikowałem.
- Nie ma rejestru zgód po stronie serwera; zgody istnieją tylko w `localStorage` (00, sekcja 3, braki 1).
- Team jest darmowy w v1 (analiza 5.6, Q2). Ocena zakłada, że D10 nie zmieni tego w sposób, który warunkuje prywatność płatnością (sekcja 3.5).

---

## 2. Stan faktyczny zweryfikowany w kodzie

| Obszar | Ustalenie | Miejsce |
|---|---|---|
| Domyślne ustawienia profilu | `visibility = "friends"`, `showStats = 1`, `showOnGlobal = 1`, `discoverable = 1`. Te same wartości są w fallbacku, gdy brak wiersza. | `db/schema.ts:1820-1831`; `lib/community/social-profile.ts:40-51` |
| Typ widoczności "public" | Istnieje; daje pełny widok profilu (`"full"`). | `lib/community/social-profile.ts:95` |
| Wyszukiwanie znajomych | Dopasowanie `LIKE` po `users.name` **oraz po `users.email`**, tylko dla `discoverable = 1`. Wynik zwraca `displayName` = imię/nazwa lub **prefiks e-maila** (przed `@`) oraz bio. Limit 20 wyników, minimum 2 znaki. | `lib/community/discover.ts:6-42` |
| Publiczna grupa | `canViewPrivateTeam` zwraca `true` dla grupy publicznej, więc zalogowany niebędący członkiem dostaje szczegóły grupy. Lista członków zawiera `displayName` (imię + nazwisko, a bez nich prefiks e-maila), `joinedAt`, punkty reputacji. | `lib/community/team-permissions.ts:64-68`; `lib/community/teams.ts:640-666, 712-727, 130-140` |
| Ranking na stronie grupy | `TeamFcsLeaderboard` jest renderowany bez warunku `isMember`, z pełnym rozbiciem (`components`) dla wszystkich wierszy. | `components/community/team-detail-view.tsx:315-318`; `teams.ts` (`ranking`) |
| Komponenty FCS | Obejmują m.in. "live" (udział w treningu na żywo) i "social". Ranking ujawnia więc obecność na treningu w czasie rzeczywistym. | analiza 012, sekcja 2.1 (wiersz "Ranking w grupie"); `lib/community/fcs.ts` |
| Cardio | Wpis cardio zawiera `avgHr`, `maxHr`, `calories` (kcal), `heartRateZone` (strefa 1-5) oraz minuty. | `lib/cardio-utils.ts:69-116`; `lib/analytics/cardio-hr-zones.ts`; `workouts.cardioMinutes` w `db/schema.ts:277` |
| Wiek | Walidacja rejestracji: `min(13)`. D18 (16 lat) jest zatwierdzony, ale nie wdrożony. Brak daty urodzenia (jest pole `age`). | `lib/validations/register.ts:34-37`; `docs/zespol/decyzje-wlasciciela.md` (D18) |
| Zgody społecznościowe | "Rejestrując się, akceptujesz..." to informacja, nie zgoda. Brak zapisu wersji i faktu zgody. | `components/auth/register-form.tsx:777`; 00, sekcja 3 |
| Hierarchia danych | Brak diagnozy stanu zdrowia lub kontuzji w schemacie (w `ai/coach.ts` jest `injuriesOrLimitations` jako wejście coacha, nie pole profilu). | `db/schema.ts` (brak pola) |

---

## 3. Odpowiedzi na pytania właściciela

### 3.1 Klasyfikacja danych (Q4 z analizy, sekcja 15.1 pkt 1)

Ocena ostrożnościowa, zgodna z 00 (kategoria 9: "pośrednio") i 01 (wiersz 9).

| Dane w Team | Klasyfikacja | Podstawa do publikacji w grupie | Uwagi |
|---|---|---|---|
| Liczba treningów, dni z treningiem w tygodniu | Dane o aktywności; nie art. 9 wprost. W kontekście aplikacji zdrowotnej traktować **ostrożnościowo jako pośrednio dane o zdrowiu** (CJEU, C-184/20 z 1.08.2022 [weryfikacja]: dane ujawniające pośrednio informację z art. 9 też podlegają art. 9). | Zgoda art. 6 ust. 1 lit. a (C-T1). | Brak treningu przez tydzień może ujawnić chorobę lub kontuzję: stąd LR-T14 (brak publicznych wskaźników nieaktywności). |
| Minuty cardio (sama suma) | Jak wyżej, pośrednio art. 9. Ocena w sekcji 3.3. | Osobna zgoda C-T2 (wyraźna, jak dla art. 9). | Warunkowo dopuszczalne. |
| Progres względny e1RM i tonażu (procent) | Dane o aktywności i sile. Nie art. 9 wprost. Wartość bezwzględna ciężaru jest dodatkowo wrażliwa (BR-3). | Zgoda C-T1. | Dozwolone tylko jako progres względny (US-16). Spadek w procentach nie może być publiczny (LR-T14). |
| Serie tygodni z treningiem | Jak liczba treningów. | Zgoda C-T1. | Przerwa w serii jest sygnałem nieaktywności: nie pokazywać innym. |
| Pozycja w rankingu, XP, odznaki, poziom | Dane pochodne od aktywności; profilowanie w rozumieniu art. 4 pkt 4 (ocena cech osoby na podstawie zachowania). | Zgoda C-T1; w razie zmiany podstawy: art. 21 (sprzeciw). | LR-T13. |
| Obecność na treningu na żywo (komponent "live", sesje, presence) | **Wysokie ryzyko**: ujawnia miejsce i chwilę przebywania na siłowni w czasie rzeczywistym. Nie dotyczy art. 9, ale jest ryzykiem bezpieczeństwa. | Zgoda C-T1 + oddzielna zgoda na "obecność na żywo" (nowa, do decyzji właściciela). | Patrz sekcja 9, pkt Z-6. Do rozstrzygnięcia przed etapem 3. |
| Tętno, strefy HR, kalorie (w tym szacowane z Keytel), makro, waga, obwody, zdjęcia, check-iny, sen, samopoczucie | Dane o zdrowiu / ciele (art. 9). | **Zakaz publikacji** w rankingu, odznakach, pierścieniach i tablicy (BR-3, BR-12). | Poza tym wymagana zgoda art. 9 ust. 2 lit. a na samo przetwarzanie (01, LR-1). |

Wniosek: publikowanie tych danych w grupie **nie może opierać się na uzasadnionym interesie (art. 6 ust. 1 lit. f)**. Porównanie aktywności między osobami nie jest niezbędne do świadczenia usługi dziennika (art. 6 ust. 1 lit. b): funkcja jest opcjonalna. Interes użytkownika w tym, by nie być widzianym przez innych bez wyboru, przeważa nad interesem administratora w rankingu. Podstawą jest zgoda.

### 3.2 Ogólna zgoda na funkcje społecznościowe nie wystarcza

Zgoda na "korzystanie z funkcji społecznościowych" albo akceptacja regulaminu nie spełnia wymogów: zgoda musi być konkretna, wyodrębniona w formie zrozumiałej, dobrowolna i możliwa do wycofania tak łatwo, jak udzielono (art. 4 pkt 11, art. 7 ust. 2 i 3 RODO). Dla danych art. 9 wymagana jest wyraźna zgoda (art. 9 ust. 2 lit. a). Zgoda nie może być warunkiem korzystania z usługi, której wykonanie od niej nie zależy (art. 7 ust. 4). Dołączenie do grupy nie może być uzależnione od udziału w rankingu (BR-10).

### 3.3 Q5: czy "minuty cardio" bez tętna i kalorii są bezpieczne w rankingu grupowym?

**Odpowiedź: warunkowo tak, dla samej sumy minut w tygodniu, w grupie i tylko po osobnej zgodzie.** Nie, jeśli minuty wchodzą do tego samego ekranu lub payloadu z innymi polami cardio.

Uzasadnienie:
1. Minuty same w sobie nie są wprost danymi o zdrowiu, ale w aplikacji, która prowadzi dziennik treningów i cardio, sumy minut mogą pośrednio ujawniać stan zdrowia (np. nagłe zero minut). Dlatego zgoda osobna (C-T2) jest bezpiecznym wyborem.
2. Ryzyko rośnie, gdy minuty są łączone z intensywnością (strefy HR, czas w strefie 4-5), kcal lub średnim tętnem. Wtedy powstaje profil fizjologiczny, czyli dane art. 9 ujawnione innym. Dlatego wykluczamy te pola z każdego widoku dla innych osób.
3. Minuty nie mogą być przeliczane na kalorie (np. estymacją Keytel), na "spalone" wartości ani na "intensywność" w rankingu. Taka transformacja tworzy pole art. 9 z danych niebędących art. 9.
4. Minuty wyliczone z sumy `workouts.cardioMinutes` są dopuszczalne. Minuty wyliczone z przedziałów tętna (strefy) są niedopuszczalne, nawet jeśli wynik to "tylko czas".
5. Minuty nie mogą być porównywane z celem cardio w sposób, który wstydzi (np. "brakuje 40 min do wstydu"). Pokazywać postęp względny.

Warunki dopuszczenia minut cardio (LR-T3, LR-T4): osobna zgoda C-T2; whitelist pola na serwerze; brak HR, kcal i stref w tym samym payloadzie; brak pokazywania minut dla kont 16-17 (sekcja 4); usunięcie minut z widoku po wycofaniu C-T2 (bez usuwania danych z historii treningu).

### 3.4 Q3: domyślna widoczność wyniku

**Odpowiedź: nie, obecne domyślne ustawienia nie są zgodne z privacy-by-default (art. 25 ust. 2 RODO).** Domyślna widoczność musi być najwęższa, a każde rozszerzenie wymaga świadomego działania.

Ocena pól `userSocialProfiles`:

| Pole | Domyślnie | Ocena | Zalecenie (nowe konta) | Zalecenie (istniejące konta) |
|---|---|---|---|---|
| `visibility` | `friends` | Wąsko, ale profil i statystyki dla znajomych bez wyboru. Przy `showStats = 1` znajomi widzą statystyki od razu. | `private` (lub "tylko członkowie grup", nazwa do ux) do świadomego wyboru | Zmienić na `private`, jednorazowy ekran wyboru (LR-T2) |
| `showStats` | `1` | Niezgodne: statystyki treningowe widoczne domyślnie dla znajomych. | `0` | `0` (migracja, bez utrzymania starego domyślnego) |
| `showOnGlobal` | `1` | **Niezgodne**: widoczność w rankingu globalnym bez zgody (opt-out). | `0`, opt-in z osobną zgodą C-T3 | `0`; jednorazowa informacja |
| `discoverable` | `1` | **Niezgodne i połączone z defektem B-1**: wyszukiwanie po e-mailu z ujawnieniem prefiksu. | `0`, opt-in | `0`; jednorazowa informacja |

Zasady migracji istniejących kont:
- Stare ustawienia opt-out nie są zgodą. EDPB (Wytyczne 05/2020 o zgodzie, wersja 1.1) wskazuje, że zgoda wstępnie zaznaczona lub wynikająca z milczenia nie jest ważna [weryfikacja aktualnej wersji].
- Dlatego wszystkie konta przechodzą na ustawienia wąskie. Przy pierwszym wejściu po wdrożeniu użytkownik widzi jednorazowy ekran "Kto widzi Twoje wyniki" z wyborem bez zaznaczeń domyślnych.
- Do czasu wyboru: wynik niewidoczny dla innych; grupa nadal działa (BR-10).

Dodatkowa uwaga: domyślne wartości w fallbacku (`social-profile.ts:40-51`) są realnym "domyślnym" zachowaniem dla kont bez wiersza. Muszą być zmienione razem ze schematem.

### 3.5 Q2: monetyzacja Team (wpływ prawny)

Brak bezpośredniego problemu RODO, jeśli Team jest darmowy. Warunek: **prywatność nie może być płatna**. Ustawienia widoczności, ukrycia w rankingu i zgody nie mogą być częścią pakietu (ukrycie wyniku za opłatą byłoby warunkiem zgody, art. 7 ust. 4). Wyróżniki kosmetyczne (BR-8) są dopuszczalne, o ile nie zmieniają wyniku. Ocena konsumencka pakietów pozostaje w 01 (LR-14).

### 3.6 Q1, Q4 i inne pytania: tylko w zakresie prawnym

Q1 (kierunek rywalizacja/współpraca): bez wpływu prawnego. Q4 (liczba widocznych punktów): bez wpływu, o ile nie pokazuje danych art. 9 ani nie ujawnia danych poza grupą.

---

## 4. Konta 16-17 lat (AC-15.4, D18)

Stan: D18 zatwierdza 16 lat, ale kod nadal przyjmuje 13 lat (`lib/validations/register.ts:37`). Dopóki to się nie zmieni, w grupach mogą być osoby 13-15 lat, a dla nich zgoda na przetwarzanie wymaga zgody opiekuna (art. 8 ust. 1 RODO; próg krajowy 16 lat [weryfikacja przepisu w ISAP]).

Ocena dla 16-17 lat:
- Zgoda na przetwarzanie we własnym imieniu jest możliwa (art. 8 RODO, próg 16). **Zgoda opiekuna nie jest wymagana dla 16-17 lat**, więc nie należy jej wprowadzać: wymagałaby weryfikacji opiekuna i zbierania danych o rodzicu. Zamiast tego stosujemy ograniczenia (poniżej).
- Ograniczona zdolność do czynności prawnych (art. 15, 17 KC; 01, sekcja 4.2 pkt 3) nie dotyczy darmowego Team, ale dotyczy każdej przyszłej opłaty.
- DSA, art. 28 (ochrona małoletnich) i wytyczne Komisji z lipca 2025 (przyjęte 14.07.2025 wg omówień prawniczych [weryfikacja w EUR-Lex/Komisji]) dotyczą platform dostępnych dla małoletnich. Art. 19 DSA zwalnia mikro- i małe przedsiębiorstwa z sekcji 3, w tym z art. 28 [weryfikacja]. Zwolnienie nie zwalnia z RODO. Pytanie PO-DSA dla prawnika-człowieka: czy GymBrat (osoba prywatna, mikroprzedsiębiorca) skorzysta ze zwolnienia po rejestracji działalności.

Zalecenia (wymagane jako warunek wdrożenia publicznych funkcji, B-5):
1. **Konta poniżej 16 lat**: brak dostępu do Team (blokada, nie tylko ukrycie). Zgodnie z 01, sekcja 4.2 pkt 1, dotyczy to także istniejących kont (procedura, PO-2).
2. **Konta 16-17 lat**:
   - zakaz rankingów globalnych, wyszukiwania, widoczności poza grupą, publicznych grup (sprzężone z LR-T5 i LR-T6), bez możliwości włączenia przez użytkownika w MVP;
   - domyślnie tylko grupy prywatne, dołączane kodem lub zaproszeniem;
   - w grupie: ranking i tablica widoczne tylko dla członków 16-17 lat tej grupy, a dla dorosłych członków ukryte (architekt wybiera mechanizm; rekomendacja: segmentacja w obrębie grupy);
   - minuty cardio nie w rankingu domyślnie, także po zgodzie C-T2 (zalecenie ostrożnościowe);
   - brak pojedynków 1 na 1 w v1.1 dla kont poniżej 18 lat, chyba że prawnik-człowiek zdecyduje inaczej;
   - brak powiadomień push o utracie serii (LR-T14).
3. **Weryfikacja wieku**: samodeklaracja "mam co najmniej 16 lat" zapisana w rejestrze zgód (01, LR-4). Bez dokumentów i bez daty urodzenia (minimalizacja). Wymaga decyzji, czy pole `age` (bez daty urodzenia) wystarczy, skoro się starzeje (PO-7 w sekcji 9).
4. **Ocena DPIA**: wiek i rankingi to dwie przesłanki DPIA (LR-3).

---

## 5. Odrzucenie rankingów wagi, kalorii i makro (sekcja 3.3, BR-12)

**Ocena: decyzja słuszna.** Waga i obwody to dane art. 9. Ranking tych wartości w grupie publikuje dane zdrowotne innym osobom bez wyraźnej zgody i bez potrzeby niezbędnej do usługi. Kalorie i makro ujawniają dietę i cele żywieniowe, które mogą być objawem zaburzeń odżywiania. Porównanie między osobami wzmacnia presję na wygląd i zachowania ryzykowne. Rankingi względne postępu w tych danych są tym samym zagrożeniem, bo ujawniają trend masy ciała.

Zakazy (rozszerzenie BR-12, do wpisania w LR-T3):
- żadna forma progresu wagi, obwodów, zdjęć, kalorii, makro, celu deficytu albo nadwyżki w rankingu, odznakach, pierścieniach, tablicy i powiadomieniach;
- odznaki "za wagę" lub "za dietę" nie istnieją w katalogu;
- analiza tego, czego nie ma w rankingu, nie może być zastąpiona porównaniem kosztem w innym miejscu (np. w "wyzwaniu" z kcal).

Dodatkowe zabezpieczenia (nie wymagają nowych danych):
1. **Brak flagi zdrowotnej.** Nie dodawać pola "w leczeniu" ani "w rekonwalescencji": to nowe dane art. 9 zbierane bez potrzeby. Zamiast tego dać każdemu użytkownikowi opcję **"Ukryj mój wynik" bez podawania powodu** (BR-10). Użytkownik sam decyduje, kiedy się wycofać.
2. **Ostrzeżenie w ekranie celów** (LR-12 z 01): przy ustawianiu celu treningowego lub cardio komunikat, że aplikacja nie jest poradą lekarską ani dietetyczną, a przy nagłym spadku aktywności nie należy zwiększać obciążenia bez konsultacji.
3. **Brak wskaźników nieaktywności** dla innych (LR-T14).
4. **Brak progów wykluczających**: wynik rankingu nie może skutkować wyrzuceniem z grupy, ograniczeniem funkcji ani innym skutkiem wobec osoby (art. 22; LR-T13).
5. **Monitoring** (dla ux i tester): tekst komunikatów nie może mówić o "stracie", "przegranej" ani "zaniedbaniu" w odniesieniu do osoby (w kontekście zaburzeń odżywiania i nadmiernego treningu).

---

## 6. Zgody, komunikaty i opt-out

### 6.1 Wymagane zgody (osobne, nieprzedwybrane, wersjonowane)

| Kod | Zgoda | Kiedy | Domyślnie | Podstawa |
|---|---|---|---|---|
| C-T1 | Udział w rankingu i tablicy grupy (wyniki: liczba treningów, dni, serie, progres względny, XP, odznaki) | Przy dołączeniu do grupy i przy pierwszym wejściu na ekran Team po wdrożeniu | Nie zaznaczona | art. 6 ust. 1 lit. a |
| C-T2 | Pokazuj w rankingu minuty cardio | Przy C-T1 jako osobny krok, zawsze osobny checkbox | Nie zaznaczona | art. 6 ust. 1 lit. a i art. 9 ust. 2 lit. a (ostrożnościowo) |
| C-T3 | Widoczność poza grupą (wyszukiwarka, profil, globalny ranking) | Ustawienia Społeczność, nie wymuszana | Wyłączona | art. 6 ust. 1 lit. a; niedostępna dla 16-17 w MVP |
| C-T4 | Pojedynek 1 na 1 (v1.1): pokazanie swojego wyniku konkretnej osobie | Przy akceptacji wyzwania, za każdym pojedynkiem | Brak (wyzwanie wymaga akceptacji) | art. 6 ust. 1 lit. a |
| C-T5 | Obecność na żywo w grupie (komponent "live", opcja do decyzji właściciela, Z-6) | Ustawienia | Wyłączona | art. 6 ust. 1 lit. a |

Każdy zapis zgody: userId, typ (C-T1 do C-T5), id grupy (dla C-T1, C-T2, C-T4), wersja tekstu, status, czas, źródło (ekran, ustawienia). Zgoda bez rejestru po stronie serwera nie jest dowodem (B-4).

### 6.2 Projekt treści (do przeglądu prawnika-człowieka; mikrokopia musi zostać zatwierdzona)

**Ekran przy dołączeniu do grupy, krok "Twoje wyniki"** (tytuł: "Czy chcesz być w rankingu grupy?"):
> Jeśli włączysz udział, członkowie grupy [nazwa grupy] zobaczą w rankingu tygodniowym: Twoją pseudonimową nazwę (ustawioną przez Ciebie), liczbę treningów w tygodniu, serie tygodni, postęp siły w procentach względem Twoich wcześniejszych wyników oraz XP i odznaki.
>
> Nikt spoza grupy tych danych nie zobaczy. Nie pokażemy innym Twojej wagi, pomiarów, zdjęć, posiłków, tętna ani kalorii.
>
> ☐ Biorę udział w rankingu grupy (opcjonalne)
> ☐ Pokazuj też minuty cardio (osobna zgoda, opcjonalna)
>
> [Dołącz bez rankingu] [Dołącz i wyrażam zgodę]

Uwaga: obie zgody zaczynają się niezaznaczone. Przycisk "Dołącz bez rankingu" jest równorzędny wizualnie (nie może być nieczytelny). Tekst "opcjonalne" w każdej zgodzie.

**Zgoda na widoczność poza grupą (C-T3)**:
> Pokaż mój profil i wynik osobom spoza moich grup. Dane mogą być widoczne dla każdej zalogowanej osoby w aplikacji, w wyszukiwarce i w globalnym rankingu. Możesz to wyłączyć w każdej chwili w Ustawieniach, a wyszukiwanie przestanie mnie pokazywać natychmiast.

**Wyjście z grupy**:
> Po wyjściu z grupy [nazwa] Twój wynik zniknie z rankingu i tablicy. Automatyczne posty i reakcje z Twoim udziałem zostaną usunięte. Komentarze innych osób pozostaną, z oznaczeniem "były członek". [Pytanie o posty ręczne - do decyzji właściciela.]

**Wycofanie udziału w rankingu** (w Ustawieniach, jednym przełącznikiem, bez przechodzenia przez inne ekrany):
> Wyłączono udział w rankingu. Nie jesteś już pokazywany w rankingu i tablicy. Nadal jesteś członkiem grupy i możesz czytać oraz komentować.

### 6.3 Opt-out bez utraty członkostwa (US-15, BR-10)

Ocena: **proponowane rozwiązanie (ukrycie w rankingu bez utraty członkostwa) jest prawnie wystarczające, pod warunkiem spełnienia LR-T8.** Warunki:
- wycofanie działa od razu: zniknięcie z rankingu, z średnich grupy (AC-15.2 - średnie bez ukrytego), z powiadomień o pozycji (AC-13.2), z SSE i z cache (TTL ~45 s);
- historyczne snapshoty tygodniowe i wpisy HoF tej osoby nie są pokazywane innym, a dane są zanonimizowane w ciągu 30 dni (LR-T8, LR-7);
- wycofanie nie blokuje czatu ani feedu, ale automatyczne posty i reakcje tej osoby nie są generowane ani pokazywane w rankingu;
- wycofanie jest równie łatwe jak zgoda (art. 7 ust. 3 RODO): jeden przełącznik, bez potwierdzeń wielokrotnych.

---

## 7. Reguły LR-T dla architekta i ux

Te reguły uzupełniają LR-1 do LR-18 z `docs/prawo/01-podstawy-prawne-i-retencja.md`. Są wiążące dla etapów 3 i 4.

- **LR-T1 (podstawa udziału)**: udział w rankingu i tablicy grupy wymaga zgody C-T1 (art. 6 ust. 1 lit. a). Członkostwo w grupie nie zależy od zgody (art. 7 ust. 4; BR-10).
- **LR-T2 (domyślne ustawienia)**: dla nowych kont i po migracji istniejących: `visibility` = wąska (`private`), `showStats` = 0, `showOnGlobal` = 0, `discoverable` = 0. Zmiana fallbacku w `social-profile.ts` razem ze schematem. Istniejące konta: jednorazowy ekran wyboru, bez zaznaczeń domyślnych; do czasu wyboru wynik niewidoczny (art. 25 ust. 2 RODO).
- **LR-T3 (whitelist danych)**: każdy payload Team (ranking, tablica, odznaki, pierścienie, SSE, powiadomienia, cache, odpowiedzi API dla innych osób) zawiera wyłącznie: liczbę treningów, dni z treningiem, serie tygodni, progres względny (procent e1RM i tonażu), XP, odznaki, pozycję, pseudonim oraz minuty cardio tylko dla osób z C-T2. Zabronione: waga, obwody, zdjęcia, tętno, strefy HR, kalorie (także szacowane), makro, cele żywieniowe, notatki, check-iny, sen, samopoczucie, wartości bezwzględne ciężarów, komponent "live" bez zgody C-T5. Egzekwowane po stronie serwera (serializer z whitelistą), nie tylko w UI, z testem regresji.
- **LR-T4 (cardio)**: minuty cardio tylko jako suma z `workouts.cardioMinutes` (lub sumy trwania sesji cardio). Brak wyprowadzania z tętna, stref ani kalorii. Wycofanie C-T2 usuwa minuty z widoków innych osób, nie z historii treningu.
- **LR-T5 (poza grupą)**: widoczność poza grupą tylko po C-T3; niedostępna dla kont poniżej 18 lat w MVP. Wycofanie usuwa z wyszukiwarki i globalnych list natychmiast.
- **LR-T6 (grupa publiczna)**: osoba spoza grupy widzi tylko nazwę, opis i liczbę członków. Nie widzi członków, rankingu, tablicy, statystyk ani odznak grupy (B-2). Spełnienie wymaga zmiany `canViewPrivateTeam`/widoku dla niebędących członkami.
- **LR-T7 (identyfikacja)**: domyślna nazwa w grupie to pseudonim wybrany przez użytkownika. Imię i nazwisko tylko po świadomym wyborze. Prefiks e-maila nigdy nie jest nazwą (także jako fallback, `teams.ts:139`, `discover.ts:39`). Wyszukiwanie po adresie e-mail wyłączone (B-1).
- **LR-T8 (opt-out i wycofanie)**: patrz sekcja 6.3. Wycofanie zatrzymuje przetwarzanie do celu rankingu (art. 7 ust. 3). Historyczne snapshoty tygodniowe (`team_fcs_scores` i analogi) i wpisy HoF są ukrywane i zanonimizowane w ciągu 30 dni od wycofania.
- **LR-T9 (wyjście z grupy)**: w chwili wyjścia: usunięcie wpisów rankingu członka; usunięcie jego automatycznych postów i reakcji; komentarze pozostają z oznaczeniem "były członek"; posty ręczne do decyzji właściciela (pytanie PO-T3). Wyjście z grupy wywołuje dokładnie te same skutki co wycofanie C-T1.
- **LR-T10 (auto-posty i gratulacje)**: auto-posty (PR, serie, zamknięty pierścień, misje) i każdy widok wkładu członka (misje, wyzwania) w tablicy wymagają aktywnej zgody C-T1 członka. Osoba bez zgody nie jest w nich wymieniana. Limit zbiorczy z AC-12.2 nie zastępuje zgody.
- **LR-T11 (retencja, LR-7)**: nowe tabele (katalog odznak, zdobycia, pierścienie, snapshoty rankingu, pojedynki, zgody) muszą mieć wpis w `lib/db-retention.ts` albo uzasadnienie. Proponowane okresy: snapshoty tygodniowe 12 miesięcy od tygodnia (po wycofaniu: LR-T8), pojedynki zakończone 12 miesięcy, zdobycia odznak przez czas konta (zgodnie z BR-11 i konta), wpisy zgód zgodnie z 01 (wiersz 22). Zmiana okresów = zmiana polityki prywatności.
- **LR-T12 (rzadkość odznak)**: procent zdobywców liczony **globalnie** (nie per grupa), z progiem N co najmniej 50 zdobywców [do potwierdzenia, prawnik-człowiek]; poniżej progu nic nie pokazujemy. Liczniki zaokrąglane. Nie ujawniamy listy zdobywców poza grupą. Powód: w małej grupie procent wskazywałby konkretną osobę (re-identyfikacja).
- **LR-T13 (profilowanie)**: ranking i FCS są profilowaniem (art. 4 pkt 4). Polityka opisuje zasadę działania, a użytkownik może je zrozumieć (wyjaśnienie w rozbiciu FCS, AC-1.2). Wynik nie może skutkować wykluczeniem z grupy, ograniczeniem funkcji ani innym skutkiem wobec osoby (art. 22). Jeśli podstawą zostanie uzasadniony interes, dodać prawo sprzeciwu (art. 21).
- **LR-T14 (presja i zdrowie psychiczne)**: zakaz publicznych wskaźników nieaktywności (dni bez treningu, przerwana seria, spadek procentowy) widocznych dla innych; komunikat "utrzymaj serię" tylko dla właściciela; brak powiadomień push o utracie serii dla kont poniżej 18 lat; cel tygodniowy pokazywany jako postęp; brak języka przegranej w odniesieniu do osoby; ostrzeżenie zdrowotne przy celach (LR-12 z 01).
- **LR-T15 (wiek)**: konta poniżej 16 lat bez dostępu do Team (blokada). Konta 16-17 lat: tylko grupy prywatne, bez widoczności poza grupą, bez rankingu minut cardio domyślnie, bez pojedynków v1.1, ranking tylko wewnątrz segmentu wieku (sekcja 4). Realizacja po wdrożeniu D18 (B-5).
- **LR-T16 (zdarzenia analityczne i logi)**: zdarzenia `community_*` z Team tylko po zgodzie analityki zapisanej na serwerze (LR-6). Bez nazw grup, treści postów, wyników i identyfikatorów innych osób w PostHog, Sentry i logach (LR-5). Dozwolone: identyfikatory pseudonimizowane i kody zdarzeń.
- **LR-T17 (rejestr zgód)**: zgody C-T1 do C-T5 zapisywane po stronie serwera (userId, typ, wersja, status, czas, źródło). Funkcja widoczności dla innych nie może wejść na produkcję bez rejestru (B-4, zadanie 2 z 01).
- **LR-T18 (dostęp administratora i moderacji)**: administrator nie ma rutynowego podglądu rankingów ani postów; podgląd tylko w sprawie zgłoszenia, z wpisem do `admin_audit_log` (LR-17).
- **LR-T19 (treści użytkowników)**: każdy post, komentarz, nazwa grupy i pojedynek ma "zgłoś" i "zablokuj" (LR-9). Zgłoszenie zapisywane z identyfikatorem treści i powodem, bez kopii danych zdrowotnych.
- **LR-T20 (teksty)**: wszystkie komunikaty z sekcji 6.2 i nazwy zgód zatwierdza prawnik-człowiek przed publikacją. Każda zmiana tekstu = nowa wersja zgody i nowa wersja w `docs/prawo/`.
- **LR-T21 (zgoda na obecność na żywo)**: komponent "live" w FCS (obecność na treningu) działa wyłącznie po C-T5. Bez zgody komponent jest liczony jako zero, a nie pokazany.

---

## 8. Ocena istniejących dokumentów i ich aktualizacja

| Dokument | Co wymaga zmiany | Wykonawca / termin |
|---|---|---|
| `docs/prawo/00-inwentaryzacja-danych.md`, kategoria 13 i ryzyko R5 | Domyślne `discoverable`, `showOnGlobal` i `visibility` opisane jako opt-out. Po wdrożeniu: opt-in i migracja (sekcja 3.4). | prawnik, po etapie 3 |
| `docs/prawo/01-podstawy-prawne-i-retencja.md`, wiersz 13 | "widoczność w rankingu/wyszukiwaniu: A (opt-in zamiast obecnego opt-out)" - zgodne. Dodać C-T1 do C-T5 i LR-T1 do LR-T21 jako uzupełnienie LR-9. | prawnik |
| `docs/prawo/01...`, wiersz 12 (treści społeczności) | Dodać treści z auto-postów (LR-T10) i wkład członka w misjach. | prawnik |
| `docs/prawo/01...`, sekcja 6 (zadania) | Nowe zadanie: "Team: zgody i widoczność" z zależnością od zadania 2 (rejestr zgód) i zadania 3 (wiek). | prawnik, koordynator |
| Polityka prywatności (`app/(legal)/polityka-prywatnosci`) | Nowa sekcja "Społeczność i rankingi": co widać innym, zgody, wycofanie, retencja po wyjściu, profilowanie (art. 4 pkt 4), prawo sprzeciwu, zakaz rankingu dla <16. | prawnik + właściciel |
| Regulamin (`app/(legal)/regulamin`) | Zasady grup, treści, zgłaszanie naruszeń (LR-T19), blokowanie, moderacja (DSA art. 16-17 - do oceny po decyzji o zwolnieniu z art. 19). | prawnik |
| DPIA (LR-3) | Nowa DPIA dla Team: ranking, rzadkość, wiek 16-17, obecność na żywo, retencja snapshotów. Wymagana przed wdrożeniem. | prawnik + backend, przed etapem 5 |
| Google Play Data safety | Nowa kategoria: dane udostępniane innym użytkownikom (pseudonim, aktywność, odznaki). Zgodność z polityką (LR-16). | prawnik, przed publikacją Android |
| `docs/prawo/` (ten dokument) | Aktualizacja po decyzji architekta (ADR 0011) i ux. | prawnik, etap 10 |

---

## 9. Ustalenia: blokujące i do naprawy później

### 9.1 Blokujące (uzasadniają werdykt ODRZUCONE w zakresie widoczności)

**B-1 Wyszukiwanie po e-mailu i prefiks e-maila jako nazwa.** Realne ujawnienie danych w zwykłym użyciu. Każdy zalogowany użytkownik może wpisać część adresu e-mail (min. 2 znaki) i dostać listę osób z prefiksem adresu oraz bio, jeśli osoba ma `discoverable = 1` (domyślnie). Lokalizacja: `lib/community/discover.ts:15-41` (`or(like(users.name, ...), like(users.email, ...))`). Dodatkowo `displayNameFromUser` (`lib/community/teams.ts:139`) pokazuje prefiks e-maila jako nazwę członkom grupy.
- Środek: wyszukiwanie tylko po nazwie wyświetlanej; e-mail usunąć z zapytania i z odpowiedzi; fallback nazwy nie może zawierać e-maila; `discoverable = 0` domyślnie. Dla istniejących wierszy: migracja (B-3).
- Typ: istniejący defekt. Hotfix niezależny od zadania 012 (decyzja właściciela i koordynatora).

**B-2 Publiczna grupa pokazuje ranking i członków osobom spoza grupy.** Lokalizacja: `lib/community/teams.ts:640-641` (publiczna grupa dostępna dla każdego), `teams.ts:650-727` (członkowie z imieniem, nazwiskiem, punktami reputacji i datą dołączenia, bez sprawdzenia członkostwa), `components/community/team-detail-view.tsx:315-318` (ranking renderowany bez `isMember`). Narusza to BR-9, AC-15.1 i LR-9 z 01 (domyślna prywatność), bo ujawnia aktywność konkretnych osób osobom nienależącym do grupy.
- Środek: osoba niebędąca członkiem widzi nazwę grupy, opis i liczbę członków (jak `listPublicTeams`), ale nie członków, rankingu, tablicy ani odznak. Dla istniejących publicznych grup: nie zmieniać treści członkostwa bez informacji dla członków.
- Typ: istniejący defekt. Hotfix niezależny od zadania 012.

**B-3 Domyślne ustawienia profilu społecznościowego są opt-out.** Ustalenie w sekcji 3.4. Warunek wdrożenia Team. Zmiana wymaga migracji istniejących kont z jednorazowym wyborem i bez przypisywania starej zgody. Typ: stan istniejący, zmiana w ramach zadania 012 (architekt).

**B-4 Brak rejestru zgód po stronie serwera.** Bez tego nie da się wykazać C-T1 do C-T5 (art. 7 ust. 1). Zależność od zadania 2 w 01 (`user_consents`). Typ: warunek wdrożenia, nie blokuje projektu.

**B-5 Wiek 16+ niewdrożony; brak zasad dla 16-17 w publicznej rywalizacji.** Kod przyjmuje 13 lat (`register.ts:37`). Warunek wdrożenia wszystkich funkcji widocznych dla innych (LR-T15). Typ: zależność od D18 i zadania 3 w 01.

### 9.2 Do naprawy później (nieblokujące, dopisane do `docs/bledy-do-naprawy/bledy.md`, zadanie 012)

Zapisane w pliku (sekcja "Redesign Team (012): prawo"): decyzje właściciela i pytania prawne bez wpływu na działanie. Lista:
- Z-1: minuty cardio jako Z9 ostrożnościowo, czy wystarczy C-T2 (decyzja właściciela i prawnika-człowieka).
- Z-2: zwolnienie mikroprzedsiębiorstw z DSA art. 19/28 (pytanie prawnika-człowieka, po rejestracji działalności).
- Z-3: posty ręczne po wyjściu z grupy: usunąć czy anonimizować (decyzja właściciela).
- Z-4: data urodzenia zamiast pola `age` (starzenie się wieku, decyzja prawnika).
- Z-5: lista publicznych grup i liczba członków dla niezalogowanych (ocena niskiego ryzyka).
- Z-6: komponent "live" w FCS (obecność na żywo): osobna zgoda C-T5 czy wyłączenie z rankingu (decyzja właściciela; blokująca dopiero po jej podjęciu, bo domyślnie wyłączona).

### 9.3 Wymagania, nie błędy

Zapisane w sekcji 7 (LR-T1 do LR-T21). Nie wchodzą do `bledy.md`, bo są warunkiem projektu.

---

## 10. Wymagane dokumenty, zgody i DPIA przed wdrożeniem

| Element | Czy wymagany przed | Status |
|---|---|---|
| DPIA dla Team (art. 35; LR-3) | Wdrożeniem rankingu, rzadkości i kont 16-17 | Do sporządzenia (prawnik + backend) |
| Rejestr zgód po stronie serwera (B-4) | Każdą zgodą C-T1 do C-T5 | Do wdrożenia (01, zadanie 2) |
| Próg wieku 16+ (B-5) | Funkcjami publicznymi | Do wdrożenia (01, zadanie 3) |
| Teksty zgód i polityki (sekcja 6.2, 8) | Publikacją | Projekty; wymagają zatwierdzenia prawnika-człowieka |
| Wpis w rejestrze czynności (art. 30) | Wdrożeniem | Do dopisania: "Społeczność i rankingi" |
| Procedura zgłoszeń treści (LR-T19, DSA) | Publikacją postów i pojedynków | Do wdrożenia |
| Informacja o nowych odbiorcach danych (Google Play Data safety) | Publikacją Android | Do uzupełnienia |

---

## 11. Pytania otwarte

- **PO-T1**: Czy właściciel akceptuje domyślną widoczność "tylko po zgodzie" dla rankingu (zamiast "w grupie domyślnie" z analizy, AC-15.1)? Rekomendacja prawnika: tak, opt-in.
- **PO-T2**: Czy właściciel akceptuje blokadę Team dla kont poniżej 16 lat i ograniczenia dla 16-17 (sekcja 4)? Wpływ na liczbę użytkowników: do oceny w PostHog (PO-7 z analizy).
- **PO-T3**: Posty ręczne po wyjściu z grupy: usunąć, anonimizować czy zostawić? Rekomendacja: usunąć automatyczne i zanonimizować ręczne z oznaczeniem.
- **PO-T4**: Czy komponent "live" i obecność na treningu mogą być w rankingu (C-T5), czy są wyłączone w MVP? Rekomendacja: wyłączone w MVP.
- **PO-T5**: Próg N dla rzadkości (sugerowane 50): decyzja architekta i prawnika-człowieka.
- **PO-T6**: Czy w MVP mają być publiczne grupy (lista publiczna) dla dorosłych? Rekomendacja: tak, bez widoczności członków dla niezalogowanych.
- **PO-T7**: Czy `age` bez daty urodzenia wystarczy do weryfikacji progu 16 lat? Rekomendacja: tak, z samodeklaracją; wymaga oceny prawnika-człowieka.
- **PO-T8**: Czy D10 (pakiety) zmieni cokolwiek w Team poza kosmetyką? Rekomendacja: nie zmieniać prywatności za opłatą (sekcja 3.5).
- **PO-DSA**: zwolnienie z DSA art. 19 po rejestracji działalności (sekcja 4).
- **PO-T9 (z 01, PO-1)**: czy D19 ("tylko dla właściciela") obejmuje zdjęcia w postach grupy (feed) - obecnie zdjęcia sylwetki nie mogą być publikowane w grupie (LR-9 z 01).

---

## 12. Weryfikacja stanu prawnego

- **Data weryfikacji**: 2026-10-26.
- **Sprawdzono (wyszukiwanie w sieci, źródła wtórne)**: próg wieku 16 lat w RODO (art. 8) i polskie omówienia tego progu (wyniki z lat 2018-2019; treść art. 23 polskiej ustawy nie została potwierdzona); wytyczne Komisji Europejskiej dotyczące ochrony małoletnich w DSA (publikacja 14.07.2025 wg omówień prawniczych; zwolnienie mikro- i małych przedsiębiorstw wg omówień).
- **Nie sprawdzono w oficjalnych źródłach** (ISAP, EUR-Lex, UODO, EROD): art. 4, 6, 7, 8, 9, 21, 22, 25, 35 RODO (brzmienie); art. 19 i 28 DSA (brzmienie); wytyczne EDPB 05/2020 (wersja obowiązująca); wyrok CJEU C-184/20 (1.08.2022); przepis krajowy o wieku 16 lat. Każdy z tych punktów musi być sprawdzony przed zatwierdzeniem, a numery przepisów w tym dokumencie należy traktować jako wymagające weryfikacji.
- **Dane do sprawdzenia przy zatwierdzaniu**: aktualne wytyczne EDPB o zgodzie i o profilowaniu; orzecznictwo dotyczące danych pośrednio ujawniających dane art. 9.

---

## 13. Do zatwierdzenia przez prawnika-człowieka

Całość, w szczególności: klasyfikacja minut cardio i aktywności jako pośrednio danych art. 9 (sekcja 3.1, 3.3); domyślne ustawienia (sekcja 3.4); próg wieku i ograniczenia dla 16-17 (sekcja 4); odrzucenie rankingów wagi i kalorii (sekcja 5); wszystkie teksty zgód i komunikatów (sekcja 6.2); reguły LR-T1 do LR-T21 (sekcja 7); DPIA (sekcja 10); pytania otwarte (sekcja 11).
