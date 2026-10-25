# 007 - Ekran Profil: analiza techniczna, wizualna i wymagania do redesignu

- **Zadanie**: `docs/zadania/007-redesign-profil.md` (karta do założenia przez koordynatora; ten dokument jest wynikiem etapu 1)
- **Autor**: analityk (etap 1)
- **Data**: 2026-10-25
- **Gałąź**: brak zmian kodu. Analiza nie zmienia repozytorium. Redesign na osobnej gałęzi od `main`.
- **Status**: gotowe do etapu 3 (`architekt`) i etapu 4 (`ux`). Bramka `prawnik` warunkowa (sekcja 8).
- **Źródło faktów**: bezpośredni odczyt kodu (pliki i linie podane w tekście). Zrzuty ekranu przekazane przez użytkownika nie są w repozytorium, więc ocena wizualna opiera się na opisie użytkownika i strukturze komponentów. Nie uruchamiano aplikacji, `lint`, `tsc` ani testów (analiza, bez zmian kodu).

---

## 1. Kontekst i cel

Ekran Profil (`/profile`) jest jedynym miejscem, w którym użytkownik ustawia: dane ciała, cele treningowe, cele makro i kalendarz dni treningowych, makro posiłków, przypomnienia, język oraz konto (hasło, zgody, eksport, usunięcie). Dane z tego ekranu zasilają Start, Treningi, Dietę i Raporty.

**Cel redesignu**: uporządkować ekran tak, aby (a) użytkownik szybko odnalazł potrzebną sekcję zamiast przewijać 6 pełnych kart, (b) było jasne, co jest ustawieniem, a co wartością wyliczoną, (c) dane wrażliwe (waga, zgody, usunięcie konta) były prezentowane z właściwą uwagą, a (d) wyliczenia makro były wiarygodne i spójne z resztą aplikacji.

**Zakres tego etapu**: analiza i wymagania. Brak kodu, brak decyzji technicznych (należą do `architekt`).

---

## 2. Stan obecny - struktura i przepływ danych

### 2.1 Struktura komponentów

Strona: `app/(dashboard)/profile/page.tsx` (RSC). Pobiera `users` i `userSettings` (dwa zapytania równolegle, linie 48-79), liczy `nutritionInitial` (linia 83) i renderuje:

| Sekcja (`id`) | Tytuł na ekranie | Komponenty | Zapis |
|---|---|---|---|
| (nagłówek) | „Zawodnik / Profil” | karta konta: `LogoutButton`, 3x `ProfileStat` (waga, wzrost, wiek) | brak |
| (nav) | pasek 6 kotwic | `ProfileNav` | brak |
| `body` | Ciało i dane | `BodyParamsForm` | `updateBodyParamsFormAction` (`actions/profile.ts`) |
| `training` | Trening i postępy | link „Ustaw plan” (`/profile/workout-plan`), `ProfileGoalForm`, `ReportCadenceForm`, `ProgressDeltaUnitPicker` | `updateWeeklyCardioGoalForm`, `updateReportCadenceForm`, `updateProgressDeltaUnitAction` |
| `diet` | Dieta | `NutritionPlanSection` (cele B/W/T + kalendarz), `MealTemplatesForm` (5 posiłków) | `saveNutritionPlanAction` (`actions/nutrition-settings.ts`), `saveMealTemplatesAction` (`actions/meal-quick.ts`) |
| `reminders` | Przypomnienia | `RemindersCard` | `saveRemindersPrefsAction` + Web Push / alarmy Android (klient) |
| `app` | Aplikacja | `LocaleSwitch`, `AndroidAppVersionCard` | (wg komponentów, nie analizowano szczegółowo) |
| `account` | Konto i prywatność | `ChangePasswordForm` (tylko gdy `passwordHash`), `ConsentSettingsCard`, `DataExportActions`, `DeleteAccountControl` | hasło: `changePasswordFormAction`; zgody: localStorage; eksport: `GET /api/user/export`; usunięcie: `DELETE /api/user/account` |

Wspólne klocki: `components/profile/profile-ui.tsx` (`ProfileSection`, `ProfileBlock`, `ProfileField`, `ProfileSelect`, `ProfileSwitch`, `ProfileStat`, `ProfileNav`).

Nieanalizowano szczegółowo (poza zakresem tego etapu, do weryfikacji przez `architekt`): `change-password-form.tsx`, `locale-switch.tsx`, `logout-button.tsx`, `android-app-version-card.tsx`, `profile-goal-form-fields.tsx`, `components/workout-plan/workout-plan-editor` (podstrona planu).

### 2.2 Przepływ danych

1. **Odczyt**: RSC `page.tsx` czyta `users` (wiersz użytkownika) i `user_settings` (cel cardio, cykl raportów, JSON celów treningowych i odpoczynkowych, `nutritionDayTypesJson`, `mealTemplatesJson`, jednostka postępów, przypomnienia). Wartości przekazywane są jako propsy (`initial*`).
2. **Stan klienta**: każdy formularz trzyma lokalny stan w `useState` / `useActionState` i nie czyta go ponownie z serwera poza `revalidatePath("/profile")`. Wyjątek: `MealTemplatesForm` ma `useEffect` synchronizujący się z propsem (`meal-templates-form.tsx:51-53`), a `NutritionPlanSection` nie (stan tylko z `useState`, `nutrition-plan-section.tsx:101-109`).
3. **Zapis**: każda sekcja ma własną akcję (sześć niezależnych zapisów). Brak jednej transakcji i brak wspólnego „Zapisz wszystko”.
4. **Wyliczenia**: kcal z makro liczy `kcalFromMacros` (`lib/kcal-from-macros.ts:13-19`, `Math.round(P*4 + C*4 + T*9)`). Jest to jedyna definicja w aplikacji, używana też w akcjach zapisu.
5. **Konsumenci ustawień** (potwierdzone wyszukiwaniem): `lib/nutrition-goals.ts` (`resolveProfileDayGoals`, `mergeSummaryWithProfileGoals`) używany przez Dietę/Start/Analizę; `lib/meal-templates.ts` używany przez `components/home/home-today-page-content.tsx`, `components/meal-suggestions/meal-suggestions-page-content.tsx`, `app/(dashboard)/supplements/page.tsx`; `getUser()` w `actions/backend.ts` dla pozostałych ekranów.

### 2.3 Sprawdzenie wyliczeń makro (wymaganie z zadania)

**Wynik ogólny**: arytmetyka i wzór są poprawne we wszystkich miejscach. Problemem jest brak powiązania między sumą posiłków a celami dnia oraz brak walidacji (sekcja 3, T-3).

- Wzór Atwater 4/4/9 jest spójny: `lib/kcal-from-macros.ts:18`, `actions/nutrition-settings.ts:71`, `components/profile/nutrition-plan-section.tsx:58,87`, `components/profile/meal-templates-form.tsx:64,83,116`.
- **Weryfikacja zrzutu**: suma posiłków 174 B, 124 W, 180 T daje `174·4 + 124·4 + 180·9 = 696 + 496 + 1620 = 2812 kcal`. Wynik zgadza się z pokazanym „2812 kcal”. Udział energii: białko 25%, węglowodany 18%, tłuszcz 58%.
- **Cele dnia** (dzień treningowy 2050 kcal, nietreningowy 1890 kcal) są liczone z ich własnych gramów (`nutrition-plan-section.tsx`, `readGoalsFromFields` i serwerowo `nutrition-settings.ts:69-80`). Nie mają związku z sekcją „Makro posiłków”.
- Różnica: 2812 − 2050 = **+762 kcal** (137% celu treningowego); 2812 − 1890 = **+922 kcal** (149% celu nietreningowego).
- **Wniosek**: to nie jest błąd obliczeniowy. Jest to świadomy brak powiązania: sekcja „Makro posiłków” (`mealTemplatesJson`) jest osobnym, jednym zestawem 5 slotów bez podziału na typ dnia i bez walidacji względem celów (patrz T-3 i pytanie P-2).

---

## 3. Analiza techniczna - ustalenia

Priorytet: P1 = wpływa na wiarygodność danych lub zaufanie; P2 = zauważalny problem UX lub architektury; P3 = porządki.

### T-1 (P1) Trzy niezależne źródła wagi

- `users.weightKg` - formularz „Ciało i dane” (`body-params-form.tsx:66-76`) zapisuje go przez `updateBody­Params` (`actions/profile.ts:74`). Karta na górze i pole w formularzu czytają tę kolumnę (`page.tsx:55,119,137`).
- `getUser()` w `actions/backend.ts:93-103` **nadpisuje** `weightKg` najnowszym raportem sylwetki (`getLatestBodyReportMetrics`), jeśli istnieje. Ten obiekt używają inne ekrany.
- `weight_logs` - `logWeighIn` (`actions/weight.ts:36-41`) zapisuje wpis wagi i **nie aktualizuje** `users.weightKg`.
- **Skutek**: po dodaniu wagi w Analizie lub raporcie karta Profilu i formularz pokazują starą wartość, a inne ekrany pokazują nową. Użytkownik widzi dwie różne „wagi”.

### T-2 (P1) Pola formularza pokazują wartości domyślne zamiast pustego stanu

- `body-params-form.tsx:75` `defaultValue={initial.weightKg ?? 80}`, `:86` `?? 180` (wzrost), `:97` `?? 25` (wiek).
- Karta na górze w tym samym czasie pokazuje „—” (`page.tsx:119-121`).
- **Skutek**: użytkownik bez uzupełnionych danych widzi w formularzu 80 kg / 180 cm / 25 lat, a w karcie „—”. Zapis formularza bez zmiany pól utrwala wartości, których użytkownik nie podał. Dane o ciele trafiają następnie do kalorii cardio i zapotrzebowania (hint na ekranie: „Wpływa na szacunek zapotrzebowania”).

### T-3 (P1) Makro posiłków bez powiązania z celami dnia i bez walidacji

- Jeden zestaw 5 slotów (`lib/meal-templates.ts:4`, `MEAL_TEMPLATE_COUNT = 5`), bez podziału na dzień treningowy i nietreningowy. Cele dnia mają dwa zestawy (`nutrition-plan-section.tsx`).
- `meal-templates-form.tsx:55-65` liczy sumę dnia, `:101-111` pokazuje ją bez porównania z celem. Brak ostrzeżenia przy odchyleniu.
- Konsumenci: `meal-suggestions-page-content.tsx:100` i `home-today-page-content.tsx` używają zapisanych slotów (przepisy są dobierane do tych gramów). Przy sumie 2812 kcal przy celu 1890 kcal propozycje mogą przekraczać cel dnia bez sygnału dla użytkownika.
- **Ustalenie do decyzji**: czy suma ma być tolerowana, ostrzegana, czy wymuszona do celu (pytanie P-2).

### T-4 (P1) Zaufanie do kcal po stronie serwera jest niespójne

- `actions/nutrition-settings.ts:71` przelicza kcal z gramów (serwer jest źródłem prawdy).
- `actions/meal-quick.ts:144-148,164` przyjmuje `calories` od klienta i zapisuje je bez przeliczenia. Klient wysyła wartość policzoną (`meal-templates-form.tsx:83`), ale serwer jej nie weryfikuje.
- **Skutek**: niespójny model zaufania w dwóch akcjach tego samego ekranu. Ryzyko niskie (dane własne użytkownika), ale naprawialne jednym wzorcem.

### T-5 (P2) Różne modele zapisu w jednym ekranie

- Sześć przycisków „Zapisz …” (`SubmitButton` w `body-params-form`, `profile-goal-form`, `report-cadence-form`; `Button` w `nutrition-plan-section.tsx:274`, `meal-templates-form.tsx:163`, `reminders-card.tsx:285`).
- `progress-delta-unit-picker.tsx:33-48` zapisuje od razu po kliknięciu (autozapis).
- `consent-settings-card.tsx:30-38` zapisuje do `localStorage` od razu, bez serwera.
- **Skutek**: użytkownik nie wie, co wymaga zapisu, a co działa od razu.

### T-6 (P2) Duplikacja komponentów i funkcji (sprzeczna z regułami repozytorium)

- Przełącznik: `ProfileSwitch` (`profile-ui.tsx:153-199`) oraz ręcznie zbudowany `role="switch"` w `reminders-card.tsx:212-233`.
- Chipy wyboru wartości: `profile-goal-form.tsx:43-60`, `report-cadence-form.tsx:45-62`, dni tygodnia `reminders-card.tsx:245-265`. Ten sam wzorzec, trzy kopie.
- Parsery gramów: `parseMacroGrams` w `lib/kcal-from-macros.ts:2` (używany w 5 plikach), `gramsForKcal` w `nutrition-plan-section.tsx:20`, `parseGrams` w `meal-templates-form.tsx:40`. Dwie zbędne kopie tej samej funkcji.
- Funkcje `kcalStringFromMacros` / `parseGoalsPayload` (`nutrition-plan-section.tsx:27-63`) powtarzają logikę `kcalFromMacros`. Do uproszczenia przez `architekt`.

### T-7 (P2) Tekst zależny od pozycji w layoutcie

- `reminders-card.tsx:346` zawiera „(sekcja Aplikacja poniżej)”. Redesign zmieniający kolejność lub nawigację zepsuje tę treść.

### T-8 (P2) Stan kalendarza i celów nie odświeża się z serwera

- `NutritionPlanSection` nie synchronizuje stanu z propsami po `router.refresh()` (`nutrition-plan-section.tsx:101-109`). Wzorzec z `MealTemplatesForm` (`:51-53`) nie jest tu zastosowany. Przy równoległym otwarciu na dwóch urządzeniach użytkownik może zapisać nieaktualny stan (T-9).

### T-9 (P2) Dwa urządzenia jednocześnie

- Zapis całego JSON celów i kalendarza (`nutrition-settings.ts:88-99`) nadpisuje wartości bez wersjonowania. Ostatni zapis wygrywa po cichu (brak `updatedAt` check). Ryzyko niskie, ale wymaga wzmianki w wymaganiach (BR-10).

### T-10 (P2) Zgody RODO tylko lokalnie

- `consent-settings-card.tsx:21,36` używa `readConsentPreferences` / `writeConsentPreferences` (`lib/consent-preferences`). Stan jest w przeglądarce, nie na koncie. Zmiana na innym urządzeniu nie jest widoczna. Brak zapisu decyzji po stronie serwera. To jest sprawa dla `prawnik` (sekcja 8).

### T-11 (P3) Drobne zaokrąglenia

- `meal-templates-form.tsx:105` i `:110`: sumy B/W/T są zaokrąglane osobno, a kcal liczone z nieza­okrąglonych wartości. Użytkownik przeliczający z pokazanych liczb może dostać różnicę kilku kcal. Zalecenie: liczyć z wartości wyświetlanych lub opisać.

### T-12 (P3) Nawigacja i etykiety

- `profile-ui.tsx:10-17` (etykiety kotwic: „Ciało”, „Trening”, „Konto”) różni się od tytułów sekcji (`page.tsx:130,149,239`: „Ciało i dane”, „Trening i postępy”, „Konto i prywatność”).

### T-13 (P3) Różnice zakresów wagi

- Formularz: 30–400 kg (`actions/profile.ts:18`). Wpis wagi: 1–600 kg (`actions/weight.ts:28`). Drobna niespójność.

### T-14 (P3) Strefa czasowa kalendarza

- `lib/local-date.ts:5-12` ustawia domyślną strefę `Europe/Warsaw` (chyba że podano zmienną). Dzięki temu serwer i klient liczą ten sam „dziś” w kalendarzu celów. Ryzyko niewielkie, ale przy zmianie zmiennych `NEXT_PUBLIC_CALENDAR_TIMEZONE` trzeba to sprawdzić.

### Zweryfikowane i poprawne

- Wzór kcal i sumy makro posiłków (sekcja 2.3).
- Cele z profilu są przeliczane serwerowo (`nutrition-settings.ts:69-80`) i parsowane z pominięciem zapisanego `calories` (`nutrition-goals.ts:41-43`), więc kcal nie rozjeżdża się z gramami w odczycie.
- Fallback celu: jeśli brak celów dla typu dnia, używany jest drugi zestaw (`nutrition-goals.ts:104-110`). Działanie poprawne, ale **ciche** dla użytkownika (patrz wymaganie BR-5).
- Usunięcie konta wymaga wpisania frazy (`personal-data-card.tsx:86`), co jest dobrą praktyką.
- Hasło pokazywane tylko, gdy konto ma hasło (`page.tsx:93,242`).

---

## 4. Analiza wizualna

Ocena oparta na opisie zrzutów i strukturze komponentów (do potwierdzenia przez `ux` na urządzeniu mobilnym).

1. **Długość i gęstość**: sześć pełnych kart w jednej kolumnie, szacunkowo 55-65 kontrolek (pola, przełączniki, chipy, przyciski). Ekran wymaga wielokrotnego przewijania; użytkownik szukający jednej wartości (np. cel cardio) przewija przez całą dietę.
2. **Brak hierarchii „ustawienia” vs „wyliczone”**: liczby wyliczone (kcal z makro, „SUMA DNIA”, „Kalorie z makroskładników”) są w tym samym stylu co pola wejściowe. Użytkownik nie rozróżnia, co edytuje, a co jest wynikiem.
3. **Powtarzalne przyciski „Zapisz”**: sześć pełnoszerokich przycisków. Każdy zapisuje tylko swoją sekcję, co jest niewidoczne z poziomu wzrokowego. Mieszają się też autozapisy (T-5).
4. **Formularze liczbowe**: dwie siatki po 3 pola (B/W/T, waga/wzrost/wiek) i 15 pól posiłków. Na 360-390 px szerokości każde pole ma ok. 100 px, co jest ciasne przy wartościach dziesiętnych.
5. **Kalendarz dni**: 7 kwadratów z numerem dnia i dwoma stanami kolorem (neon, szary). Czytelny, ale bez etykiety, co oznacza „dzień bez oznaczenia” (tekst pod spodem tłumaczy to dopiero w akapicie).
6. **Zgody i konto**: przełączniki RODO, eksport i usunięcie są w jednej karcie. Usunięcie ma wyróżnienie czerwone, ale stoi bezpośrednio pod eksportem. Brak wyraźnego separatora „strefy niebezpiecznej”.
7. **Język i żargon**: „Keytel”, „VAPID” (w komunikatach), „Atwater” (w komentarzach, nie w UI). Hint „Do szacowania kcal z tętna (Keytel)” (`body-params-form.tsx:106`) jest niezrozumiały dla zwykłego użytkownika.
8. **Nagłówek konta**: awatar, imię, e-mail, przycisk wylogowania i trzy kafelki (waga, wzrost, wiek). Kafelki pokazują „—” dla pustych danych (T-2), ale w formularzu niżej pokazują wartości domyślne. Sprzeczność widoczna na tym samym ekranie.
9. **Brak podsumowania stanu**: sekcja „Trening i postępy” ma tylko link „Ustaw plan”, bez informacji, czy plan istnieje. Podobnie „Przypomnienia” nie pokazuje, które są włączone bez rozwinięcia (poza przełącznikami).
10. **Spójność z resztą aplikacji**: pasek kotwic i karty `app-card` są spójne z innymi ekranami. Kolory i tokeny (`--gym-gold`, `--neon`) są używane konsekwentnie, ale część klas jest inline (np. `nutrition-plan-section.tsx:243-247`), co utrudnia przyszły redesign.

---

## 5. Problemy i ryzyka do rozwiązania w redesignie (priorytet)

| ID | Priorytet | Problem | Rekomendacja (kierunek, bez decyzji technicznej) |
|---|---|---|---|
| R-1 | P1 | Trzy źródła wagi (T-1) rozjeżdżają się między ekranami | Ustalić źródło prawdy (P-1); pokazać w profilu, skąd pochodzi wartość i kiedy ją zaktualizowano |
| R-2 | P1 | Wartości domyślne 80/180/25 w formularzu (T-2) | Puste pola z placeholderem; zapis nie może utrwalać wartości domyślnych bez świadomego wpisu |
| R-3 | P1 | Suma makro posiłków bez powiązania i walidacji z celem dnia (T-3) | Decyzja produktowa (P-2); w każdym wariancie pokazać różnicę do celu |
| R-4 | P1 | Walidacja kcal po stronie serwera niespójna (T-4) | Jeden wzorzec: serwer przelicza kcal (jak w `nutrition-settings`) |
| R-5 | P1 | Zgody RODO tylko w localStorage (T-10) | Ocena `prawnik` (sekcja 8); zmiana prezentacji nie może zmienić skutku zgody |
| R-6 | P2 | Mieszane modele zapisu i sześć przycisków (T-5) | Jeden model: zapis per sekcja z widocznym stanem „zapisane/niezapisane” lub jeden zapis zbiorczy |
| R-7 | P2 | Ekran za długi, brak nawigacji do sekcji i hierarchii | Podział na podstrony lub zakładki z podsumowaniem na górze (kierunek dla `ux`, P-5) |
| R-8 | P2 | Duplikacja (T-6): switch, chipy, parsery | Wspólne komponenty i jedna funkcja parsowania (wymóg repozytorium: jeden komponent w jednym miejscu) |
| R-9 | P2 | Tekst odwołujący się do pozycji („sekcja Aplikacja poniżej”, T-7) | Odwołanie do nazwy lub linku, nie do pozycji |
| R-10 | P2 | Stan celów nie synchronizuje się z serwerem (T-8, T-9) | Synchronizacja po zapisie i obsługa konfliktu (BR-10) |
| R-11 | P2 | Ciche fallbacki celów dnia (BR-5 w sekcji 6) | Pokazać, który zestaw obowiązuje dany dzień |
| R-12 | P3 | Zaokrąglenia sum (T-11), zakresy wagi (T-13), etykiety nav (T-12), żargon (Keytel) | Porządki w trakcie implementacji |
| R-13 | P3 | Strefa czasowa (T-14) | Zachować `getCalendarTimezone`, nie zmieniać bez testu |

---

## 6. Wymagania dla nowego ekranu Profil

### 6.1 Zasada nadrzędna

**Żadna obecna funkcja nie znika.** Redesign zmienia układ, grupowanie, hierarchię i wygląd. Nie zmienia zapisywanych danych, znaczenia pól ani skutków zgód i usunięcia konta, chyba że w pytaniu P-1 do P-4 zapadnie inna decyzja właściciela.

### 6.2 Inwentarz funkcji do zachowania (F-1 do F-20)

| ID | Funkcja | Obecne miejsce | Uwagi |
|---|---|---|---|
| F-1 | Karta konta: awatar z inicjałów, imię, e-mail | nagłówek | zachować |
| F-2 | Wylogowanie | nagłówek | zachować |
| F-3 | Edycja imienia, nazwiska, wagi, wzrostu, wieku, płci, poziomu aktywności | Ciało | zmienić wartości domyślne (R-2) |
| F-4 | Link do planu treningowego | Trening | zachować, dodać podsumowanie stanu |
| F-5 | Cel cardio (min/tydz.) z presetami 90/150/210/300 | Trening | zachować |
| F-6 | Cykl raportów (3-90 dni) z presetami 7/14/30 | Trening | zachować |
| F-7 | Jednostka porównań: % lub kg (zapis od razu) | Trening | zachować, ujednolicić model zapisu (R-6) |
| F-8 | Cele makro dzień treningowy i nietreningowy (B/W/T, kcal liczone) | Dieta | zachować wzór 4/4/9 |
| F-9 | Kalendarz tygodnia: przełączanie trening/odpoczynek, dni bez oznaczenia = odpoczynek | Dieta | zachować, czytelniej oznaczyć stan domyślny |
| F-10 | Makro 5 posiłków (B/W/T, kcal, suma dnia) | Dieta | zachować; decyzja o powiązaniu z celem (P-2) |
| F-11 | Przypomnienia: godziny Trening/Posiłek/Check-in, dni tygodnia, e-mail | Przypomnienia | zachować; kanał (alarmy Android / push / brak) pokazany w statusie |
| F-12 | Język interfejsu (Polski / English) | Aplikacja | zachować |
| F-13 | Informacja o wersji aplikacji Android | Aplikacja | zachować |
| F-14 | Zmiana hasła (tylko konta z hasłem) | Konto | zachować warunek widoczności |
| F-15 | Zgody: analityka i marketing, akceptuj wszystkie, tylko niezbędne | Konto | zachować (R-5) |
| F-16 | Eksport danych JSON i CSV | Konto | zachować |
| F-17 | Usunięcie konta z potwierdzeniem frazą „USUŃ” | Konto | zachować, wyraźnie oddzielić od eksportu |
| F-18 | Linki do polityki prywatności (zgody) | Konto | zachować |
| F-19 | Komunikaty zapisu (toast) i błędy walidacji | wszędzie | zachować, ujednolicić |
| F-20 | Kotwice do sekcji (działające bez JS) | nav | zachować jako nawigację, zgodną z nową strukturą |

### 6.3 Historie użytkownika i kryteria akceptacji

**US-1** Jako osoba ćwicząca chcę szybko znaleźć cel cardio i plan, aby bez przewijania zmienić ustawienie treningowe.
- Given użytkownik otwiera Profil, When wybiera „Trening”, Then widzi cel cardio, cykl raportów i jednostkę bez przewijania przez dietę i konto.
- Given brak planu treningowego, When widzi sekcję Trening, Then widzi komunikat stanu („Brak planu”) i link do utworzenia.

**US-2** Jako osoba prowadząca dietę chcę widzieć, czy suma makro posiłków mieści się w celu dnia, aby nie ufać liczbom, które się rozjeżdżają.
- Given cel treningowy 2050 kcal i suma posiłków 2812 kcal, When otwieram Dietę, Then widzę różnicę (+762 kcal) i ostrzeżenie zgodne z decyzją P-2.
- Given brak celu dnia, When widzę sumę posiłków, Then nie widzę porównania, a komunikat wskazuje, czego brakuje.

**US-3** Jako nowy użytkownik chcę, aby pola ciała były puste, dopóki nie wpiszę danych, aby nie zapisać przypadkowych wartości.
- Given konto bez wagi, When otwieram Ciało, Then pole wagi jest puste z placeholderem (nie „80”), a karta pokazuje „—”.
- Given pole puste, When klikam zapis, Then system wymaga wartości albo zapisuje tylko wypełnione pola (decyzja w architekturze).

**US-4** Jako użytkownik z kilkoma źródłami wagi chcę wiedzieć, skąd bierze się wartość na Profilu, aby nie pomylić się co do aktualnej wagi.
- Given wpis wagi w Analizie nowszy niż wartość w profilu, When otwieram Profil, Then widzę wartość i datę jej źródła.

**US-5** Jako użytkownik chcę, aby zmiana zgody była zrozumiała i trwała, aby wiedzieć, co zaakceptowałem.
- Given zmieniam przełącznik analityki, When wracam na Profil z innego urządzenia, Then widzę spójny stan (zakres zależy od decyzji prawnej, P-4).
- Given zgody wycofuję, When zapisuję, Then zmiana działa natychmiast i nie zależy od sekcji, w której jest przełącznik.

**US-6** Jako użytkownik chcę odróżnić ustawienia od wartości wyliczonych, aby wiedzieć, co mogę edytować.
- Given ekran Dieta, When patrzę na kcal z makro, Then widzę je jako wynik (np. etykieta „wyliczone”), a nie jako pole do edycji.

**US-7** Jako użytkownik chcę, aby zapis był przewidywalny, aby wiedzieć, czy dane zostały zachowane.
- Given zmieniam pola w sekcji, When nie kliknąłem zapisu, Then widzę stan „niezapisane zmiany”.
- Given zapis się udał, When wracam do sekcji, Then widzę potwierdzenie i aktualne wartości z serwera.

**US-8** Jako użytkownik chcę usunąć konto bez przypadkowego kliknięcia, aby nie stracić danych przez pomyłkę.
- Given otwieram „Usuń konto”, When nie wpiszę „USUŃ”, Then przycisk potwierdzenia jest nieaktywny.
- Given ekran mobilny, When przewijam konto, Then sekcja usunięcia jest wizualnie oddzielona od eksportu.

**US-9** Jako użytkownik na telefonie w przerwie treningu chcę szybko zmienić cel cardio lub przypomnienie, aby nie szukać ustawienia długo.
- Given ekran na 360 px, When edytuję pole liczbowe, Then klawiatura liczbowa się pojawia, a pole nie jest ucięte.

**US-10** Jako użytkownik z dwóch urządzeń chcę, aby ostatni zapis nie nadpisał cicho cudzego.
- Given zmieniłem cele na telefonie i na komputerze, When zapisuję drugi raz ze starym stanem, Then system pokazuje konflikt lub ponownie wczytuje wartości (decyzja w architekturze, BR-10).

### 6.4 Reguły biznesowe

- **BR-1** Kcal z makroskładników: `round(B·4 + W·4 + T·9)`. Jedyna definicja (`lib/kcal-from-macros.ts`). Serwer przelicza kcal przy każdym zapisie celów; kcal z klienta nie jest źródłem prawdy.
- **BR-2** Makro posiłków: dokładnie 5 slotów „Posiłek 1–5”. Brak zapisu, gdy wszystkie makro są zerowe (`serializeMealTemplates`).
- **BR-3** Dzień bez oznaczenia = odpoczynek (`nutrition-goals.ts:96`). Ten sam zachowanie w nowym ekranie.
- **BR-4** Wartości dnia liczone w strefie `Europe/Warsaw` (chyba że zmienna środowiskowa).
- **BR-5** Fallback celu: gdy brak celu dla typu dnia, używany jest drugi zestaw. Nowy ekran musi to pokazać użytkownikowi (np. „Dzień treningowy korzysta z celów dnia nietreningowego”).
- **BR-6** Cel cardio domyślnie 150 min/tydz. (`page.tsx:169`, `s?.goal ?? 150`).
- **BR-7** Cykl raportów domyślnie 14 dni, zakres 3–90 (`page.tsx:175`, `report-cadence-form.tsx`).
- **BR-8** Płeć opcjonalna; bez wyboru używany jest wzór uniwersalny (hint w `body-params-form.tsx:106`).
- **BR-9** Usunięcie konta nieodwracalne; eksport obejmuje dane dostępne w aplikacji.
- **BR-10** Dane celów zapisywane jako całość JSON (`nutrition-settings.ts:88-99`). Konflikt dwóch urządzeń rozstrzyga architektura (US-10).
- **BR-11** Zmiana wagi w profilu nie zmienia wpisów w `weight_logs` i odwrotnie, chyba że decyzja P-1 to zmieni.

### 6.5 Wymagania niefunkcjonalne

- **NFR-1 Telefon w trakcie treningu**: ekran Profil nie jest ekranem treningowym, ale jest otwierany z przerwy. Cel: najważniejsza sekcja (cel cardio, przypomnienia) w ≤ 2 tapnięciach od wejścia.
- **NFR-2 Mobile first**: testy na 360, 390 i 430 px. Pola liczbowe z `inputMode` (zachować).
- **NFR-3 Dostępność**: etykiety pól, `aria-pressed` dla chipów i dni, `role="switch"` dla przełączników (jednolicie, R-8), kontrast tekstu `text-white/45` do weryfikacji (WCAG AA dla tekstu pomocniczego 13 px).
- **NFR-4 Tryb PWA / offline**: zapis wymaga sieci. Brak sieci: komunikat i brak utraty wpisanych wartości w formularzu (do decyzji architekta, czy zapisywać szkic lokalnie).
- **NFR-5 Prywatność**: waga, wzrost, wiek, płeć, cele kalorii i zgody to dane wrażliwe (zdrowie i ciało). Nie logować wartości w konsoli, Sentry ani w analityce. Redesign nie może dodać nowych zdarzeń analitycznych z tymi polami.
- **NFR-6 Wydajność**: ekran wykonuje dwa zapytania odczytu równolegle (`page.tsx:48-79`). Redesign nie powinien dodawać zapytań ani wczytywać całej historii kalendarza naraz.
- **NFR-7 Koszty**: brak nowych usług zewnętrznych; limity Turso/Upstash bez zmian.
- **NFR-8 Android i Java**: ekran korzysta z `AndroidAppVersionCard` i kanałów przypomnień (alarmy natywne). Redesign nie może zmienić kontraktu `/api/android/*` ani sposobu synchronizacji przypomnień bez osobnego zadania.
- **NFR-9 Spójność tekstów**: mikrokopia po polsku, bez odwołań do pozycji (R-9), bez żargonu w hintach (np. „Keytel”, „VAPID”).

### 6.6 Zmiany architektoniczne i wizualne (kierunki, bez decyzji technicznych)

- **Podział na podstrony lub zakładki** z podsumowaniem stanu na górze (np. „Cel cardio 150 min”, „Dzień treningowy 2050 kcal”, „Przypomnienia: 2 włączone”). Decyzja dla `ux` i `architekt`.
- **Wyraźne rozróżnienie** pól edytowalnych od wartości wyliczonych (kcal, suma dnia) i od stanu systemowego (kanał przypomnień, stan zgód).
- **Jeden model zapisu** (R-6) i widoczny stan zmian.
- **Strefa niebezpieczna** (eksport vs usunięcie) wyraźnie oddzielona.
- **Komponenty wspólne**: jeden switch, jeden zestaw chipów, jeden parser gramów (R-8).
- **Wartości domyślne** w formularzu usunięte (R-2).

---

## 7. Pytania otwarte

- **P-1 (źródło prawdy o wadze)**: która wartość wagi ma obowiązywać: profil (`users.weightKg`), ostatni raport sylwetki, czy ostatni wpis `weight_logs`? Czy zapis w profilu ma tworzyć wpis w historii wagi? Odpowiedź wpływa na T-1, US-4, BR-11.
- **P-2 (makro posiłków a cele dnia)**: czy 5 posiłków ma być osobno dla dnia treningowego i nietreningowego? Czy suma ma się mieścić w celu (tolerancja np. ±5%), czy tylko pokazywać różnicę? Czy przepisy w Diecie mają się skalować do celu dnia?
- **P-3 (wartości domyślne ciała)**: czy akceptujemy puste pola dla wagi, wzrostu i wieku przy pierwszym wejściu (R-2)? Czy wymagamy uzupełnienia przed korzystaniem z kcal z cardio?
- **P-4 (zgody RODO)**: czy zgody mają być zapisywane po stronie serwera (z datą i wersją), czy zostaje localStorage? Decyzja prawna przed zmianą prezentacji.
- **P-5 (forma nawigacji)**: czy redesign to podstrony (osobne adresy), zakładki w jednym widoku, czy pozostaje jedna przewijana strona z lepszym nagłówkiem?

**Założenia** (przyjęte, do potwierdzenia):
- A-1: redesign nie zmienia schematu bazy. Jeśli P-1 lub P-4 tego wymagają, wróci do `architekt` jako zmiana schematu.
- A-2: zachowujemy wszystkie funkcje z inwentarza F-1 do F-20.
- A-3: strefa kalendarza pozostaje `Europe/Warsaw`.

---

## 8. Decyzja o bramkach przepływu

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `architekt` (etap 3) | **TAK** | Zmiana struktury ekranu, wspólnych komponentów (T-6), jednego modelu zapisu (T-5), decyzje o P-1, P-2, BR-10. |
| `ux` (etap 4, makiety) | **TAK** | Nowa architektura informacji i hierarchia ekranu mobilnego (sekcja 4 i 6.6). |
| `prawnik` | **TAK, ocena zawężona** | Zmiana dotyczy prezentacji zgód RODO (T-10, F-15), eksportu (F-16) i usunięcia konta (F-17). Jeśli redesign tylko przesuwa elementy bez zmiany treści i skutku, wystarczy krótka ocena bez dokumentu. Jeśli zmienia się sposób zapisu zgód (P-4) lub tekst zgody, potrzebny pełny przegląd. |
| `tester-bezpieczenstwa` | **NIE na etapie analizy** | Brak zmian uwierzytelniania i uprawnień. Warunkowo TAK, jeśli wejdzie poprawka T-4 (walidacja kcal po stronie serwera w `meal-quick.ts`) lub zmiana sposobu zapisu zgód (P-4). |
| `tester-wydajnosci` | **NIE** | Redesign nie dodaje zapytań ani dużych list (NFR-6). Kalendarz pozostaje tygodniowy. Ponowna ocena, jeśli P-5 doda widoki historii wielu tygodni. |
| `tester` (etap 6) | **TAK** | Testy podstawowe: zapis każdej sekcji, puste pola (US-3), kcal i suma (US-2), usunięcie konta (US-8), wygląd na 360 px. |

Karta zadania `docs/zadania/007-redesign-profil.md` nie została założona w tym etapie (poza zakresem zlecenia). Koordynator zakłada ją przed etapem 3.

---

## 9. Ryzyka

- **Ryzyko danych (wysokie)**: rozjazd wagi między ekranami (R-1) i wartości domyślne (R-2) mogą podważyć wiarygodność całej analizy postępów. Należy je wyjaśnić przed redesignem, nie po.
- **Ryzyko zaufania do Diety (wysokie)**: suma posiłków 2812 kcal przy celu 1890-2050 kcal (R-3) to widoczny rozjazd. Bez decyzji P-2 redesign może go tylko ukryć.
- **Ryzyko prawne (średnie)**: zmiana prezentacji zgód i usunięcia konta bez oceny `prawnik`.
- **Ryzyko regresji (średnie)**: sześć niezależnych formularzy z różnymi modelami zapisu. Przy przebudowie łatwo zgubić zapis lub toast (F-19). Wymagane testy każdej sekcji.
- **Ryzyko kosztu (niskie)**: brak zmian w zapytaniach i usługach; ryzyko dotyczy tylko czasu implementacji.
- **Ryzyko spójności Android (średnie)**: przypomnienia zależą od kanału (`reminders-card.tsx:75-80`). Redesign nie może zmienić tej logiki bez osobnego zadania.
- **Dokumentacja**: `docs/zespol/wiedza-o-projekcie.md` nie zawiera (wg wyszukiwania) sekcji o profilu. Po wdrożeniu zadania trzeba dodać stan dziedziny Profil.

---

## 10. Podsumowanie dla koordynatora

- Wyliczenia kcal i suma makro posiłków są arytmetycznie poprawne. Rozjazd 2812 vs 2050/1890 kcal wynika z braku powiązania i walidacji, nie z błędu obliczeń.
- Najpilniejsze do rozstrzygnięcia przed redesignem: P-1 (źródło wagi), P-2 (makro posiłków a cele), P-3 (wartości domyślne).
- Etap 1 zakończony. Bez zmian w kodzie.
