# 012 - Redesign funkcji Team (analiza)

- **Karta zadania**: `docs/zadania/012-redesign-funkcji-team.md`
- **Etap**: 1 - Wymagania (analityk). Zero zmian w kodzie, danych, schemacie i kontraktach API. Dokument nie wybiera architektury ani wyglądu (to `architekt` i `ux`).
- **Autor**: analityk (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Trasy**: hub `/community` ("Mój Team"), strona grupy `/community/teams/[teamId]`, wojny `/community/wars`, galeria sławy `/community/hall-of-fame`, wyzwania `/community/challenges`, misje `/community/teams/[teamId]/quests`.
- **Status**: do akceptacji właściciela produktu; wejście dla `prawnik` (etap 2), potem `architekt` (3) i `ux` (4).

---

## 1. Kontekst i cel

Właściciel produktu ocenia obecną funkcję Team jako słabą: strona grupy wydaje się pusta, brakuje efektu "wow", XP i odznak nie widać jako kolekcji, a ranking w grupie nie motywuje. Celem jest uczynienie Team flagową funkcją aplikacji, która łączy społeczność i rywalizację (inspiracja: Strava i Apple Fitness).

**Główna diagnoza (po analizie kodu):** Team nie ma głównie problemu z brakiem mechanik. `lib/community/` i `db/schema.ts` zawierają już ranking tygodniowy (FCS), wojny z ligami, misje zespołu, wyzwania, galerię sławy, XP z prestiżem, reputację i odznaki. Problem to:

1. **Rozproszenie liczb.** Użytkownik ma kilka niezależnych "punktów": XP osoby (4 tory), XP grupy, XP sezonowe, reputację (RP), wynik FCS, punkty ligi wojennej (LP) i wynik HoF. Żadna z nich nie jest oczywistą walutą.
2. **Ukrycie najmocniejszych sygnałów.** XP osoby i reputacja pojawiają się głównie na `/community/challenges`. XP drużyny i sezonowe nie są renderowane wcale (brak odwołań w `components/`). Odznaki widać w galerii sławy i na profilu, a nie na co dzień.
3. **Brak pętli powrotu.** Nie ma codziennego ani tygodniowego "celu, który się zamyka", pierścienia postępu ani osobistego pojedynku. Wynik ma sens tylko dla osób, które już są aktywne.
4. **Pusty stan.** Grupa bez aktywności (świeży zespół, historia misji pusta) wygląda martwo. To klasyczny problem zimnego startu, który obecna strona pogłębia.
5. **Brak danych o użyciu w repozytorium.** Eventy PostHog (`lib/analytics/community-events.ts`) są zaplanowane, ale w repozytorium nie ma baseline'u (aktywne grupy, odsetek członków aktywnych, retencja). Bez tego nie da się potwierdzić, czy problem to pustka czy nieatrakcyjność. To pierwsza rzecz do sprawdzenia przez właściciela w PostHog.

**Cel zadania (etap 1):** ustalić nowy cel biznesowy Team, wymagania (user stories, kryteria akceptacji, reguły biznesowe), rozdzielić MVP od wizji długoterminowej i wskazać, które bramki zespołu są potrzebne.

---

## 2. Stan obecny (potwierdzone w kodzie)

### 2.1 Inwentarz funkcji

| Obszar | Co działa w kodzie | Gdzie widzi użytkownik | Luka dla celu "flagowa funkcja" |
|---|---|---|---|
| Grupy (teams) | Tworzenie, kod dołączenia, zaproszenia e-mail, publiczne/prywatne, role owner / admin / moderator / member, limit `max_members` = 50 (`lib/community/teams.ts`, `team-permissions.ts`) | `/community/teams`, strona grupy | Brak powodu, by wejść do grupy poza kodem lub zaproszeniem. |
| Tablica (feed) | Auto-posty po treningu (`team-feed-auto.ts`, dedup `source_key`), 8 typów postów, 6 reakcji (BEAST, STRONG, KING, MONSTER, PROGRESS, INSANE), komentarze jednopoziomowe, @wzmianki, SSE | Sekcja "Tablica" na stronie grupy | Auto-posty nie mają "momentu wow" (brak wyróżnienia pierwszego treningu grupy, brak gratulacji przy serii). Reakcje są bez zachęty i bez licznika. |
| Ranking w grupie | FCS 0-100 per członek, 8 komponentów (progres, regularność, plan, seria, wyzwania, social, pomoc, live), tygodniowo, cache (`fcs.ts`, `fcs-compute.ts`) | `TeamFcsLeaderboard` na stronie grupy, dla wszystkich | Wynik jest nieintuicyjny. Rozbicie pokazuje się dopiero po dotknięciu wiersza. Brak wskazówki "co zrobić, by wejść wyżej". |
| XP osoby | 4 tory (`user`, `team`, `season`, `community`), prestiż I-V, poziom 1-50 (`progression.ts`, `progression-curve.ts`) | `ProgressionCard` tylko na `/community/challenges`; poziom społeczności (`CommunityLevelBanner`) na hubie | Główny sygnał XP jest ukryty na mało odwiedzanej podstronie. |
| XP grupy i sezonowe XP | `team_xp` zasilane w 30% XP osoby, `user_season_xp` (`progression.ts` ~l.86-96) | Nie znaleziono renderowania w `components/` ani w `app/` | Zapisywane, ale niewidoczne. Dwa z czterech torów nie mają widoku. |
| Reputacja (RP) | 6 poziomów (bronze-legend), źródła (pomoc, komentarze, live, wyzwania), capy dzienne, idempotencja (`reputation.ts`) | `ReputationCard` na `/community/challenges`, `ReputationBadge` przy członkach grupy | Druga "liczba statusu" obok XP, bez wyjaśnienia różnicy. |
| Wyzwania | 6 szablonów (50 treningów, 100 km biegu, 10 000 pompek, 500 serii nóg, sezon 30 treningów, globalny tonaż 1 M kg), zakresy individual / group / seasonal / global, nagroda XP + odznaka + celebracja (`challenge-types.ts`, `challenges.ts`) | Sekcja "Wyzwania" na stronie grupy (max 3), `/community/challenges` | Pusty stan kieruje do CTA tylko dla admina. Zwykły członek nie może uruchomić wyzwania. Brak rotacji. |
| Misje zespołu (team quests) | 5 szablonów kooperacyjnych (100 treningów tygodniowo, 500 km biegu, 20 000 powtórzeń, 100 h treningu, 500 serii nóg), nagroda XP + odznaka + tytuł (`team-quests.ts`, `team-quest-types.ts`) | `/community/teams/[id]/quests`, kafel "Misje" na hubie | Wg opisu właściciela: jedna aktywna misja naraz i pusta historia. Brak automatycznej rotacji (do potwierdzenia przez `architekt`). |
| Wojny (Team Wars) | 1 na 1 między zespołami, ligi bronze-diamond (progi LP: 0 / 100 / 250 / 500 / 900), wygrana +25 LP, porażka -15, remis +5, tydzień (7 dni), kolejka (`team-wars.ts`, `team-war-types.ts`, `team-war-score.ts`) | `/community/wars`, `wars-hub` | Tylko na poziomie drużyn. Brak 1 na 1 osobistego. Brak karty "liga zespołu" na hubie. |
| Galeria sławy (HoF) | 5 okresów (tydzień, miesiąc, sezon, rok, all_time), 7 kategorii, odznaki w galerii (`hof.ts`, `hof-types.ts`) | `/community/hall-of-fame` | Dla nowego użytkownika pusta lub niezrozumiała. Wymaga historii. |
| Odznaki | `user_badges` z wyzwań i misji (`challenges.ts`, `team-quests.ts`), widoczne w galerii, na profilu `u/[userId]` i w szczegółach wyzwania | Galeria sławy, profil, szczegóły wyzwania | Brak katalogu z progresem ("zablokowane"), brak rzadkości, brak miejsca "moja kolekcja" na co dzień. |
| Serie (streak) | Składnik FCS (tygodnie z co najmniej 1 treningiem / 8), typ posta `streak` | Tylko jako komponent rozbicia FCS i w feedzie | Seria nie jest pokazana jako licznik i nie ma nagrody za jej długość. |
| Live trening grupowy | Sesja grupowa, presence, widżet, czat treningu | Sekcja "Aktywne treningi" na stronie grupy, widżet | Działa. Znany problem IDOR w presence (audyt HIGH) trzeba zamknąć przed rozszerzaniem. |
| Znajomi i podgląd treningu | Friendships, mutual share, `friend_live_presence` | `/community/friends`, `/community/friends/[id]/live` | Poza Team. Brak rywalizacji 1 na 1 ze znajomym. |
| Powiadomienia | 9 rodzajów, grupowanie (`group_key`, okno ~2 h) | `/community/notifications`, dzwonek | Brak danych, jak są używane. Brak powiadomienia "wyprzedzono cię w rankingu". |
| Analityka | Eventy `community_*` zaplanowane w `lib/analytics/community-events.ts` | PostHog (poza repo) | Brak baseline'u i dashboardu w repozytorium. |

### 2.2 Model danych - ograniczenia

- **Pięć i więcej liczb rankingowych** (XP ×4 tory, RP, FCS, LP wojen, wynik HoF) bez wspólnej hierarchii. Każda ma własną tabelę (`progression_xp_ledger`, `user_reputation`, `team_fcs_scores`, `team_war_stats`, `hof_awards`). To jest źródło wrażenia "nic nie wiem".
- **Brak katalogu odznak.** `user_badges` przechowuje tylko zdobyte odznaki. Nie ma definicji katalogu, progresu i liczby zdobywców, więc rzadkość nie może być policzona bez agregacji po całej tabeli.
- **Brak tygodniowego "pierścienia" osobistego.** Cel cardio (domyślnie 150 min) i liczba treningów z onboardingu istnieją w `user_settings`, ale nie są łączone w jedną wizualizację społeczną.
- **Brak osobistego 1 na 1.** Wojny są tylko drużynowe. Znajomi nie mają tygodniowego pojedynku.
- **Definicja tygodnia.** Cardio dziś liczy kroczące 7 dni (`lib/cardio.ts`). Decyzja D9 wymaga tygodnia pon-nd (także w Javie). Pierścienie i rankingi muszą czekać na tę zmianę albo ją współdzielić.
- **Ścieżka zapisu treningu.** Auto-posty i XP są wywoływane z `app/api/workouts/complete/route.ts` (TypeScript). W `java-backend/` `WorkoutController` obsługuje `POST /api/workouts/complete`, ale w kodzie Javy nie ma żadnej logiki feedu, XP ani reputacji (sprawdzone wyszukiwaniem). Jeśli produkcja kieruje zapis przez Javę (D5 nieznane), auto-posty i XP po treningu nie powstają. To najważniejsze ryzyko techniczne dla tej funkcji (sekcja 11).

### 2.3 Co już działa dobrze (zachować)

- **FCS** jest uczciwą metryką: capy zdarzeń społecznych (`capEvents`, 20), newcomer boost, komponenty względne do siebie. Zmieniamy prezentację, nie algorytm.
- **Wojny z ligami i kolejką** to gotowy szkielet "drabiny" (bronze do diamond). Brakuje widoczności, nie logiki.
- **Auto-posty po treningu** z deduplikacją (`source_key`) i reakcjami w feedzie.
- **Misje kooperacyjne** są dobre dla grup o różnym poziomie: cel wspólny, nie tylko dla liderów.
- **Idempotencja i capy** (`sourceKey` UNIQUE, dzienne capy RP) chronią przed farmieniem i podwójnym naliczeniem.
- **Prywatność grup** (public/private, kod, zaproszenia) jest już zaprojektowana.

---

## 3. Analiza konkurencji

Źródła: wyszukiwanie w sieci z 2026-10-26 oraz wiedza zespołu. Części szczegółów (np. zasady punktacji Apple, zasady płatnych leaderboardów Strava) źródła nie potwierdzają jednoznacznie. Oznaczono je jako **do weryfikacji**. Zwift i Peloton nie były weryfikowane w tej sesji i zostały pominięte poza krótką uwagą na końcu.

### 3.1 Strava

| Mechanika | Co buduje | Czy przenieść do siłowni (trening + cardio) | Uzasadnienie |
|---|---|---|---|
| Segmenty z rankingiem czasu (KOM/QOM) | Rywalizacja o ten sam odcinek przez wszystkich | **Częściowo**: ranking per ćwiczenie w grupie, oparty na progresie względnym (e1RM względem własnego najlepszego), nie na absolutnym ciężarze | Siłownia nie ma "odcinka" z czasem. Absolutny ranking ciężarów wyklucza początkujących i zachęca do ryzykownych wyborów. Tytuł "króla" odrzucamy. |
| Kudos (polubienie z uznaniem) | Lekkie uznanie jednym dotknięciem | **Tak, już działa** (6 reakcji w feedzie). Dodać automatyczne gratulacje przy PR i przy długiej serii | Nie trzeba nowego mechanizmu. |
| Wyzwania z odznaką po ukończeniu, grupowe (wg źródeł do 24 osób) | Stały powód do aktywności i poczucie zamknięcia | **Tak, rozszerzyć o cykl tygodniowy** z rotacją szablonów i widocznym postępem grupy | Wyzwania istnieją, brakuje harmonogramu i widoczności na co dzień. |
| Local legend (tytuł za regularność na odcinku) | Lokalna tożsamość i powracający użytkownicy | **Tak, jako tytuł tygodniowy** ("Lider tygodnia", już w FCS), nie tytuł dożywotni | Dożywotni tytuł blokuje nowych członków. |
| Zasady płatnego dostępu do leaderboardów | - | **Nie opieramy decyzji na tym** (źródła są sprzeczne) | Decyzja o monetyzacji podjęta niezależnie (sekcja 5.4). |

### 3.2 Apple Fitness (Activity, pierścienie, zawody)

| Mechanika | Co buduje | Czy przenieść | Uzasadnienie |
|---|---|---|---|
| Pierścienie (ruch, ćwiczenia, stanie) | Jeden czytelny cel dzienny, postęp widoczny na pierwszym ekranie | **Tak, 2 pierścienie**: trening (realizacja celu tygodniowego z onboardingu) i cardio (150 min w tygodniu pon-nd, D9) | Trzy pierścienie to za dużo na start. Cel pod żywienie odrzucamy (sekcja 3.3). |
| Zawody tygodniowe 1 na 1 ze znajomym (7 dni, punkty za zamknięcie celu, wg przewodników do 600 pkt dziennie) | Najsilniejsza pętla społeczna Apple: osobisty rywal, tydzień, wynik | **Tak, najbardziej brakujący element** (do wersji 1.1). Punktacja oparta na wypełnianiu celu, nie na absolutnej ilości | Pozwala wygrać osobie początkującej. Rywalizacja ze znajomym jest bardziej osobista niż w drużynie 50 osób. |
| Odznaki za rekordy (kształt koła) i za serie / wyzwania (sześciokąt) | Czytelne typy nagród, kolekcja | **Tak**: 2 kategorie (rekord, seria) w katalogu odznak, z progresem | Różne kształty lub ikony wspierają odróżnianie typów bez koloru. |
| Wyzwania miesięczne dopasowane do poziomu aktywności | Wyzwanie jest osiągalne, ale wymagające | **Tak**: rotacja wyzwań z progami zależnymi od poziomu członka (np. 3 vs 5 treningów tygodniowo) | Jeden próg dla wszystkich zniechęca początkujących. |

### 3.3 Co odrzucić

- **Pierścień lub wynik związany z kaloriami, makro albo wagą ciała.** Dane żywieniowe i masa ciała to dane wrażliwe (`docs/prawo/00-inwentaryzacja-danych.md`). Rywalizacja o dietę zwiększa ryzyko presji na sylwetkę i zaburzeń odżywiania. Do rankingów i odznak nie wchodzą.
- **Absolutny ranking ciężarów.** Eliminuje osoby początkujące i zachęca do ryzykownych ciężarów. Dopuszczamy tylko progres względny.
- **Ranking i segmenty GPS.** Model cardio nie zawiera trasy GPS (cardio = minuty, tętno, kalorie, zdjęcie urządzenia). Segmenty GPS nie mają podstawy w danych.
- **Tytuły "króla" i dożywotnie.** Blokują nowych członków i zmniejszają motywację większości.

### 3.4 Wnioski z konkurencji

1. Rywalizacja w małej grupie (3-10 osób) działa lepiej niż globalna. GymBrat ma już grupy, więc to naturalna przewaga.
2. Najsilniejsza pętla to: **cel osobisty (pierścień) -> tygodniowe zawody 1 na 1 -> odznaka**. W GymBrat brakuje jej w całości.
3. Jedna czytelna waluta (XP) i jeden wynik tygodniowy są ważniejsze niż kilka liczb w tle.
4. Rywalizacja ma być względna i opcjonalna. W siłowni ryzyko kontuzji i presji wagi jest realne.

---

## 4. Interesariusze

| Rola | Cel | Co zyskuje z Team |
|---|---|---|
| Osoba ćwicząca (początkująca) | Mieć powód, by wrócić w tym tygodniu i nie czuć się gorsza | Tygodniowy cel, progres względny, pierwsze odznaki, widoczne postępy |
| Osoba ćwicząca (zaawansowana) | Porównać się z ekipą, znaleźć rywala, zdobyć uznanie | Ranking, wojny, pojedynki 1 na 1 (v1.1), kolekcja i rzadkość odznak |
| Członek grupy (mało aktywny) | Nie wypaść z grupy i wiedzieć, co zrobić | Czytelny wynik grupy, wskazówka "co dodać", bez publicznego wstydu |
| Właściciel / admin grupy | Utrzymać zespół, uruchamiać wyzwania, rozumieć aktywność | Prosty panel "co dzieje się w grupie", rotacja misji bez ręcznej pracy |
| Użytkownik solo | Dostać powód do społeczności bez obowiązku udziału | Zaproszenie do grupy, opcjonalna widoczność |
| Właściciel produktu | Retencja tygodniowa, wzrost przez polecenie, spójność z resztą aplikacji | Mierzalny wpływ na powroty i zaproszenia |
| Administrator platformy | Bezpieczeństwo, koszty, brak nadużyć | Limity, moderacja, brak danych wrażliwych w rankingach |

Poza zakresem: trener i CRM trener-podopieczny (`PRODUCT_FOCUS = "b2c"`, `lib/product-strategy.ts`).

---

## 5. Cel biznesowy funkcji Team (propozycja)

### 5.1 Cel nadrzędny

**Team jest głównym powodem powrotu do aplikacji w ciągu tygodnia i głównym kanałem wzrostu przez zaproszenia.** Osoba ćwicząca wie, co ma zrobić w tym tygodniu, i widzi, że jej wysiłek ma wynik w oczach innych.

### 5.2 Problem użytkownika

Osoba ćwicząca samodzielnie często traci motywację po kilku tygodniach. Nie ma "dla kogo" ćwiczyć, nie widzi swojego postępu w porównaniu z ludźmi o podobnym poziomie i nie wie, czy jej wynik ma znaczenie poza nią samą.

### 5.3 Problem biznesowy

- Retencja tygodniowa i po 30 dniach zależy od nawyku. Aplikacja ma wiele narzędzi jednoosobowych (dieta, raporty ciała, analiza), ale społeczność nie daje tygodniowego powodu do wejścia.
- Wzrost organiczny (polecenie) wymaga, by członkowie chcieli zaprosić kolegów. Dziś nie ma do tego powodu.
- Nie ma danych w repozytorium, więc nie wiadomo, czy problem to pustka (cold start), czy niska atrakcyjność.

### 5.4 Hipoteza (do zweryfikowania na baseline'ie)

> Użytkownik, który należy do grupy z co najmniej 3 osobami aktywnymi w tygodniu i widzi swój tygodniowy wynik względem tych osób oraz swój cel tygodniowy, ma wyższą retencję tygodniową niż użytkownik solo o podobnym poziomie aktywności.

**Założenie:** hipoteza jest robocza. Potwierdzenie wymaga baseline'u z PostHog (sekcja 12.4).

### 5.5 Metryki (proponowane)

| Kod | Metryka | Definicja | Rola |
|---|---|---|---|
| M1 | Retencja tygodniowa członków | Odsetek członków aktywnych w tygodniu N, którzy są aktywni w tygodniu N+1; porównanie z użytkownikami solo | Główna |
| M2 | Aktywacja społeczna | Odsetek nowych kont, które dołączają do grupy w ciągu 7 dni od rejestracji | Wspierająca |
| M3 | Zaangażowanie | Średnia liczba treningów i minut cardio tygodniowo na członka aktywnej grupy vs solo | Wspierająca |
| M4 | Wzrost przez polecenie | Zaproszenia zaakceptowane na grupę (e-mail, kod) na grupę tygodniowo | Wspierająca |

Cele liczbowe (np. "+X p.p. retencji") **nie są podane w tym dokumencie**. Zostaną ustalone po 4 tygodniach baseline'u, gdy właściciel potwierdzi dane w PostHog.

**Guardrails (nie mogą się pogorszyć):**
- odsetek opuszczeń grupy w ciągu 7 dni od dołączenia,
- liczba zgłoszeń i ukryć treści w feedzie,
- liczba skarg dotyczących prywatności (cel: zero),
- czas otwarcia strony grupy (SLO do ustalenia przez `tester-wydajnosci`),
- liczba treningów solo (rywalizacja nie może odciągać od treningu w ogóle).

### 5.6 Model monetyzacji

Stan w kodzie (`lib/admin-config-status.ts`, `docs/analiza/00-mapa-produktu.md` sekcja 3): pakiety 7 / 30 / 90 / 365 dni dają **brak reklam** (`showAds` w `/api/package/status`). Reklamy są bramką dla kont bez pakietu, ale AdMob nie jest skonfigurowany (D24), więc przychód z reklam wynosi zero. Pakiet nie ma dziś innego wyróżnika niż brak reklam.

**Rekomendacja analityka:**

1. **Team pozostaje darmowy w całości w v1**, łącznie z rankingiem, wojnami, misjami, odznakami i pojedynkami. Blokada rywalizacji za pakietem psuje efekt sieciowy (grupa działa, gdy wszyscy biorą udział) i tworzy wrażenie "pay-to-win" w rankingu.
2. Team jest **dźwignią retencji i akwizycji**, nie bezpośrednim przychodem. Jego wartość dla pakietu to mniejsza liczba opuszczeń i większy udział w zaproszeniach, co pośrednio zwiększa wartość konta.
3. Wyróżniki pakietu bez przewagi (kosmetyka: ramki i aury, które już są w modelu `user_cosmetics`; większe limity grupy) mogą wejść w przyszłości. Decyzja: właściciel, D10 (sekcja 12).

---

## 6. Założenia

- **Z1** Trasy zostają: `/community` (hub), `/community/teams/[id]` (grupa), `/community/wars`, `/community/hall-of-fame`, `/community/challenges`. Nowe trasy tylko po uzasadnieniu `architekt`.
- **Z2** XP pozostaje jedyną widoczną "walutą" postępu osoby i grupy. RP, FCS, LP wojen i wynik HoF zostają w swoich rolach, ale nie są prezentowane jako równorzędne "punkty" w hubie.
- **Z3** Ranking w grupie opiera się na FCS, bez zmiany algorytmu (`fcs.ts`). Zmieniamy tylko prezentację i wskazówki.
- **Z4** Tydzień w rywalizacji to poniedziałek-niedziela (D9), wspólnie dla cardio, pierścieni, rankingu i misji. Do czasu wdrożenia D9 architekt decyduje o tymczasowym rozwiązaniu.
- **Z5** Rywalizacja domyślnie obejmuje tylko członków grupy. Widoczność poza grupą wymaga świadomego wyboru użytkownika (sekcja 12, Q3, `prawnik`).
- **Z6** Dane w rankingach, odznakach i pierścieniach to wyłącznie: liczba treningów, dni z treningiem, minuty cardio, progres względny e1RM i tonażu oraz serie tygodni. Bez masy ciała, obwodów, zdjęć, tętna, kalorii i makroskładników (BR-3).
- **Z7** Brak nowych zmiennych środowiskowych i nowych usług zewnętrznych w MVP. Jeśli `architekt` zaproponuje harmonogram (cron) lub kolejkę, wpis w `lib/admin-config-status.ts` i `env.example`.
- **Z8** Android działa w WebView na tych samych stronach; zmiany UI są zmianami w aplikacji. Bez zmian w `/api/android/*`.
- **Z9** Java backend nie obsługuje społeczności. Ścieżka zapisu treningu przez Javę wymaga jawnego rozstrzygnięcia (sekcja 11, pkt 1).
- **Z10** Brak danych o aktywnych grupach w repozytorium. Liczby w sekcji 2 opisują możliwości kodu, nie realne użycie.

---

## 7. User stories i kryteria akceptacji

Format: "Jako <rola> chcę <cel>, aby <korzyść>". Kryteria Given / When / Then. Priorytet MoSCoW. Numeracja US-x, kryteria AC-x.y.

### Epik E1 - Hub grupy "Dziś w zespole" (MVP)

**US-1 Wynik tygodnia na jednym ekranie (Must)**
Jako członek grupy chcę zobaczyć na stronie grupy, gdzie jestem w tygodniowym rankingu i ile brakuje do osoby wyżej, aby wiedzieć, co zrobić w tym tygodniu.

- AC-1.1: Given jestem członkiem grupy z co najmniej 2 aktywnymi osobami, When otwieram stronę grupy, Then widzę swoje miejsce w tygodniowym rankingu, wynik w jednej liczbie i jedną wskazówkę tekstową (np. "Brakuje 1 treningu do 2. miejsca").
- AC-1.2: Given rozbicie FCS, When dotknę swojego wiersza, Then widzę 8 komponentów z opisem po polsku, a komponenty są wyjaśnione jednym zdaniem.
- AC-1.3 (brzeg - pierwszy tydzień grupy, 1 osoba): Given grupa ma tylko mnie, When otwieram stronę, Then zamiast pustego rankingu widzę zaproszenie do dołączenia członków (kod, e-mail), a nie wartość "0".
- AC-1.4 (brzeg - zmiana strefy czasowej w niedzielę 23:50): Given trening zakończony w niedzielę o 23:50 czasu lokalnego, When liczony jest tydzień, Then trafia do tygodnia zgodnego z datą lokalną zapisaną w treningu.

**US-2 Mój poziom i poziom grupy widoczne na co dzień (Must)**
Jako członek grupy chcę widzieć swój poziom XP i poziom grupy na stronie grupy i w hubie, aby czuć postęp bez wchodzenia do ukrytych podstron.

- AC-2.1: Given mam XP, When otwieram hub lub stronę grupy, Then widzę poziom osoby, pasek do następnego poziomu i poziom grupy.
- AC-2.2: Given XP grupy rośnie po treningu członka, When odświeżę stronę, Then poziom grupy zgadza się z sumą zapisanych zdarzeń (`team_xp`, bez podwójnego naliczenia).
- AC-2.3 (brzeg - trening w outbox offline): Given trening zapisany offline, When synchronizacja się powiedzie, Then XP i wpis w tablicy pojawiają się raz, nie dwa razy.
- AC-2.4 (brzeg - dwa urządzenia): Given ten sam trening zapisany z dwóch urządzeń, When naliczane jest XP, Then naliczenie jest idempotentne (`sourceKey`), a licznik nie rośnie dwukrotnie.

**US-3 Pierścienie tygodnia (Should, MVP v1.1 jeśli zabraknie czasu)**
Jako osoba ćwicząca chcę zobaczyć dwa pierścienie tygodnia (trening i cardio), aby jednym rzutem oka wiedzieć, ile mi brakuje.

- AC-3.1: Given cel treningów z onboardingu (np. 4 tygodniowo) i cel cardio (150 min), When wykonam 2 treningi i 60 min cardio, Then pierścień treningu pokazuje 50%, a pierścień cardio 40%.
- AC-3.2: Given pierścień zamknięty, When wykonam cel, Then dostaję jedno zdarzenie w tablicy i w powiadomieniach (bez duplikatu przy ponownym otwarciu).
- AC-3.3 (brzeg - brak celu w profilu): Given użytkownik nie ustawił celu treningów, When otwieram pierścienie, Then widzę domyślny cel z dokumentacji i link do ustawień, bez błędu.
- AC-3.4 (brzeg - cardio przed zmianą D9): Given cardio z poprzedniego tygodnia kroczącego, When liczony jest pierścień po wdrożeniu D9, Then wynik jest zgodny z tygodniem pon-nd (bez rozjazdu z rankingiem).

**US-4 Seria tygodni (Should)**
Jako osoba ćwicząca chcę widzieć swoją serię tygodni z treningiem, aby mieć powód, by jej nie przerywać.

- AC-4.1: Given trening w każdym z ostatnich 3 tygodni, When otwieram hub, Then widzę licznik "3 tygodnie z treningiem" z jasną definicją (co najmniej 1 trening w tygodniu pon-nd).
- AC-4.2 (brzeg - przerwa w tygodniu bez treningu): Given brak treningu w bieżącym tygodniu do dnia dzisiejszego, When otwieram hub, Then licznik nie zeruje się przed końcem tygodnia i pokazuje komunikat "Zrób dziś trening, by utrzymać serię".
- AC-4.3 (brzeg - trening przerwany w połowie): Given sesja przerwana i niezakończona, When liczona jest seria, Then sesja się nie liczy (zgodnie z BR-1 historii treningów).

### Epik E2 - Kolekcja odznak i nagrody (MVP)

**US-5 Katalog odznak z progresem (Must)**
Jako osoba ćwicząca chcę zobaczyć katalog wszystkich odznak z informacją, które zdobyłam i ile mi brakuje do pozostałych, aby mieć czytelny cel do zebrania.

- AC-5.1: Given katalog 20+ odznak (wyzwania, misje, galeria sławy), When otwieram kolekcję, Then widzę zdobyte odznaki i zablokowane z progresem (np. "37/50 treningów").
- AC-5.2: Given odznaka zdobyta, When otwieram kolekcję, Then pokazuje datę zdobycia i źródło (wyzwanie, misja, galeria).
- AC-5.3 (brzeg - nowy użytkownik bez odznak): Given zero odznak, When otwieram kolekcję, Then widzę katalog z pierwszą sugerowaną odznaką (np. "Pierwszy trening") zamiast pustego ekranu.
- AC-5.4 (brzeg - usunięty trening): Given odznaka zdobyta na podstawie treningu, którego potem nie ma w historii, When otwieram kolekcję, Then odznaka pozostaje (zdobycie jest trwałe), a zmiana zasad nie odbiera jej bez decyzji właściciela.

**US-6 Rzadkość odznak (Should)**
Jako osoba ćwicząca chcę widzieć, jak rzadka jest moja odznaka, aby czuć wyjątkowość zdobycia.

- AC-6.1: Given odznaka zdobyta przez co najmniej N osób (np. 20), When pokazuję kolekcję, Then obok widzę procent zdobywców ("zdobyło 4%").
- AC-6.2 (brzeg - mało użytkowników): Given odznaka zdobyta przez mniej niż N osób, When pokazuję kolekcję, Then nie pokazuję procentu (żeby nie ujawnić liczby użytkowników w małej skali).
- AC-6.3: Given rzadkość liczona w tle, When kolekcja jest otwierana często, Then wynik pochodzi z cache lub agregacji, nie ze skanu tabeli przy każdym wejściu (sekcja 12).

**US-7 Nagroda za tygodniową misję grupy (Must)**
Jako członek grupy chcę, aby po ukończeniu misji zespołu każdy członek dostał odznakę i XP, aby wspólny wysiłek był widoczny i nagradzany.

- AC-7.1: Given misja zespołu ukończona, When cel osiągnięty, Then każdy aktywny członek w okresie misji dostaje odznakę i XP raz (idempotencja).
- AC-7.2 (brzeg - członek opuścił grupę w trakcie misji): Given członek odszedł przed ukończeniem, When misja zostaje ukończona, Then nagroda należy się tylko członkom, którzy byli aktywni w okresie misji (reguła do potwierdzenia przez `architekt`, BR-7).
- AC-7.3 (brzeg - dwa zespoły ukończą tę samą misję): Given dwa zespoły ukończą misję tego samego dnia, When zapisywane są nagrody, Then każdy zespół dostaje własną nagrodę bez kolizji.

### Epik E3 - Rytm i rywalizacja (MVP + v1.1)

**US-8 Tygodniowa rotacja misji i wyzwań (Must)**
Jako członek grupy chcę, aby w grupie zawsze była aktywna misja lub wyzwanie na bieżący tydzień, aby zespół miał powód do treningu w każdym tygodniu.

- AC-8.1: Given żadna misja nie jest aktywna, When zaczyna się tydzień pon-nd, Then system proponuje lub uruchamia misję z puli szablonów bez ręcznej akcji admina (sposób uruchomienia do decyzji `architekt`).
- AC-8.2: Given misja trwa, When zmienia się tydzień, Then poprzednia misja trafia do historii z wynikiem, a nowa startuje.
- AC-8.3 (brzeg - grupa z 1 członkiem): Given grupa ma 1 członka, When startuje misja zespołowa, Then misja jest dostępna, ale oznaczona jako "wymaga większej grupy" lub dostosowana do liczby członków (decyzja `ux`).

**US-9 Wyzwanie dopasowane do poziomu (Should)**
Jako początkująca osoba ćwicząca chcę wyzwanie z progiem dla mojego poziomu, aby mieć realny cel.

- AC-9.1: Given poziom aktywności z ostatnich 4 tygodni, When wybieram wyzwanie, Then widzę dwa progi (np. 3 i 5 treningów tygodniowo) z wyjaśnieniem.
- AC-9.2 (brzeg - brak historii): Given brak danych o aktywności, When wybieram wyzwanie, Then domyślny najniższy próg.

**US-10 Pojedynek 1 na 1 ze znajomym (Should, v1.1)**
Jako osoba ćwicząca chcę wyzwać znajomego na tydzień, aby mieć osobistego rywala.

- AC-10.1: Given znajomy z relacją accepted, When wyślę wyzwanie, Then druga strona dostaje powiadomienie i może je zaakceptować lub odrzucić.
- AC-10.2: Given pojedynek trwa 7 dni, When obie strony mają wynik, Then wygrywa osoba z wyższym wynikiem względnym (procent celu, nie wartość bezwzględna), a remis jest możliwy.
- AC-10.3 (brzeg - zerwana znajomość w trakcie pojedynku): Given znajomość zerwana, When trwa pojedynek, Then pojedynek kończy się bez wyniku i bez naliczenia nagrody.
- AC-10.4 (brzeg - dwa urządzenia): Given zaakceptowanie z dwóch urządzeń, When wysyłane są dwa żądania, Then powstaje jeden pojedynek.

**US-11 Wojny zespołów widoczne w hubie (Should)**
Jako członek grupy chcę widzieć ligę mojego zespołu i próg do następnej ligi na hubie, aby wiedzieć, ile brakuje do awansu.

- AC-11.1: Given zespół w lidze silver z 120 LP, When otwieram hub, Then widzę ligę, LP i próg 250 do gold.
- AC-11.2 (brzeg - zespół bez wojen): Given zespół nie grał, When otwieram hub, Then widzę ligę bronze i komunikat, jak dołączyć do kolejki.

### Epik E4 - Społeczność i powiadomienia (keep + rozszerzenie)

**US-12 Gratulacje w tablicy (Should)**
Jako członek grupy chcę, aby osiągnięcia (PR, długa seria, zamknięty pierścień) były uczczone w tablicy, aby mieć publiczne uznanie.

- AC-12.1: Given rekord w treningu, When trening zakończony, Then auto-post z typem `personal_record` (istniejący) dostaje oznaczenie "gratulacje" i jedną reakcję zachęty (bez duplikatu).
- AC-12.2 (brzeg - spam): Given wiele rekordów w jednym treningu, When publikowane są posty, Then jest jeden post zbiorczy (limit liczby auto-postów na trening).

**US-13 Powiadomienia o zmianie pozycji i odznace kolegi (Should)**
Jako członek grupy chcę dostać powiadomienie, gdy ktoś mnie wyprzedził w rankingu albo zdobył odznakę, aby wrócić do aplikacji.

- AC-13.1: Given wyprzedzenie w rankingu tygodniowym, When zmiana zostaje zapisana, Then powiadomienie trafia do wyprzedzonego (raz w tygodniu, bez floodu).
- AC-13.2 (brzeg - ustawiona opcja "ukryj w rankingu"): Given użytkownik ukrył się w rankingu, When zmienia się pozycja, Then nie dostaje powiadomień o pozycji ani nie wysyła ich nikomu.
- AC-13.3: Given wiele zdarzeń w krótkim oknie, When powstają powiadomienia, Then grupowanie `group_key` łączy je w jedno (istniejący mechanizm).

**US-14 Reakcje i komentarze (Keep, bez zmian w MVP)**
Jako członek grupy chcę reagować i komentować, aby wyrazić uznanie.

- AC-14.1: Given istniejący mechanizm reakcji (6 typów, jedna na użytkownika), When reaguję, Then zachowanie pozostaje bez zmian (kontrakt `team_post_reactions`).
- AC-14.2 (brzeg - farmienie reakcji): Given wielokrotne reakcje na cudze posty, When liczony jest FCS, Then obowiązuje istniejący cap zdarzeń (20).

### Epik E5 - Prywatność i widoczność (Must)

**US-15 Kontrola widoczności wyniku (Must)**
Jako osoba ćwicząca chcę decydować, czy moje wyniki są widoczne w grupie i poza nią, aby mieć kontrolę nad danymi o aktywności.

- AC-15.1: Given nowe konto, When dołączam do grupy, Then wynik jest widoczny tylko dla członków grupy (domyślnie, Z5), a ustawienie poza grupą jest wyłączone, dopóki nie zdecyduję inaczej.
- AC-15.2: Given ukryłem się w rankingu grupy, When grupa wyświetla ranking, Then mój wiersz nie pojawia się, a mój wynik nie jest liczony w średnich grupy (do potwierdzenia, `prawnik`, sekcja 12, Q3).
- AC-15.3 (brzeg - wyjście z grupy): Given opuszczam grupę, When wyjście jest zapisane, Then moje wyniki znikają z rankingu i tablicy poza treściami już opublikowanymi (retencja postów do decyzji `prawnik`).
- AC-15.4 (brzeg - użytkownik 16-17 lat): Given konto w wieku 16-17 lat (po wdrożeniu D18), When dołączam do grupy publicznej, Then widoczność domyślnie tylko dla członków grupy, bez globalnego ujawnienia (`prawnik`).

**US-16 Rywalizacja względna, nie wykluczająca (Must)**
Jako początkująca osoba ćwicząca chcę, aby ranking mierzył mój progres, a nie absolutną siłę, aby nie czuć się gorsza od zaawansowanych.

- AC-16.1: Given ranking grupy, When liczę wynik, Then progres jest względem własnego poprzedniego tygodnia i własnego historycznego najlepszego (istniejące komponenty FCS).
- AC-16.2: Given ranking ćwiczenia (Could), When pokazuję rekordy, Then nie zawiera ciężarów bezwzględnych członków, tylko względny wzrost.

---

## 8. Reguły biznesowe

- **BR-1 Jedna widoczna waluta postępu.** Osoba widzi XP (własne i grupy) jako główny licznik. RP, FCS, LP wojen i wynik HoF pozostają w swoich rolach; nie są sumowane w jedną liczbę.
- **BR-2 Ranking tygodniowy oparty na FCS.** Wynik i rozbicie zgodne z `lib/community/fcs.ts`. Zmiana algorytmu wymaga osobnej decyzji (wpływa na wojny i HoF).
- **BR-3 Dane dozwolone w rankingach, odznakach i pierścieniach.** Liczba treningów, dni z treningiem, minuty cardio, progres względny e1RM i tonażu, serie tygodni. Zabronione: masa ciała, obwody, zdjęcia, tętno, kalorie, makroskładniki, wartości w gramach bez kontekstu względnego.
- **BR-4 Tydzień = poniedziałek-niedziela** według daty lokalnej zapisanej w treningu (D9). Wspólnie dla pierścieni, rankingu, misji i serii.
- **BR-5 Idempotencja nagród.** Każde zdarzenie XP, RP i odznaki ma unikalny klucz źródłowy. Ponowny zapis treningu, sync offline lub drugie urządzenie nie tworzą duplikatu.
- **BR-6 Capy anty-farmingowe.** Dzienne capy RP i limit zdarzeń społecznych w FCS (20) pozostają bez zmian. Nowe mechanizmy (pierścienie, gratulacje) mają własne capy.
- **BR-7 Nagroda za misję tylko dla członków aktywnych w okresie misji.** Członek, który opuścił grupę przed końcem, nie dostaje nagrody (do potwierdzenia przez `architekt` i `prawnik`, AC-7.2).
- **BR-8 Pakiet nie daje przewagi w rywalizacji.** Żaden element rankingu, wojen, misji ani odznak nie zależy od pakietu (sekcja 5.6). Kosmetyka może być wyróżnikiem bez wpływu na wynik.
- **BR-9 Widoczność domyślnie wąska.** Wynik widoczny w grupie; poza grupą tylko po świadomym wyborze. Obecne domyślne ustawienia profilu (`userSocialProfiles`: `visibility = friends`, `showOnGlobal = 1`, `discoverable = 1`) wymagają oceny `prawnik` przed zmianą (sekcja 12, Q3).
- **BR-10 Opt-out z rankingu bez utraty członkostwa.** Ukrycie w rankingu nie usuwa z grupy, nie blokuje czatu ani feedu.
- **BR-11 Nieodwracalność zdobytej odznaki.** Odznaka zdobyta raz zostaje, nawet jeśli zmienią się zasady lub szablony (decyzja właściciela przed zmianą).
- **BR-12 Brak rywalizacji o wagę i dietę.** Pierścienie i rankingi nie zawierają celów kalorycznych ani makro, ani rankingu masy ciała (uzasadnienie: dane wrażliwe, ryzyko presji żywieniowej).

---

## 9. Zakres: MVP, v1.1, wizja

Kolumna "Bazuje na" wskazuje istniejący moduł, co wymusza zasadę "rozszerzaj, nie twórz równoległych rozwiązań" z `AGENTS.md`.

| Pozycja | Priorytet | Bazuje na (istnieje) | Nowe w MVP |
|---|---|---|---|
| Hub grupy "Dziś w zespole": miejsce w rankingu, wskazówka, aktywna misja/wyzwanie z progresem (US-1, US-8) | Must | `team-detail-view.tsx`, `fcs.ts` (rozbicie), `team-quests.ts` | Nowa prezentacja i agregat w cache |
| Widoczny XP osoby i grupy na stronie grupy i hubie (US-2) | Must | `progression.ts`, `team_xp`, `ProgressionCard` | Przeniesienie prezentacji z `/challenges`; bez nowej waluty |
| Katalog odznak z progresem (US-5) | Must | `user_badges`, definicje w `challenge-types.ts` i `team-quest-types.ts` | Katalog definicji i widok kolekcji (decyzja `ux` co do miejsca) |
| Nagroda odznaką za misję dla wszystkich aktywnych członków (US-7) | Must | `team-quests.ts`, `progression.ts` | Zasada członków aktywnych (BR-7) |
| Rotacja tygodniowych misji i wyzwań (US-8) | Must | szablony misji (5) i wyzwań (6) | Harmonogram (sposób do decyzji `architekt`) |
| Kontrola widoczności wyniku (US-15, BR-9, BR-10) | Must | `userSocialProfiles`, `teams.ts` (privacy) | Ustawienie "ukryj w rankingu" i nowe domyślne; wymaga `prawnik` |
| Ranking względny, bez ciężarów bezwzględnych (US-16, BR-3, BR-12) | Must | `fcs.ts` | Zasada prezentacji i weryfikacja danych w rankingach |
| **Zgoda lidera na udostępnienie ducha treningowego (US-21, BR-13, BR-14)** | **Must** | `lib/ghost-training/targets.ts` (ścieżka `leader`) | **Naprawa defektu prywatności** (sekcja 17.2): flaga zgody + payload ograniczony do progresu względnego. Warunek wstępny przed szerszym użyciem ducha w hubie. |
| Pierścienie tygodnia: trening i cardio (US-3) | Should (MVP jeśli czas) | `user_settings` (cel cardio, cel treningów), `lib/cardio.ts` (po D9) | Widget i reguła celu |
| Seria tygodni (US-4) | Should | komponent `streak` w FCS, post `streak` | Licznik i komunikat |
| Gratulacje w tablicy (US-12) | Should | `team_posts` typ `personal_record`, reakcje | Oznaczenie i limit zbiorczy |
| Powiadomienia o wyprzedzeniu i odznace kolegi (US-13) | Should | `notifications.ts`, `group_key` | Nowy rodzaj zdarzenia |
| **Cotygodniowe podsumowanie (US-20)** | **Should** | wzorzec leniwej rotacji (ADR 0011), `notifications.ts` | **Nowy rodzaj powiadomienia `weekly_digest`, bez migracji (kolumna `kind` to wolny tekst)** |
| **Odznaka za pierwszy wspólny trening grupowy (US-19)** | **Could** | `group-workout.ts`, `user_badges` | **Nowe zdarzenie nagrody po zakończeniu sesji grupowej (idempotentnie po `sourceKey`)** |
| Wyzwanie dopasowane do poziomu (US-9) | Should | szablony wyzwań, `challenges.ts` | Progi zależne od poziomu |
| Liga zespołu na hubie (US-11) | Should | `team-wars.ts`, `wars-hub` | Karta na hubie |
| Rzadkość odznak (US-6) | Should | `user_badges` | Agregacja z progiem N i cache |
| **Pojedynek 1 na 1 ze znajomym przez ducha (US-10, US-17, US-18)** | Should (v1.1) | `friendships.ts`, **`lib/ghost-training/` (deltas, predict) — rozszerzenie zamiast nowego systemu (sekcja 17.3)** | Tabela pojedynków, rozliczenie XP (BR-15), nowy rodzaj powiadomienia `duel_result` |
| Gratulacje i rekordy w tablicy (ranking ćwiczenia względny) | Could | `personal_record`, `e1RM` | Ranking per ćwiczenie |
| Udostępnianie karty wyniku (obraz bez danych wrażliwych) | Could | - | Nowa funkcja; `prawnik` przed wdrożeniem |
| Sezon z przepustką (nagrody za poziom sezonu) | Could | `user_season_xp`, `progression-rewards.ts` | Ścieżka nagród |
| Kosmetyka profilu jako wyróżnik pakietu bez przewagi | Could (decyzja D10) | `user_cosmetics`, `user_cosmetic_loadout` | Katalog i zasady |
| Podgląd i pojedynki zespół vs zespół w czasie rzeczywistym | Won't (v1) | wojny (tygodniowe) | - |
| Ranking między miastami i regionami | Won't | - | Brak danych lokalizacji; ryzyko prywatności |
| Segmenty GPS i rekordy trasy | Won't | - | Brak trasy w modelu cardio |
| Ranking masy ciała, kalorii, makro | Won't (zakaz) | - | BR-3, BR-12 |
| Płatna przepustka lub płatne rankingi | Won't (v1, D10) | - | BR-8 |
| CRM trenera w grupie | Won't | - | `PRODUCT_FOCUS = "b2c"` |

**Priorytetyzacja MVP (kolejność dla `architekt`):**
1. Widoczność istniejących sygnałów (XP, miejsce, liga) na stronie grupy. Najszybszy wpływ na "wow" i najmniejsze ryzyko, bo dane już są.
2. Katalog odznak z progresem i rotacja misji. Dają pętlę "zdobądź i wróć".
3. Kontrola widoczności i ranking względny. Warunek wstępny dla wdrożenia 1 i 2 w produkcji (prawo i zaufanie).
4. **Naprawa zgody lidera w duchu treningowym (US-21).** Istniejący defekt prywatności, niezależny od reszty — można i warto zrobić równolegle z punktem 3, tym samym wzorcem zgody.
5. Pierścienie i serie tygodni. Najlepsza wizualnie zmiana, ale zależy od D9.
6. **Cotygodniowe podsumowanie (US-20).** Tanie (bez migracji), wysoki wpływ na powrót w poniedziałek — kandydat do przesunięcia wyżej, jeśli właściciel chce szybki efekt retencyjny małym kosztem.
7. **Odznaka za wspólny trening (US-19).** Tanie, wzmacnia więź w grupie równolegle z punktem 2.
8. Rywalizacja 1 na 1 przez ducha (US-10/17/18) i powiadomienia o pojedynku (v1.1).

Pełne uzasadnienie i kryteria akceptacji dla punktów 4, 6-8: sekcja 17.

---

## 10. Wymagania niefunkcjonalne

- **Telefon w trakcie treningu:** wynik i pierścienie są w hubie i na stronie grupy, nie na ekranie aktywnego treningu (nie zabierają miejsca podczas serii). Po zapisie treningu zmiana wyniku widoczna przy najbliższym wejściu lub przez istniejący SSE tablicy.
- **Sieć na siłowni:** start treningu nie może zależeć od sieci. Zapis treningu idzie przez outbox (istniejący). Naliczenie XP i wpis w tablicy po synchronizacji, bez duplikatu (AC-2.3).
- **Tryb offline / PWA:** hub grupy bez cache offline w MVP (założenie zgodne z 011). Dopuszczalne: ostatni znany wynik z komunikatem "dane sprzed X min".
- **Dostępność:** WCAG AA. Poziomy, odznaki i pierścienie mają tekst lub ikonę, nie tylko kolor. Obszary dotyku min. 44 px. Pierścienie i progres z etykietą dla czytnika ekranu.
- **Bezpieczeństwo:** każda widoczność liczona po stronie serwera (`assertActiveTeamMember`, `canViewPrivateTeam`). Ranking i odznaki nie ujawniają danych członków spoza grupy. Zamknięcie znanego IDOR w presence przed rozszerzeniem live (audyt HIGH).
- **Prywatność:** minimalizacja danych w rankingach (BR-3), brak nazw grup i wyników w logach i Sentry, brak danych zdrowotnych w zdarzeniach PostHog.
- **Wydajność:** ranking grupy (max 50 członków) tani; rzadkość odznak i ranking globalny muszą być agregowane lub cache'owane (w tym TTL in-process ~45 s z FCS). Brak pełnego skanu `user_badges` przy każdym wejściu. Cel SLO do ustalenia przez `tester-wydajnosci`.
- **Koszty (Turso, Render/VPS, Upstash):** brak nowych usług w MVP. Harmonogram rotacji misji na istniejącym mechanizmie (cron) lub przez leniwe uruchomienie przy pierwszym wejściu (decyzja `architekt`). Limity darmowych planów nie mogą zostać przekroczone przez rankingi.
- **Android:** WebView na tych samych stronach. Brak zmian w `/api/android/*` i w wersjach aplikacji poza zwykłym changelogiem.
- **Java backend:** poza zakresem zmian w tym zadaniu, ale jeśli zapis treningu jest kierowany do Javy, wymaga decyzji przed MVP (sekcja 11, pkt 1).

---

## 11. Zależności i ryzyka techniczne

1. **Ścieżka zapisu treningu (krytyczne, do potwierdzenia).** Auto-posty, XP i reputacja po treningu są w TypeScript (`app/api/workouts/complete/route.ts`). Java `WorkoutController` przyjmuje `POST /api/workouts/complete` bez logiki feedu, XP i reputacji. Jeśli produkcja używa Javy (D5, nieznane), nowa funkcja nie dostanie danych. `architekt` ma potwierdzić, czy zapis przez Javę jest aktywny, i ustalić, czy Java ma przekazywać zdarzenia do TS, czy trzeba je dopisać.
2. **Definicja tygodnia (D9).** Pierścienie, rankingi i misje wymagają tygodnia pon-nd. Java i TS muszą być zgodne przed uruchomieniem pierścieni.
3. **Wyścigi i SELECT-then-UPDATE.** `team-wars.ts`, `team-quests.ts`, `progression.ts` i `hof.ts` używają wzorca bez CAS (już odnotowane w `docs/bledy-do-naprawy/bledy.md`). Rotacja misji i nagrody za misję zwiększają ryzyko podwójnego naliczenia. Priorytet naprawy przed MVP (`architekt`).
4. **Zmiana FCS wpływa na wojny i HoF.** Każda zmiana prezentacji lub wag zmienia także ligi. Zmiany ograniczyć do prezentacji.
5. **IDOR w presence (HIGH).** Publiczne UUID sesji i GET presence. Konieczne zamknięcie przed dodaniem nowych widoków wyników grupy (`tester-bezpieczenstwa`).
6. **Zaufanie do danych z klienta w wyzwaniach (MEDIUM).** Postęp wyzwań liczony na podstawie metryk klienta. Pojedynki 1 na 1 wymagają weryfikacji po stronie serwera.
7. **Zakres prawny nowych widoczności.** Rankingi grupowe i ewentualnie globalne ujawniają aktywność fizyczną. `prawnik` ocenia kwalifikację danych i domyślne ustawienia (sekcja 12, Q3).

---

## 12. Pytania otwarte

Maksymalnie 5 pytań dla właściciela. Przy każdym przyjęte założenie, jeśli brak odpowiedzi.

**Q1 - Kierunek rywalizacji.** Czy Team ma być przede wszystkim rywalizacją (ranking, 1 na 1) czy współpracą (misje)? **Założenie:** rywalizacja względna w grupie jako główny tryb, współpraca (misje) jako drugi tryb tego samego ekranu.

**Q2 - Monetyzacja Team (D10).** Czy elementy Team (ranking, wojny, misje, odznaki, pojedynki) mają być częścią pakietu? **Założenie:** nie. Team w całości darmowy w v1, pakiet pozostaje "bez reklam" (sekcja 5.6, BR-8).

**Q3 - Domyślna widoczność wyniku.** Czy wynik ma być widoczny tylko w grupie (domyślnie), czy także poza nią (np. profil dostępny dla wszystkich, globalne rankingi)? Obecne domyślne ustawienia profilu (`visibility = friends`, `showOnGlobal = 1`, `discoverable = 1`) są szersze niż proponowany model. **Założenie:** widoczność wąska (tylko grupa); poza grupą wyłączone do świadomego wyboru. Wymaga oceny `prawnik` (przed `architekt`).

**Q4 - Liczba widocznych "punktów".** Czy użytkownik widzi jeden licznik XP i jeden wynik tygodniowy, czy wszystkie tory? **Założenie:** widoczne dwa liczniki (XP osoby, XP grupy) plus liga wojen; RP i FCS jako szczegół rankingu; XP sezonowe i społeczności ukryte na poziomie interfejsu (dane zostają).

**Q5 - Cardio w rywalizacji.** Czy minuty cardio wchodzą do pierścieni i rankingu? **Założenie:** tak, tylko minuty (bez tętna, kalorii, makro). Wymaga potwierdzenia `prawnik`, bo cardio zawiera pola zdrowotne (tętno, kcal).

### 12.4 Pytania nieformalne (dla właściciela, bez wpływu na zakres)

- Czy w PostHog są dane o aktywnych grupach, członkach aktywnych tygodniowo i retencji? Jeśli nie, potrzebny jest 4-tygodniowy baseline przed ustaleniem celów liczbowych (sekcja 5.5).
- Czy produkcja (Render) uruchamia backend Java dla `POST /api/workouts/complete` (D5)? Odpowiedź decyduje o ryzyku z sekcji 11, pkt 1.

---

## 13. Ryzyka

| Ryzyko | Wpływ | Prawdopodobieństwo | Działanie |
|---|---|---|---|
| Zimny start: pusta grupa wygląda martwo i odstrasza nowych | Wysoki | Wysokie | US-1 (AC-1.3), US-8 (AC-8.3), zaproszenia w pustym stanie |
| Rywalizacja wypycha słabszych członków z grupy | Wysoki | Średnie | Progres względny (US-16), BR-2, guardrail "opuszczenia" |
| Publiczny ranking ujawnia aktywność fizyczną osób bez zgody | Wysoki | Średnie | Widoczność wąska (US-15, BR-9), ocena `prawnik` |
| Ścieżka zapisu przez Javę pomija feed, XP i reputację | Wysoki | Nieznane (D5) | Sekcja 11, pkt 1: potwierdzenie przez `architekt` przed MVP |
| Nakładanie się 5+ liczb rankingowych dezorientuje | Średni | Wysokie | BR-1, Q4, jedna waluta w UI |
| Rzadkość odznak i ranking globalny obciążają Turso | Średni | Średnie | Agregacja i cache (sekcja 10), `tester-wydajnosci` |
| Podwójne naliczenie XP i nagród (wyścig, sync, dwa urządzenia) | Średni | Średnie | BR-5, AC-2.4, znane SELECT-then-UPDATE (sekcja 11, pkt 3) |
| Rywalizacja o ciężary zachęca do ryzykownych ciężarów | Wysoki | Średnie | Brak rankingów absolutnych (BR-3, US-16) |
| Zmiana tygodnia (D9) rozjeżdża pierścienie i ranking | Średni | Wysokie, dopóki D9 nie wdrożone | Z4, AC-3.4 |
| Dane osób 16-17 lat w rankingach (D18) | Wysoki | Średnie | AC-15.4, `prawnik` |
| Brak baseline'u: nie da się ocenić efektu | Średni | Wysokie | Sekcja 5.5, sekcja 12.4 |
| Zmiana FCS zmienia także wojny i HoF | Średni | Średnie | BR-2, sekcja 11, pkt 4 |
| Presence IDOR i nowe widoki wyników grupy | Wysoki | Średnie | Zamknięcie przed rozszerzeniem (sekcja 10) |
| Pakiet staje się "pay-to-win" w rankingu | Wysoki | Niskie (przy decyzji Q2) | BR-8, Q2 |

---

## 14. Decyzja o bramkach przepływu

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `analityk` (etap 1) | TAK, wykonane | Ten dokument |
| `prawnik` (etap 2) | **TAK, przed architektem** | Zadanie zmienia to, kto i jakie dane aktywności widzi (ranking, odznaki, widoczność profilu, potencjalne pola cardio z tętnem i kcal), oraz dotyka kont 16-17 lat (D18). Decyzja o widoczności wpływa na projekt, więc ocena musi być pierwsza. |
| `architekt` (etap 3) | TAK | Nowy model prezentacji i agregacji (rzadkość, rotacja misji, pierścienie), ścieżka zapisu przez Javę (sekcja 11, pkt 1), tydzień D9, decyzja o użyciu istniejących tabel vs nowe. Potencjalny ADR `docs/adr/0011-redesign-funkcji-team.md`. Model zalecany: `sonnet` (decyzje architektoniczne). |
| `ux` (etap 4) | TAK | Nowe ekrany i przepływy: hub "Dziś w zespole", kolekcja odznak, pierścienie, rotacja misji. Projekt od zera, więc zgodnie z przeplywem model `sonnet`. Makiety w `docs/ux/012-redesign-funkcji-team-makieta.html`. |
| `backend` / `frontend` (etap 5) | NIE na tym etapie | Brak zmian kodu (polecenie użytkownika). Po akceptacji etapów 2-4. |
| `architekt` (przegląd po implementacji, etap 6) | Warunkowo | Tylko jeśli implementacja zmieni kontrakt, schemat lub wiele modułów naraz (typowo tak: schemat katalogu odznak i harmonogramu). |
| `tester` (etap 7) | TAK w implementacji | Testy domenowe: tydzień pon-nd, idempotencja XP, capy, progres względny, rotacja misji, nagroda dla członków aktywnych. |
| `tester-bezpieczenstwa` (etap 9) | TAK w implementacji | Uprawnienia członkostwa, widoczność między użytkownikami, IDOR presence (znany), dane wejściowe pojedynków i wyzwań. |
| `tester-wydajnosci` (etap 9) | TAK w implementacji | Agregacja rzadkości, ranking, harmonogram misji, cache. |
| `prawnik` (etap 10, wyjście) | Warunkowo | Tylko jeśli implementacja doda udostępnianie wyniku (Could) lub zmieni domyślne ustawienia profilu. |

---

## 15. Kryteria akceptacji etapu projektowego

### 15.1 Raport `prawnik` (`docs/prawo/`) musi zawierać
- Kwalifikację danych w rankingach, pierścieniach i odznakach (BR-3) jako danych o aktywności, a nie danych zdrowotnych, oraz wskazanie pól granicznych (cardio: tętno, kcal).
- Ocenę domyślnej widoczności (BR-9, sekcja 12, Q3) i istniejących domyślnych ustawień `userSocialProfiles`.
- Podstawę prawną widoczności w grupie i poza nią, sposób cofnięcia zgody i retencję treści opublikowanych po wyjściu z grupy (AC-15.3).
- Zasady dla kont 16-17 lat (AC-15.4) i wpływ D18.
- Ocenę zasady "nagroda dla członków aktywnych" (BR-7).
- Projekt roboczy do zatwierdzenia przez prawnika-człowieka.

### 15.2 Raport `architekt` (`docs/adr/0011-redesign-funkcji-team.md`) musi zawierać
- Potwierdzenie lub zaprzeczenie ryzyka z sekcji 11, pkt 1 (ścieżka zapisu przez Javę), z rekomendacją.
- Decyzję: rozszerzenie istniejących tabel (`progression_xp_ledger`, `user_badges`, `team_quests`, `team_fcs_scores`) czy nowe; uzasadnienie braku równoległych rozwiązań.
- Model katalogu odznak i rzadkości (agregacja, próg N, cache).
- Sposób rotacji misji i wyzwań (cron, leniwe uruchomienie, ręczny start) i zgodność z limitami hostingu.
- Definicję tygodnia wspólną dla cardio, pierścieni, rankingu i misji (D9).
- Plan naprawy wzorca SELECT-then-UPDATE w `team-wars.ts` i `team-quests.ts` przed MVP.
- Listę zmian w kontraktach API (jeśli są), z informacją, że implementacja idzie osobno.

### 15.3 Raport `ux` (`docs/ux/012-redesign-funkcji-team.md`) i makieta HTML musi zawierać
- Ocenę obecnej strony grupy i hubu (sekcja 2) z klasyfikacją problemów na blokujące i do naprawy później.
- Stany: pierwszy tydzień (1 osoba), grupa aktywna, członek w środku rankingu, członek na końcu, zamknięty pierścień, misja aktywna, misja zakończona, brak odznak, katalog z progresem, rzadkość ukryta (mało użytkowników), ukryty w rankingu, błąd sieci.
- Hierarchię: jeden główny licznik na ekran, dwa liczniki XP (osoba, grupa), jedna wskazówka "co zrobić".
- Dostępność: tekst obok koloru, obszary dotyku 44 px, WCAG AA.
- Zgodność z systemem projektowym (`docs/ux/00-system-projektowy-stan.md`): `AppPageHeader`, `app-card`, `SectionLabel`, tokeny `--gym-*`, bez nowych kolorów na sztywno.
- Mikrokopię po polsku i jeden słownik ("grupa" albo "Team", ustalony raz).

---

## 16. Następne kroki

1. Akceptacja właściciela dla Q1-Q5 (lub przyjęcie założeń).
2. Właściciel sprawdza w PostHog baseline (sekcja 12.4): aktywne grupy, retencja członków, odsetek dołączających.
3. `prawnik` (etap 2): ocena widoczności i danych (sekcja 15.1).
4. `architekt` (etap 3): ADR `docs/adr/0011-redesign-funkcji-team.md` (sekcja 15.2), w tym potwierdzenie ścieżki Javy.
5. `ux` (etap 4): raport i makieta (sekcja 15.3).
6. Po akceptacji makiet: implementacja w osobnym kroku (etap 5), z testami domenowymi i bramkami bezpieczeństwa i wydajności.
7. Aktualizacja `docs/zespol/wiedza-o-projekcie.md` i `docs/adr/0000-architektura-stanu-obecnego.md`, gdy zmieni się stan społeczności.
8. Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR, po wdrożeniu bez `planned`.

---

Werdykt etapu 1: **ZATWIERDZONE**. Analiza kompletna. Pytania Q1-Q5 otwarte z założeniami. Kluczowe ryzyko do potwierdzenia przed projektem: ścieżka zapisu treningu przez backend Java (sekcja 11, pkt 1) oraz brak baseline'u użycia.

---

## 17. Rozszerzenie: znajomi, duch treningowy, powiadomienia

Dopisane na polecenie właściciela 2026-10-31 — po zmianie konfiguracji repozytorium (pojedynczy agent `webdev`, bez formalnych bramek zespołu). Ten dodatek nie ma osobnego werdyktu bramek `prawnik`/`architekt`/`ux` — traktować jako rozszerzoną analizę, do uwzględnienia razem z resztą dokumentu przy ewentualnej implementacji.

### 17.1 Stan obecny (potwierdzone w kodzie)

| Obszar | Co działa | Gdzie widać | Luka / ryzyko |
|---|---|---|---|
| Znajomi (`friendships.ts`) | Relacja wymaga akceptacji obu stron; udostępnianie treningu na żywo wymaga osobnej, **wzajemnej** zgody (`shareWorkoutA`/`shareWorkoutB`, oba muszą być 1) | `/community/friends` | Model zgody poprawny, zgodny z wymogiem opt-in ustalonym przez `prawnik` w etapie 2. Nic do naprawy. |
| Wspólny trening (`group-workout.ts`) | Sesja jawnie tworzona (`createGroupWorkoutSession`) i dołączana (`join`), nie automatyczny broadcast; presence pokazuje ćwiczenie/serię/ciężar/tempo uczestnikom sesji | Sekcja "Aktywne treningi" na stronie grupy | Brak powiązania z pętlą motywacyjną huba (brak CTA, brak nagrody XP/odznaki za wspólny trening). |
| Duch treningowy (`lib/ghost-training/`) | 3 źródła: `self` (własny poprzedni trening), `friend` (trening znajomego — **wymaga** wzajemnej zgody udostępniania, sprawdzone w `targets.ts` `loadGhostTimelineForTarget`), `leader` (trening lidera rankingu FCS grupy) | `ghost-race-hud.tsx`, `ghost-picker-sheet.tsx` w aktywnym treningu | **Defekt (sekcja 17.2):** ścieżka `leader` pokazuje cały timeline treningu lidera — łącznie z bezwzględnym ciężarem na serię (`GhostCheckpoint.weight`) — każdemu członkowi zespołu, **bez żadnej zgody lidera**. Koliduje z BR-3/BR-9/BR-12. |
| Powiadomienia (`notification-types.ts`) | 10 rodzajów (comment, reaction, invite, achievement, challenge, live, friend_live, ranking, hall_of_fame, team_announcement); kolumna `kind` w `notifications` to wolny `text` (**bez migracji** przy dodaniu nowego rodzaju — potwierdzone w `db/schema.ts:2082`); grupowanie `group_key`, okno ~2h | `/community/notifications`, dzwonek | Rodzaj `ranking` pokrywa już ideę US-13 ("wyprzedzono Cię"). Brakuje rodzajów wspierających nową pętlę: cotygodniowe podsumowanie, wynik pojedynku z duchem, zaproszenie do pojedynku. |

### 17.2 Defekt: duch lidera bez zgody (do naprawy przed rozszerzeniem Team)

`lib/ghost-training/targets.ts`, funkcja `loadGhostTimelineForTarget`, gałąź `kind === "leader"` (ok. linii 137-155): sprawdza tylko wspólne członkostwo w zespole, nie zgodę lidera. W efekcie każdy członek grupy może pobrać pełny przebieg treningu lidera — co do serii, ciężaru, powtórzeń — bez jego wiedzy i zgody. To sprzeczne z modelem opt-in, który `prawnik` narzucił w etapie 2 dla reszty funkcji Team (widoczność wyniku), oraz z BR-3/BR-12 (zakaz ciężarów bezwzględnych w udostępnianych widokach bez zgody).

**Rekomendacja naprawy (dwuczęściowa, niezależna od reszty redesignu — można wdrożyć osobno jako hotfix):**
1. Lider musi świadomie włączyć udostępnianie swojego ducha (nowa flaga zgody, analogiczna do `shareWorkoutA/B` w `friendships`, np. per-zespół w `team_members` albo w `user_social_profiles`). Domyślnie wyłączone.
2. Nawet po zgodzie, payload ducha pokazywany **innej osobie niż właściciel** nie powinien zawierać surowego ciężaru — tylko progres względny (tempo, % ukończenia, delta czasu), zgodnie z zasadą używaną już w rankingu FCS. Bezwzględny ciężar zostaje tylko w widoku właściciela danych.

### 17.3 Duch jako fundament pod pojedynek 1:1 (US-10)

Silnik ducha (`deltas.ts`, `predict.ts`) już liczy różnicę czasu, serii, objętości i przewidywany wynik (`"winning" | "trailing" | "neck"`) względem źródła — to **w praktyce gotowy silnik pojedynku**, brakuje mu tylko: (1) formalnego rekordu wyzwania z okresem i statusem, (2) rozliczenia wyniku w XP/odznaczu, (3) osobnej zgody na pojedynek (różnej od ogólnej zgody "udostępniaj mi trening na żywo").

**Rekomendacja:** rozszerzyć istniejący mechanizm ducha o rozliczenie, zamiast budować nowy system pojedynków od zera. Nowa, mała tabela (`team_duels` lub `friend_duels`): wyzywający, przeciwnik, status (pending/active/completed/declined), okres (7 dni, zgodnie z Z4/BR-4), rozliczenie przez istniejący wzorzec `sourceKey` UNIQUE (jak XP). Koszt wdrożenia wyraźnie niższy niż nowy system od zera.

### 17.4 Nowe user stories

**US-17 Wyzwanie ducha znajomego (Should, v1.1)**
Jako osoba ćwicząca chcę wyzwać znajomego na pojedynek oparty o mój/jego ostatni trening, aby mieć osobistego rywala bez czekania na nowy system.
- AC-17.1: Given wzajemna zgoda udostępniania (istniejąca `shareWorkoutA/B`), When wysyłam wyzwanie z profilu znajomego lub z `ghost-picker-sheet`, Then druga strona dostaje powiadomienie i może zaakceptować/odrzucić.
- AC-17.2: Given pojedynek trwający 7 dni, When oba treningi się kończą, Then wygrywa wynik względny (jak w US-16, nie ciężar bezwzględny).

**US-18 Powiadomienie o wyniku pojedynku z duchem (Should)**
Jako osoba ćwicząca chcę dostać powiadomienie, gdy wygram lub przegram pojedynek, aby wrócić i sprawdzić wynik.
- Nowy rodzaj powiadomienia `duel_result` — bez migracji schematu (kolumna `kind` to wolny tekst).

**US-19 Odznaka za pierwszy wspólny trening grupowy (Could)**
Jako członek grupy chcę dostać odznakę za pierwszy wspólny trening (`group-workout`), aby czuć, że wspólne ćwiczenie ma wartość.
- AC-19.1: Given ukończona sesja grupowa z ≥2 aktywnymi uczestnikami, When sesja się kończy, Then każdy uczestnik dostaje odznakę "Razem" raz (idempotentnie po `sourceKey` sesji).

**US-20 Cotygodniowe podsumowanie (Should)**
Jako osoba ćwicząca chcę dostać w niedzielę wieczorem podsumowanie tygodnia w zespole (pierścienie, miejsce w rankingu, zbliżająca się seria), aby wiedzieć, czy coś jeszcze mogę dociągnąć.
- Nowy rodzaj powiadomienia `weekly_digest`, generowany leniwie (ten sam wzorzec co rotacja misji w ADR 0011), bez nowej usługi/crona.

**US-21 Zgoda lidera na udostępnienie ducha (Must — naprawia defekt 17.2)**
Jako lider rankingu grupy chcę decydować, czy inni mogą ścigać się z moim duchem, aby nie ujawniać swojego treningu bez zgody.
- AC-21.1: Given brak zgody lidera, When członek grupy otwiera listę celów ducha, Then opcja "lider" nie jest widoczna.
- AC-21.2: Given zgoda lidera udzielona, When inny członek ściga się z duchem lidera, Then widzi tylko progres względny, nie surowy ciężar.

### 17.5 Nowe reguły biznesowe

- **BR-13** Duch źródła `leader` wymaga osobnej, jawnej zgody lidera; bez zgody ścieżka jest niedostępna (naprawia defekt 17.2).
- **BR-14** Payload ducha pokazywany komuś innemu niż właściciel danych zawiera tylko progres względny (czas, % ukończenia, delta), nigdy surowy ciężar/powtórzenia źródła — spójne z BR-3/BR-12.
- **BR-15** Rozliczenie pojedynku (US-17) jest idempotentne, tym samym wzorcem `sourceKey` co reszta nagród XP (BR-5).
- **BR-16** Nowe rodzaje powiadomień (`duel_result`, `weekly_digest`) nie wymagają migracji schematu (kolumna `kind` jest wolnym tekstem) — tylko rozszerzenia `NOTIFICATION_KINDS` w `notification-types.ts`.

### 17.6 Co jeszcze warto dodać (odpowiedź na pytanie właściciela)

Uszeregowane wg stosunku efektu do kosztu wdrożenia (taniej = bliżej góry):

1. **Cotygodniowe podsumowanie (US-20).** Najtańsze (wolna kolumna `kind`, istniejący wzorzec leniwego uruchomienia z ADR 0011) i to dokładnie mechanizm, który w Strava/Apple Fitness najbardziej napędza powrót w poniedziałek.
2. **Odznaka za wspólny trening (US-19).** Tanie — dane sesji grupowej już istnieją, brakuje tylko zdarzenia nagrody. Wzmacnia więź w grupie, nie tylko rywalizację.
3. **Pojedynek przez ducha (US-17/18) zamiast nowego systemu.** Średni koszt, ale redukuje pracę nad US-10 z "nowy system od zera" do "rozszerzenie istniejącego silnika o rozliczenie" — to największa dźwignia w tej turze.
4. **Naprawa zgody lidera (US-21/BR-13-14).** Nie jest to "nice to have" tylko wymagane przed jakimkolwiek szerszym użyciem ducha w hubie — inaczej rozszerzamy funkcję na defekcie prywatności.
5. *(Could, z sekcji 9)* Karta wyniku tygodnia do udostępnienia poza aplikację — teraz bardziej uzasadniona, bo silnik ducha i FCS już dostarczają gotowe dane progresu względnego do wizualizacji, bez dodatkowej logiki liczącej.

### 17.7 Aktualizacja zakresu MVP/v1.1

Te 4 pozycje (US-21, US-20, US-19, US-17/18) są **wpisane bezpośrednio do głównej tabeli zakresu — sekcja 9** — i do priorytetyzacji MVP tamże (punkty 4, 6-8), żeby nie było dwóch rozbieżnych list. Uzasadnienie kosztu/efektu każdej pozycji: sekcja 17.6 wyżej.
