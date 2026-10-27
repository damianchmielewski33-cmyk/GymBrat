# 008 - Redesign tworzenia i zarządzania planem treningowym (analiza)

- **Karta zadania**: `docs/zadania/008-redesign-planu-treningowego.md`
- **Etap**: 1 - Wymagania (analityk). Zero zmian w kodzie produkcyjnym.
- **Autor**: analityk (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `architekt` (etap 3) i `ux` (etap 4)

---

## 1. Kontekst i cel

Ekran planu treningowego jest dziś osadzony w Profilu (`/profile/workout-plan`, link "Ustaw plan" w sekcji "Trening i postępy"). Na jednym ekranie łączy pięć różnych rzeczy: import z pliku, listę planów, generator "Stwórz plan z AI", kreator "Dodaj swój plan" oraz edytor z panelem wyboru ćwiczeń. Użytkownik zgłasza, że ekran jest technicznie i wizualnie "w bałaganie".

Cel zadania (wg polecenia użytkownika):
1. Analiza techniczna i wizualna obecnego ekranu (sekcja 3 i 4).
2. Nowa architektura i flow tworzenia/ustawiania planu, zbudowane od nowa, nie iteracja na obecnym kodzie.
3. Nowa, lepsza baza ćwiczeń oraz czytelny, zwandowany atlas ćwiczeń.
4. Plany ustawiane WYŁĄCZNIE z nawigacji bocznej, nie z Profilu.
5. Całkowite usunięcie funkcji "Stwórz plan treningowy z AI" (bez śladów w UI i kodzie).
6. Jakość na poziomie dojrzałych aplikacji fitness (wzorzec jakości, nie kopiowanie brandingu).

Ten dokument zamyka etap wymagań. Nie projektuje architektury (to `architekt`) ani wyglądu (to `ux`).

---

## 2. Zakres

### 2.1 Wchodzi
- Nowy ekran zarządzania planami, osiągalny z menu bocznego (szuflada "Menu").
- Nowy flow tworzenia i edycji planu (nazwa, dni/ćwiczenia, serie, powtórzenia, RIR, link YouTube do techniki, notatka, tempo, superseria).
- Nowy atlas ćwiczeń (przeglądanie, wyszukiwanie PL/EN, filtr partii, karta ćwiczenia, dodawanie własnych).
- Przeniesienie importu PDF/Word/Excel do nowego flow (zachowanie parserów, zmiana UI).
- Usunięcie funkcji AI z UI, akcji serwerowych, modułu generatora i testów.
- Przekierowania ze starych ścieżek (`/profile/workout-plan`, `/profile/workout-plan?edit=...`).
- Usunięcie sekcji planu z Profilu.

### 2.2 Nie wchodzi
- Hub "Treningi" (`/workout-plan`): wybór dnia, start sesji, kolejka planów, karta "Następny". Zostaje, z drobnymi zmianami linków (sekcja 3.3).
- Sesja aktywnego treningu (`/active-workout`) i podpowiedzi coacha w trakcie serii (`lib/live-set-coach.ts`, heurystyki z `ai/coach.ts` związane z sesją).
- Generator grafik przepisów (Pollinations) i pozostałe funkcje "AI" poza planem (`analyzeBodyPhoto`, `compareProgressPhotos` - stuby; osobne zadanie, jeśli kiedyś).
- Eksport planu do PDF (`lib/pdf/workout-plan-export.ts`) - zostaje jako funkcja, nie jest częścią redesignu ekranu (do decyzji `architekt`, czy przenieść wywołanie).
- Zmiany w Javie (`java-backend/`): wg przeszukania nie ma w niej CRUD planów; Java dotyka jedynie zakończenia treningu. Potwierdzi `architekt`.
- Płatności, pakiety, przypomnienia (poza linkiem do planu).

---

## 3. Inwentaryzacja obecnego kodu

Legenda losu: **U** = usunąć, **P** = przerobić / przepisać od nowa, **Z** = zostaje bez zmian, **R** = przenieść (zmiana ścieżki/miejsca wywołania).

### 3.1 Funkcja AI (do usunięcia)

| Plik | Co robi | Los |
|---|---|---|
| `components/workout-plan/workout-plan-editor.tsx` (linie ~100-105, 580-698, importy `Sparkles`, `generateAndSaveAiWorkoutPlans`) | Kafelek "Stwórz plan treningowy z AI", stany `aiPending/aiError/aiDays/aiLevel`, wybór dni i poziomu, przycisk "Wygeneruj plan" | U (razem z edytorem, który i tak jest przepisywany) |
| `actions/ai-workout-plan.ts` | Server action `generateAndSaveAiWorkoutPlans` - wywołuje `aiGeneratePlan`, mapuje dni i zapisuje plany | U (cały plik) |
| `actions/backend.ts`, funkcja `aiGeneratePlan` (ok. linii 265-353) | Zbiera profil (waga, wzrost, aktywność, cele), dzisiejsze podsumowanie żywienia (`loadTodaysNutritionSummary`) i woła `generateTrainingPlan` | U (funkcja). Import `generateTrainingPlan`, `TrainingPlanInput` - U. `analyzeBodyPhoto` i `AiImage` - Z |
| `ai/coach.ts`: `TrainingPlanSchema`, `TrainingPlan`, `TrainingPlanInput`, `makeHeuristicPlan`, `generateTrainingPlan` | Heurystyczny generator planu (bez LLM, mimo nazwy "AI") | U. Pozostałe eksporty (`analyzeBodyPhoto`, `compareProgressPhotos`, typy `BodyAnalysis`, `ProgressReport`) - Z. Helpery `clamp`, `heuristicProteinGPerDay` - sprawdzić, czy używane gdzie indziej (`architekt`) |
| `lib/ai-training-plan-to-payload.ts` (`trainingPlanToWorkoutPayloads`) | Mapuje wynik generatora na `WorkoutPlanPayload` | U |
| `lib/training-feature-pack.test.ts` | Testy m.in. `trainingPlanToWorkoutPayloads` | P - usunąć tylko przypadki AI, reszta zostaje |
| `scripts/codemod-guard-server-actions.mjs`, linie 18-19 | Limity `aiGeneratePlan` i `generateAndSaveAiWorkoutPlans` | U (wpisy). `aiAnalyzePhoto` - Z |
| `docs/workout-plan-creation.json` | Dokumentacja procesu, opisuje 3 ścieżki (ręczna, "AI", import) | P - aktualizacja po wdrożeniu (dokument ma `date` 2026-10-22 i jest już nieaktualny w części dot. AI) |

Dane użytkowników: plany wygenerowane kiedyś przez AI są zapisywane jako zwykłe rekordy `workout_plans` (bez znacznika źródła). Usunięcie funkcji **nie wymaga migracji danych**; plany zostają jako zwykłe plany. Zob. BR-9.

Wpływ na prywatność: generator AI czytał wagę, wzrost, wiek, aktywność i dzisiejsze makro. Po usunięciu te dane nie są przetwarzane w tym przepływie (dobra zmiana dla `prawnik`, sekcja 7).

Na liście komponentów w kodzie nie znaleziono innych odwołań do AI planu (przeszukanie: `aiGeneratePlan`, `generateAndSaveAiWorkoutPlans`, `generateTrainingPlan`, `trainingPlanToWorkoutPayloads`, "Stwórz plan", "Wygeneruj plan" poza plikami wymienionymi wyżej i dokumentacją).

### 3.2 Obecny edytor i lista planów w Profilu (do przepisania)

| Plik | Co robi | Los |
|---|---|---|
| `app/(dashboard)/profile/workout-plan/page.tsx` | Strona edytora; czyta `?edit=<id>` (po imporcie) | P - przenieść do nowej trasy, dodać przekierowanie ze starej |
| `app/(dashboard)/profile/page.tsx` (linie 146-164) | Sekcja "Trening i postępy", blok "Plan treningowy" z przyciskiem "Ustaw plan" | P - usunąć blok planu. Cele cardio, cykl raportów, jednostka porównań - Z |
| `components/workout-plan/workout-plan-editor.tsx` (1143 linii) | Lista planów (rozwijane karty), edytor (nazwa, ćwiczenia, serie, powtórzenia, RIR, tempo, notatka, YouTube, superseria, kolejność), panel "Dodaj ćwiczenie" (sheet), usuwanie planu, usuwanie ćwiczenia z listy, kreator wyboru, import | P - przepisać od nowa (zob. sekcja 4) |
| `components/workout-plan/workout-card.tsx` (`WorkoutCard`) | Karta dnia | U - **martwy kod**: brak importów w repozytorium |
| `components/workout-plan/workout-plan-word-import.tsx` | Karta importu PDF/Word/Excel z przełącznikiem, wysyłka do API, przekierowanie do edycji | P - zostaje logika (wysyłka, CSRF, walidacja rozmiaru), zmienia się UI i miejsce (sekcja 6) |
| `actions/workout-plan.ts` | `getWorkoutPlans`, `saveWorkoutPlan` (tworzenie/aktualizacja, migracja nazw w historii), `deleteWorkoutPlan`, `getWorkoutPlansWithLastWorkout`, `fetchLastWorkoutHintsForPlan` | Z (kontrakt danych). Do decyzji `architekt`: czy dodać osobne akcje (np. przeniesienie ćwiczenia, zmiana kolejności), czy zostawić pełny zapis planu |
| `lib/workout-plan-types.ts` (`WorkoutPlanPayload` v2, `WorkoutPlanExercise`) | Format JSON planu, jeden rekord = jeden dzień | Z (bez zmiany w v1 - zob. pytanie Q3) |
| `lib/workout-plan-utils.ts` (`normalizeWorkoutPlan`) | Normalizacja odczytu JSON | Z |
| `lib/workout-exercise-rename.ts` | Przy zmianie nazwy ćwiczenia przepisuje historię sesji i aktywną sesję | Z - krytyczne, zachować zachowanie (BR-7) |
| `db/schema.ts` - tabela `workout_plans` (`id`, `user_id`, `plan_json`, `created_at`, `updated_at`) | Jedna tabela, cała struktura w `plan_json` | Z w v1 (zob. pytanie Q3) |

Obecne zachowania do zachowania (funkcjonalna paryteta, bez AI):
- Zapis planu: nazwa obowiązkowa; walidacja formatu `version: 2`, `path: "custom"`.
- Serie 1-20, powtórzenia 1-999, RIR 0-5 lub brak, tempo i notatka wolnym tekstem, link YouTube normalizowany (`normalizeYoutubeUrl`).
- Superseria: łączenie z następnym ćwiczeniem, rozłączanie.
- Własne ćwiczenia zapisywane w `userCustomExerciseNames` i wyświetlane w wyborze.
- Zmiana nazwy ćwiczenia w planie przepisuje historię (zob. BR-7).
- Usunięcie planu wymaga potwierdzenia.

### 3.3 Punkty wejścia do planu (do przepięcia)

| Miejsce | Obecny link | Działanie po zmianie |
|---|---|---|
| Menu boczne `components/layout/app-menu-button.tsx`, sekcja "Trening", wiersz "Plan treningowy" (linie 346-353) | `/workout-plan` (hub Treningi, nie edytor) | Mylące: etykieta "Plan" prowadzi do startu. Do przeprojektowania: osobne wejście "Plany treningowe" (zarządzanie) i "Treningi" (start) - zob. pytanie Q2 |
| `components/treningi/no-plan-card.tsx` (linia 26) | `/profile/workout-plan` ("Ustaw plan") | Przepiąć na nową trasę (lub usunąć CTA - Q2) |
| `components/treningi/next-workout-card.tsx` (linia 69) | `/profile/workout-plan` | Przepiąć |
| `components/treningi/plan-day-row.tsx` (linia 112) | `/profile/workout-plan` | Przepiąć |
| `components/treningi/plan-days-panel.tsx` (linia 58) | `/profile/workout-plan` | Przepiąć |
| `components/treningi/plan-day-preview-sheet.tsx` (linia 97) | `/profile/workout-plan` | Przepiąć |
| `components/layout/app-shell.tsx` - dolna belka "Trening" → `/workout-plan` | Hub Treningi | Bez zmiany (start sesji). FAB "Raport" pojawia się na `/workout-plan*` - do decyzji `ux`, czy nowa trasa `/plany*` ma go mieć |
| `app/api/workout-plans/import/route.ts` (`revalidatePath` na `/profile/workout-plan`) | Rewalidacja | Przepiąć rewalidację na nową trasę |
| `actions/workout-plan.ts` (`revalidatePath` x 6) | Rewalidacja | Przepiąć |
| `components/workout-plan/workout-plan-word-import.tsx` (`router.push("/profile/workout-plan?edit=...")`) | Po imporcie | Przepiąć na nową trasę edytora |
| `components/admin/admin-exercises-client.tsx` (opis: "Główne linki „technika ↗” ustawiasz przy układaniu planu (Profil → Plan treningowy)") | Tekst pomocy | Zaktualizować tekst |
| `lib/reminders-schedule.ts` (`url: "/workout-plan"`), `lib/web-push.ts` | Przypomnienia kierują do Treningów | Bez zmiany |
| `app/(dashboard)/start-workout/page.tsx` (redirect do `/workout-plan`) | Stary start | Bez zmiany |
| `docs/workout-plan-creation.json` (`uiRoute`, `relatedRoutes`) | Dokumentacja | Aktualizacja |
| `lib/auth-public-paths.test.ts` (`mustCompleteProfile("/workout-plan")`) | Test ścieżek | Sprawdzić, czy nowa trasa wymaga tego samego kontraktu (`architekt`) |
| `e2e/diet-admin-session.spec.ts` (`/workout-plan`) | Test E2E | Bez zmiany (hub zostaje) |

Android: w repozytorium `android/` nie znaleziono odwołań do `workout-plans` ani `profile/workout-plan`. Przypomnienia w `ReminderReceiver.java` otwierają `/workout-plan`, które zostaje. Wpływ na Android: niski (potwierdzi `architekt`).

### 3.4 Baza ćwiczeń i atlas (źródło do przeprojektowania)

| Plik | Co robi | Los |
|---|---|---|
| `lib/workout-exercise-catalog.ts` | 14 kategorii partii (`MUSCLE_CATEGORIES`), **165 ćwiczeń** statycznie w kodzie (`CATALOG_EXERCISES`: `id`, `name` PL, `categoryId`, `aliasesEn`), wyszukiwanie z normalizacją PL (`normalizeForSearch`, `exerciseMatchesQuery`), `findBestCatalogMatch`, `searchCatalogForPicker` | P - rozbudować model (zob. sekcja 5, US-10). Logika wyszukiwania - Z jako punkt wyjścia |
| `lib/resolve-exercise-muscles.ts` | Partia główna i synergiści (`SECONDARY_BY_PRIMARY`), `preferBackView`, `resolveExerciseCategoryIdForPlan` | Z - źródło danych do sylwetki |
| `lib/infer-muscle-category.ts` | Heurystyka partii z nazwy (PL/EN) | Z (fallback) |
| `lib/exercise-identity.ts` | Tożsamość ćwiczenia po nazwie (`foldExerciseText`, `isSameExercise`) | Z - ważne dla progresji i historii |
| `db/schema.ts` - `exercise_technique_links` (`id`, `youtube_url`, `updated_at`, `updated_by_user_id`) | Linki YouTube do ćwiczeń z katalogu, zarządzane w panelu admina | Z jako źródło domyślne; zob. pytanie Q4 i sekcja 4.4 |
| `lib/exercise-technique-store.ts`, `actions/exercise-technique.ts`, `lib/attach-technique-urls.ts` | Odczyt mapy linków, dopisywanie URL do ćwiczeń (sesja aktywna) | Z |
| `app/api/admin/exercises/technique/route.ts`, `components/admin/admin-exercises-client.tsx` | Panel admina: lista ćwiczeń z katalogu, edycja linku YouTube, filtr "bez linku" | Z (funkcja). Zmienić tekst opisowy (sekcja 3.3) |
| `components/active-workout/workout-plan-card.tsx` (`WorkoutPlanCard`) | Karta planu w sesji | Z (poza zakresem; sprawdzić ponowne użycie wizualne z `ux`) |
| Sylwetka partii (komponent) | Wg changelogu i `resolve-exercise-muscles` istnieje widok sylwetki z podświetlonymi partiami (`preferBackView`) | Do wskazania przez `ux`/`architekt` - w przeszukaniu nie zlokalizowano komponentu pod typową nazwą (`MuscleMap`/`BodyMap`), więc ponowne użycie wymaga potwierdzenia |

Obecne ograniczenia katalogu, które wpływają na atlas:
- Brak opisu wykonania, wskazówek (cue), sprzętu, poziomu trudności, ikony/grafiki.
- Partia tylko jedna (`categoryId`) plus synergiści wyliczani osobno; brak jawnych danych o mięśniach głównych/pomocniczych na ćwiczeniu.
- Aliasy tylko angielskie; polskie synonimy (np. "wiosłowanie", "martwy ciąg") działają przez nazwę, nie przez alias.
- Własne ćwiczenia użytkownika są tylko ciągami tekstu, bez partii ani metadanych (partia dopisywana przez dopasowanie).

### 3.5 Import z pliku (zostaje, zmienia UI)

| Plik | Co robi | Los |
|---|---|---|
| `app/api/workout-plans/import/route.ts` | POST: CSRF, sesja, rate limit (klucz `workout-plan-import`, bucket `bodyReportImport`), limit 8 MB, wykrywanie typu, parsowanie, fallback między parserami, zapis rekordów `workout_plans` | Z logika. Zmiana: zapis dopiero po zatwierdzeniu podglądu (rekomendacja, sekcja 6). Uwaga nazewnicza: używa bucketu `bodyReportImport` - do wyjaśnienia (`architekt`) |
| `lib/pdf/workout-plan-import.ts`, `lib/docx/workout-plan-import.ts`, `lib/excel/workout-plan-import.ts` | Parsery do `WorkoutPlanPayload` | Z |
| `lib/workout-plan-file-kind.ts`, `lib/workout-plan-upload.ts` | Wykrywanie typu i nazwy pliku | Z |
| `components/workout-plan/workout-plan-word-import.tsx` | UI importu | P (przenieść do nowego kreatora) |

Testy istniejące: `lib/pdf/workout-plan-import.test.ts`, `lib/docx/workout-plan-import.test.ts`, `lib/excel/workout-plan-import.test.ts`, `lib/workout-plan-upload.test.ts`, `lib/workout-plan-file-kind` (pośrednio). Zostają bez zmian, jeśli parsery się nie zmieniają.

---

## 4. Analiza obecnego ekranu (techniczna i wizualna)

Źródła: `profile/page.tsx`, `profile/workout-plan/page.tsx`, `workout-plan-editor.tsx`, `workout-card.tsx`, `workout-plan-word-import.tsx`, `app-menu-button.tsx`, `app-shell.tsx`, `no-plan-card.tsx`. Zrzuty ekranu od użytkownika potwierdzają opis.

### 4.1 Problemy architektury i danych
1. **Jeden plik-bóg**: `workout-plan-editor.tsx` (1143 linie) zawiera listę, edytor, sheet wyboru ćwiczeń, kreator AI, import i logikę zapisu. Brak podziału na komponenty i hooki. Utrudnia testy i zmiany.
2. **Dwa stany edycji naraz**: lista (rozwijane karty z przyciskiem Usuń przy ćwiczeniu) zapisuje plan natychmiast przez `saveWorkoutPlan` (funkcja `removeExerciseFromListedPlan`), a edytor działa na buforze i zapisuje dopiero "Zapisz". Dwie ścieżki zapisu tego samego planu, bez blokady ani ostrzeżenia.
3. **Zamknięcie edytora gubi zmiany**: "Zamknij edytor" i "Anuluj" wywołują `closeEditor()` bez pytania o niezapisane zmiany.
4. **Usuwanie ćwiczenia z listy bez potwierdzenia**: jednym kliknięciem, bez cofnięcia (utrata danych).
5. **Natywne `window.confirm`** przy usuwaniu planu - niezgodne z językiem wizualnym aplikacji.
6. **Martwy kod**: `components/workout-plan/workout-card.tsx` (`WorkoutCard`) nie jest importowany.
7. **Zduplikowana logika domyślnych serii**: `typeof ex.sets === "number" && ex.sets > 0 ? ex.sets : 3` w co najmniej czterech miejscach edytora (`planSetCount`, lista, edytor, input), obok `normalizeWorkoutPlan`.
8. **Brak limitów po stronie serwera**: `saveWorkoutPlan` nie ogranicza liczby planów, ćwiczeń ani długości nazw/notatek (poza walidacją wersji). Brak limitu po stronie UI.
9. **Brak wersjonowania i konfliktów**: zapis całego JSON planu, `updatedAt` bez sprawdzenia wersji. Dwa urządzenia równocześnie = ostatni zapis wygrywa (w praktyce akceptowalne dla planu, ale do opisania; BR-10).
10. **Zapis i rewalidacja**: `saveWorkoutPlan` rewalidują co najmniej 6 ścieżek; ryzyko pominięcia nowej trasy przy zmianie.
11. **Model "plan = dzień"**: jeden rekord = jeden dzień; brak encji tygodnia/programu. Lista "Twoje plany" to w praktyce lista dni. Użytkownik i UI nazywają to "planem" - rozjazd pojęciowy (zob. Q3).
12. **Linki techniki - dwa źródła prawdy**: link per ćwiczenie w planie (`techniqueYoutubeUrl` w JSON) oraz link per ćwiczenie z katalogu w tabeli `exercise_technique_links` (panel admina). Edytor nie czyta tabeli admina; admin opisuje, że "główne linki" ustawia się "przy układaniu planu". Niespójne.

### 4.2 Problemy UX / wizualne (ekran "Plan treningowy")
1. **Pięć sposobów na zrobienie tego samego** na jednym ekranie: link "Nowy plan", kafelek "Dodaj swój plan treningowy", przycisk "Moje ćwiczenia", karta "Import planu", kafelek "Stwórz plan z AI". Brak hierarchii.
2. **Trzy karty przed listą**: nagłówek, import, lista, potem dwa duże kafelki - ekran ma kilka równorzędnych bloków bez jednego głównego działania.
3. **"Moje ćwiczenia" nie robi tego, co mówi**: otwiera nowy, niezapisany plan i od razu panel dodawania ćwiczeń. Etykieta wprowadza w błąd.
4. **Uchwyt przeciągania (GripVertical) na liście planów nie działa** - to tylko ikona (`aria-hidden`), bez obsługi przeciągania. Myląca affordancja. Zmiana kolejności działa tylko w edytorze przyciskami góra/dół.
5. **Podwójne akcje zapisu**: "Zapisz plan" w nagłówku i "Zapisz" na dole edytora; plus "Zamknij edytor", "Anuluj" - trzy wyjścia z edytora.
6. **Nagłówek opisowy zmienia się i jest długi** ("Nadaj nazwę dnia, ustaw ćwiczenia, serie, RIR i link YouTube do techniki. Start sesji jest w zakładce Treningi."). Tekst pomocniczy zajmuje miejsce, a nie prowadzi.
7. **Przeładowany wiersz ćwiczenia**: w jednej karcie: strzałki, nazwa, kategoria, licznik serii, usuń, pole YouTube, cztery pola liczbowe (serie, powtórzenia, RIR, tempo), superseria, notatka. Około 4 rzędów inputów na ćwiczenie. Na telefonie (w trakcie treningu i przy wyborze) trudno utrzymać przegląd.
8. **Pola liczbowe bez kontrolek**: serie, powtórzenia, RIR to małe inputy bez przycisków +/-; RIR i tempo nie mają podpowiedzi jednostek ani zakresów poza atrybutami HTML.
9. **Mieszanie stylów kart**: `glass-panel`, `app-card`, `app-card-raised` (profil), karty `#161616` / `#121214` z zaokrągleniami `rounded-[18px]`, `rounded-[22px]`, `rounded-2xl`; akcenty `--neon` i `--gym-gold` przemiennie (kafelek AI i "Dodaj" w neonie, import w złotym, CTA w `cta`). Brak jednego systemu (do potwierdzenia przez `docs/ux/00-system-projektowy-stan.md`).
10. **Panel wyboru ćwiczeń (sheet)**: natywny `select` partii, pole wyszukiwania, lista bez grafik i metadanych, "Dodaj własne" schowane za linkiem. Sheet wymusza scroll, a wynik wyszukiwania miesza kategorię aktywną z resztą katalogu (etykieta "Partia: ..."), co utrudnia skanowanie.
11. **Atlas nie istnieje**: użytkownik nie ma miejsca, żeby przeglądać ćwiczenia poza kontekstem planu (brak karty ćwiczenia, opisu, sylwetki, historii obciążeń).
12. **Dwie różne "karty planu"**: `WorkoutPlanCard` (sesja) i lista w edytorze wyglądają inaczej; hub Treningi ma jeszcze trzecią (`NextWorkoutCard`, `PlanDayRow`).
13. **Pusty stan**: "Nie masz jeszcze zapisanego planu. Wybierz „+ Nowy plan” poniżej." - odsyła do elementu, który jest pod listą, a nie w widoku głównym.
14. **Brak sylwetki i ikon partii** na liście i w wyborze - partie tylko tekstem.

### 4.3 Ryzyka dla użytkownika (priorytetowe do naprawy w nowym projekcie)
- Utrata zmian przy zamknięciu edytora (4.1-3).
- Utrata ćwiczenia przy jednym kliknięciu na liście (4.1-4).
- Mylące wejście "Plan treningowy" w menu (prowadzi do startu, nie do edycji) (3.3).
- Niespójne linki techniki (4.1-12).

### 4.4 Co już działa dobrze (zachować w duchu)
- Wyszukiwarka z normalizacją PL i aliasami EN (dopasowanie tokenowe, stopwords).
- Zmiana nazwy ćwiczenia przepisuje historię (BR-7).
- Import z trzech formatów z walidacją typu, rozmiaru i CSRF.
- Zachowanie `lastWorkout`/kolejki planów w Treningach.

---

## 5. Wymagania funkcjonalne - user stories i kryteria akceptacji

Format: "Jako <rola> chcę <cel>, aby <korzyść>". Kryteria w Given/When/Then. Priorytet MoSCoW.

Role: **Osoba ćwicząca** (początkująca i zaawansowana), **Osoba prowadząca dietę** (w kontekście wspólnego menu, bez nowych wymagań), **Administrator** (katalog i linki techniki), **Użytkownik społeczności** (bez zmian w tym zadaniu).

### US-1 Dostęp do planów z menu bocznego (Must)
Jako osoba ćwicząca chcę otworzyć zarządzanie planami z menu bocznego, aby nie szukać ich w Profilu.

- AC-1.1: Given zalogowana osoba, When otwiera menu (ikona ☰), Then w sekcji "Trening" widzi pozycję "Plany treningowe" prowadzącą do listy planów.
- AC-1.2: Given zalogowana osoba, When wchodzi w Profil, Then nie widzi bloku "Plan treningowy" ani przycisku "Ustaw plan".
- AC-1.3: Given stary adres `/profile/workout-plan`, When ktoś go otworzy (także z zakładki), Then zostaje przekierowany na nową listę planów (kod stały, bez 404).
- AC-1.4: Given stary adres `/profile/workout-plan?edit=<id>`, When otwarty, Then przekierowanie prowadzi do edycji tego samego planu w nowej trasie (identyfikator bez zmian).
- AC-1.5: Given wejście "Treningi" w menu, When otwarte, Then prowadzi do startu/hubu Treningi, a nie do edycji (rozdzielenie "Start" i "Zarządzanie").
- AC-1.6 (przypadek brzegowy): Given użytkownik niezalogowany, When otwiera nową trasę, Then zostaje przekierowany do logowania (jak dziś).
- AC-1.7 (przypadek brzegowy): Given ekran mobilny z otwartą szufladą menu, When wybiera "Plany treningowe", Then szuflada się zamyka i nie zostaje zablokowany scroll body.

### US-2 Lista planów i stan pusty (Must)
Jako osoba ćwicząca chcę widzieć swoje plany i ich podsumowanie, aby szybko wybrać, co edytować.

- AC-2.1: Given użytkownik ma plany, When otwiera listę, Then każdy plan pokazuje nazwę, liczbę ćwiczeń, liczbę serii, datę ostatniej zmiany i partie (sylwetka lub ikony).
- AC-2.2: Given użytkownik nie ma planów (pierwsze użycie bez danych), When otwiera listę, Then widzi jeden główny CTA "Utwórz pierwszy plan" oraz drugi wybór "Importuj z pliku", bez innych kafelków.
- AC-2.3: Given plan jest uszkodzony (nieparsowalny JSON), When lista się ładuje, Then uszkodzony wpis jest pominięty (jak dziś) i użytkownik widzi informację "Część planów nie mogła zostać wczytana" z opcją kontaktu/zgłoszenia (bez utraty pozostałych).
- AC-2.4: Given lista ma wiele planów (np. 30), When przewijana na telefonie, Then przewijanie pozostaje płynne, a karty nie ładują zbędnych danych (paginacja lub lazy - architekt).
- AC-2.5: Given użytkownik ma ustawioną kolejkę treningów, When ogląda listę, Then kolejność planów jest zgodna z kolejnością sesji w Treningach, albo jasno opisana (do decyzji - Q3).

### US-3 Tworzenie planu od zera (Must)
Jako osoba ćwicząca chcę utworzyć plan dnia z ćwiczeniami, aby mieć gotowy trening do startu.

- AC-3.1: Given nowy plan, When użytkownik podaje nazwę (np. "Push A") i dodaje ćwiczenia, Then zapis wymaga nazwy (1-80 znaków, założenie), a komunikat błędu jest przy polu, nie w nagłówku.
- AC-3.2: Given ćwiczenie w planie, When edytuje serie (1-20), powtórzenia (1-999), RIR (0-5 lub brak), tempo (format np. "3010", max 8 znaków), notatkę (max 200 znaków, założenie), Then wartości są walidowane w miejscu, a nieprawidłowe nie zapisują się.
- AC-3.3: Given zapis planu, When udany, Then użytkownik wraca na listę i widzi komunikat potwierdzający, a plan jest od razu dostępny w Treningach.
- AC-3.4: Given zapis nieudany (brak sieci na siłowni), When użytkownik klika "Zapisz", Then zmiany pozostają w formularzu (szkic lokalny), a użytkownik widzi "Brak połączenia - zapiszemy, gdy wrócisz online" lub ponowi próbę (do decyzji `architekt`).
- AC-3.5 (przypadek brzegowy - zamknięcie): Given niezapisane zmiany, When użytkownik zamyka edytor lub wychodzi wstecz, Then pojawia się potwierdzenie "Odrzucić zmiany?" (nigdy cicha utrata).
- AC-3.6 (przypadek brzegowy - przerwany proces): Given edycja w toku, When aplikacja zostanie zamknięta lub odświeżona, Then przy powrocie użytkownik może przywrócić szkic (autosave lokalny - rekomendacja).
- AC-3.7: Given plan bez ćwiczeń, When zapis, Then system pozwala zapisać plan pusty jako szkic LUB blokuje z komunikatem "Dodaj co najmniej jedno ćwiczenie" - do decyzji (Q5 lub założenie: blokada zapisu do Treningów, szkic dozwolony).

### US-4 Dodawanie ćwiczeń z atlasu (Must)
Jako osoba ćwicząca chcę wybrać ćwiczenie z atlasu, aby nie wpisywać nazw ręcznie.

- AC-4.1: Given edytor, When użytkownik klika "Dodaj ćwiczenie", Then otwiera się wybór z atlasu z filtrem partii (chipy) i wyszukiwarką.
- AC-4.2: Given fraza "bench press" lub "wyciskanie", When wpisana, Then wyniki zawierają wyciskanie sztangi (dopasowanie PL/EN, bez wrażliwości na ogonki).
- AC-4.3: Given pusta fraza, When wybrana partia, Then lista pokazuje ćwiczenia tej partii, posortowane alfabetycznie lub wg popularności (założenie: alfabetycznie).
- AC-4.4: Given wybrane ćwiczenie, When dodane, Then trafia na koniec planu z domyślnymi wartościami (3 serie, 10 powtórzeń, RIR 1) i panel się zamyka lub zostaje otwarty w trybie "dodaj kolejne" (do decyzji `ux`).
- AC-4.5 (brzeg - brak wyników): Given fraza bez trafień, When wyszukiwanie, Then komunikat "Brak wyników dla „…”" oraz przycisk "Dodaj jako własne ćwiczenie" z podaną nazwą.
- AC-4.6 (brzeg - duplikat): Given ćwiczenie już jest w planie, When użytkownik dodaje je ponownie, Then system pyta "Dodać drugi raz?" albo dodaje z oznaczeniem (założenie: dozwolone, z ostrzeżeniem).
- AC-4.7: Given wyszukiwanie, When wpisano 1 znak, Then wyniki nie są pokazywane (lub pokazują podpowiedź "wpisz min. 2 znaki") - unikanie szumu.

### US-5 Własne ćwiczenie (Should)
Jako osoba ćwicząca chcę dodać ćwiczenie spoza atlasu, aby mieć pełny plan.

- AC-5.1: Given wpisana nazwa własnego ćwiczenia (2-80 znaków), When użytkownik wybiera partię, Then ćwiczenie trafia do planu i do listy "Moje ćwiczenia" użytkownika.
- AC-5.2: Given nazwa pasuje do atlasu (np. "Wyciskanie hantli"), When wpisana, Then system proponuje wybór katalogowego (z potwierdzeniem), zamiast tworzyć duplikat.
- AC-5.3: Given własne ćwiczenie użyte w planie, When użytkownik zmienia nazwę, Then historia się przepisuje (BR-7).
- AC-5.4: Given własne ćwiczenie, When inny użytkownik, Then go nie widzi (izolacja danych).

### US-6 Edycja, kolejność i usuwanie (Must)
Jako osoba ćwicząca chcę zmieniać kolejność i usuwać ćwiczenia, aby plan odpowiadał mojej salce.

- AC-6.1: Given plan z 5 ćwiczeniami, When użytkownik przesuwa ćwiczenie w górę/dół (przyciski lub przeciąganie na dotyk), Then kolejność zapisuje się po "Zapisz" i jest zachowana w Treningach.
- AC-6.2: Given ćwiczenie w planie, When użytkownik klika "Usuń", Then pojawia się potwierdzenie albo cofnięcie (toast "Cofnij" przez kilka sekund) - nigdy natychmiastowe nieodwracalne usunięcie z listy.
- AC-6.3 (brzeg - ostatnie ćwiczenie): Given plan z jednym ćwiczeniem, When usunięte, Then plan pozostaje z pustą listą i komunikatem.
- AC-6.4: Given superseria, When użytkownik łączy ćwiczenie z następnym, Then oba są wizualnie zgrupowane; rozłączenie działa na całej grupie (zachowanie dzisiejsze).
- AC-6.5: Given plan w trakcie sesji (aktywny trening z tym planem), When użytkownik edytuje plan, Then sesja nie zmienia się w tle bez informacji (zmiany dotyczą następnej sesji) - do potwierdzenia przez `architekt`.
- AC-6.6: Given usunięcie planu, When użytkownik potwierdzi, Then plan znika z listy i Treningów; historia zakończonych treningów zostaje (zapis `workouts` nie zależy od planu - do weryfikacji).

### US-7 Import z pliku PDF / Word / Excel (Should, zostaje)
Jako osoba ćwicząca chcę zaimportować plan z pliku, aby nie przepisywać go ręcznie.

- AC-7.1: Given wybór pliku w obsługiwanym formacie (.pdf, .doc, .docx, .xlsx, .xls, .xlsm) do 8 MB, When użytkownik zatwierdza, Then system parsuje plik i pokazuje PODGLĄD wykrytych dni i ćwiczeń przed zapisem (rekomendacja).
- AC-7.2: Given podgląd, When użytkownik odznaczy dzień lub ćwiczenie, Then tylko zaznaczone trafią do zapisu.
- AC-7.3: Given plik pusty / zbyt duży / nieobsługiwany, When wysłany, Then komunikat bez zmian treści z dzisiejszej walidacji (jasny, po polsku).
- AC-7.4: Given plik bez rozpoznanych ćwiczeń, When parsowany, Then komunikat "Nie znaleziono ćwiczeń w dokumencie" i wskazówka formatu (dzisiejsze teksty).
- AC-7.5: Given import udany, When zakończony, Then użytkownik trafia do edycji zaimportowanego planu (jak dziś), a przy wielu dniach - do listy z wyróżnieniem nowych.
- AC-7.6 (brzeg - Android): Given plik bez rozszerzenia z Androida (pusta nazwa, MIME `octet-stream`), When wybrany, Then import działa jak dziś (`namedUploadFile`, `resolveUploadName`).

### US-8 Atlas ćwiczeń (Must)
Jako osoba ćwicząca chcę przeglądać atlas ćwiczeń po partiach, aby poznać ruchy i ich technikę.

- AC-8.1: Given wejście "Atlas ćwiczeń" w menu lub na liście planów, When otwarte, Then widzę partie jako kafelki z ikoną/sylwetką i liczbą ćwiczeń.
- AC-8.2: Given wybraną partię, When otwarta, Then lista ćwiczeń pokazuje nazwę PL, sprzęt, poziom (jeśli dostępny), ikonę partii głównej.
- AC-8.3: Given ćwiczenie, When otwarte, Then karta pokazuje: nazwę PL i aliasy EN, mięśnie główne i pomocnicze (sylwetka), opis wykonania (2-4 zdania), 2-3 wskazówki (cue), sprzęt, link do techniki (YouTube, otwierany zewnętrznie), historię obciążeń użytkownika (jeśli istnieje) i przycisk "Dodaj do planu".
- AC-8.4 (brzeg - brak metadanych): Given ćwiczenie z katalogu bez opisu/cue, When otwarte, Then karta pokazuje nazwę, partię i sylwetkę, a sekcje bez danych są ukryte (nie puste nagłówki).
- AC-8.5 (brzeg - brak linku): Given brak linku techniki, When karta, Then nie ma przycisku "technika", a jest tekst "Brak filmu - zgłoś" (lub brak).
- AC-8.6: Given wyszukiwanie w atlasie, When fraza PL lub EN, Then działa jak w US-4.
- AC-8.7 (wydajność): Given 165+ ćwiczeń i ikony/grafiki, When otwarty atlas na telefonie 4G, Then lista startuje w < 2 s (SLO do ustalenia z `tester-wydajnosci`); grafiki leniwe.
- AC-8.8 (dostępność): Given użytkownik czytnika ekranu, When przegląda atlas, Then każda partia i ćwiczenie ma czytelną nazwę, a sylwetka ma tekst alternatywny z listą partii.
- AC-8.9 (zasada): Given ćwiczenie, When podawane są opisy/cue, Then teksty są autorskie lub z licencją (nie kopiujemy treści konkurencji - BR-11).

### US-9 Ikony i sylwetka partii (Should)
Jako osoba ćwicząca chcę rozpoznawać partie wzrokowo, aby szybciej wybierać ćwiczenia.

- AC-9.1: Given lista partii, When wyświetlona, Then każda partia ma stałą ikonę/kolor i nazwę tekstową (kolor nie jest jedynym nośnikiem informacji).
- AC-9.2: Given ćwiczenie z partią główną i pomocniczą, When w karcie, Then partia główna jest wyróżniona, a pomocnicza słabiej (zgodnie z `SECONDARY_BY_PRIMARY`).
- AC-9.3: Given widok z tyłu (plecy, uda tył, łydki, pośladki), When to partia główna, Then sylwetka pokazuje widok tylny (`preferBackView`).

### US-10 Baza ćwiczeń - model danych i wzbogacenie (Must dla atlasu)
Jako administrator chcę utrzymywać bazę ćwiczeń ze spójnymi danymi, aby atlas był wiarygodny.

- AC-10.1: Given katalog w kodzie (165 pozycji), When wdrożona nowa wersja, Then wszystkie dotychczasowe `catalogId` i nazwy zostają rozpoznawane (kompatybilność z planami i historią, BR-6).
- AC-10.2: Given nowe pola (opis, cue, sprzęt, mięśnie główne/pomocnicze, poziom), When dodane, Then każde ćwiczenie ma co najmniej partię i nazwę; reszta opcjonalna (brak = ukryte w UI).
- AC-10.3: Given admin, When edytuje ćwiczenie w panelu, Then zmiany są widoczne w atlasie po odświeżeniu (zakres: zależy od Q4).
- AC-10.4: Given ćwiczenie usunięte z katalogu, When istnieje w planach użytkowników, Then plan nadal działa (ćwiczenie zachowuje nazwę zapisaną w planie).
- AC-10.5: Given link techniki, When brak w katalogu, Then użyty jest link z planu (per użytkownik) jeśli istnieje.

### US-11 Własna baza ćwiczeń i pierwsza wizyta (Should)
Jako nowy użytkownik chcę mieć gotowe ćwiczenia od razu, aby nie zaczynać od pustej listy.

- AC-11.1: Given pierwsze użycie bez danych, When otwiera "Utwórz plan", Then widzi wybór: "Od zera", "Z pliku" (bez generatora AI, bez wzorca generowanego automatycznie).
- AC-11.2: Given wybór "Od zera", When otwarty, Then edytor jest pusty z podpowiedzią partii i przykładowym przykładem (nie wstawiamy automatycznie ćwiczeń).

### US-12 Usunięcie funkcji AI (Must)
Jako właściciel produktu chcę, aby funkcja "Stwórz plan treningowy z AI" nie istniała, aby nie wprowadzać w błąd i nie mieć martwego kodu.

- AC-12.1: Given nowa wersja, When otwieram listę planów, Then nie ma kafelka, przycisku, pola wyboru dni ani poziomu, ani tekstu "AI" w kontekście planu.
- AC-12.2: Given repozytorium po wdrożeniu, When przeszukanie: `generateAndSaveAiWorkoutPlans`, `aiGeneratePlan`, `generateTrainingPlan`, `trainingPlanToWorkoutPayloads`, `ai-workout-plan`, "Stwórz plan treningowy z AI", "Wygeneruj plan", Then brak wyników w kodzie produkcyjnym, testach i skryptach (poza historią git i dokumentacją zmian).
- AC-12.3: Given wywołanie starego endpointu/akcji (np. z zapisanego klienta), When wykonane, Then zwracany jest brak funkcji (404 / nieistniejąca akcja), bez pustego sukcesu.
- AC-12.4: Given `scripts/codemod-guard-server-actions.mjs`, When uruchomiony test, Then nie ma wpisów dla usuniętych akcji, a `aiAnalyzePhoto` zostaje.
- AC-12.5: Given changelog, When wpis dla wydania, Then jest informacja o usunięciu generatora (planned: true na PR), bez wzmianek w zapowiedziach.
- AC-12.6: Given istniejące plany utworzone kiedyś przez AI, When użytkownik je otworzy, Then są zwykłymi planami, bez znacznika i bez utraty danych.

### US-13 Puste stany, błędy i komunikaty (Must)
Jako osoba ćwicząca chcę jasnych komunikatów, aby wiedzieć, co zrobić.

- AC-13.1: Given brak sesji, When otwieram nową trasę, Then przekierowanie do logowania (jak dziś).
- AC-13.2: Given błąd zapisu z serwera, When pojawia się, Then komunikat przy akcji (nie w nagłówku) z przyciskiem "Spróbuj ponownie".
- AC-13.3: Given brak planów w Treningach (`NoPlanCard`), When widzę CTA, Then prowadzi do nowej trasy (zob. Q2).
- AC-13.4: Given błąd importu (limit 429), When pojawia się, Then tekst "Zbyt wiele prób. Spróbuj za chwilę." z czasem oczekiwania.

### US-14 Dostępność i zgodność mobilna (Must)
Jako osoba ćwicząca w trakcie treningu chcę obsługiwać ekran jedną ręką, aby nie przerywać serii.

- AC-14.1: Given telefon, When edytuję ćwiczenie, Then pola liczbowe mają przyciski +/- o min. 44 px i klawiaturę numeryczną (`inputMode="numeric"`).
- AC-14.2: Given fokus klawiatury, When użytkownik przechodzi między polami, Then kolejność jest logiczna, a fokus nie ginie po zapisie.
- AC-14.3: Given czytnik ekranu, When edytor, Then każda kontrolka ma etykietę (dzisiejsze `aria-label` zostają i są rozszerzone).
- AC-14.4: Given kontrast, When tekst na ciemnym tle, Then spełnia WCAG AA (ux do potwierdzenia palety).

### US-15 Dostęp z wnętrza Treningów (Should, zależne od Q2)
Jako osoba ćwicząca chcę z ekranu Treningów przejść do planu, aby nie wracać do menu.

- AC-15.1: Given hub Treningi bez planu, When klikam "Dodaj plan", Then otwiera się nowa lista/kreator (nie Profil).
- AC-15.2: Given hub z planami, When klikam "Edytuj dzień", Then otwiera się edytor tego dnia.

### US-16 Zachowanie historii i progresji (Must, bez zmian)
Jako osoba ćwicząca chcę, aby zmiany w planie nie kasowały mojej historii, aby zachować progres.

- AC-16.1: Given zmiana nazwy ćwiczenia w planie, When zapis, Then historia zakończonych sesji i aktywna sesja zostają przepisane (dzisiejsze `migrateExerciseRenamesInHistory`).
- AC-16.2: Given usunięcie ćwiczenia z planu, When zapis, Then historia zostaje bez zmian.
- AC-16.3: Given edycja planu w trakcie sesji z tym planem, When zapis, Then aktywna sesja nie traci danych (do weryfikacji przez `architekt`).

---

## 6. Reguły biznesowe

- **BR-1** Plany ustawia się wyłącznie z pozycji menu bocznego ("Plany treningowe") oraz, jeśli Q2 tak zdecyduje, z pustych stanów w Treningach jako skrótu do tej samej trasy. Profil nie ma edycji planu.
- **BR-2** Funkcja "Stwórz plan z AI" nie istnieje w produkcie ani w kodzie (w tym generator heurystyczny `generateTrainingPlan`, który jest nazwany AI).
- **BR-3** Import z pliku zostaje jako jedna z dwóch dróg tworzenia (Od zera / Z pliku). Zapis po podglądzie (rekomendacja).
- **BR-4** Limity (założenie, do potwierdzenia): nazwa planu 1-80 znaków; nazwa ćwiczenia 2-80; notatka do 200; tempo do 8 znaków; plan max 30 ćwiczeń; użytkownik max 50 planów (dni). Serwer egzekwuje te same limity co UI.
- **BR-5** Serie 1-20, powtórzenia 1-999, RIR 0-5 lub brak - bez zmian względem dzisiaj.
- **BR-6** Katalog ćwiczeń: identyfikatory `catalogId` są stabilne; zmiana nazwy w katalogu nie zmienia zapisanych planów ani historii.
- **BR-7** Zmiana nazwy ćwiczenia w planie przepisuje historię sesji (dzisiejsze zachowanie, bez regresji).
- **BR-8** Usunięcie ćwiczenia lub planu nie kasuje historii zakończonych treningów.
- **BR-9** Plany utworzone wcześniej przez AI są zwykłymi planami; nie wymagają migracji.
- **BR-10** Konflikt wielu urządzeń: ostatni zapis wygrywa dla planu, ale aplikacja nie może cicho nadpisać zmian z szkicu bez informacji (`updatedAt` sprawdzane przy zapisie - do decyzji `architekt`).
- **BR-11** Treści atlasu (opisy, wskazówki) są tworzone przez zespół lub z licencją; nie kopiujemy treści z komercyjnych aplikacji.
- **BR-12** Linki techniki: w planie użytkownik może wstawić własny link; atlas pokazuje link z katalogu (admin) i nadpisanie per plan ma priorytet w planie użytkownika.
- **BR-13** Link YouTube jest otwierany jako link zewnętrzny; osadzony odtwarzacz nie jest w zakresie (dane do YouTube - sekcja 7).

---

## 7. Wymagania niefunkcjonalne i prywatność

- **Prywatność**: plany same w sobie nie są danymi zdrowotnymi. Pole "notatka" i własne ćwiczenia są wolnym tekstem, który może zawierać informacje o zdrowiu (np. kontuzja). Minimalizacja: nie logować treści notatek ani nazw własnych w Sentry/logach; w UI podpowiedź "Nie wpisuj danych medycznych". Usunięcie generatora AI zmniejsza zakres przetwarzania danych profilu i żywienia.
- **Bezpieczeństwo**: wszystkie akcje w sesji użytkownika, izolacja `userId` (dzisiejsze `where(eq(userId))`), CSRF na imporcie (istnieje), walidacja rozmiaru i typu pliku (istnieje), rate limit importu (istnieje).
- **Wydajność**: lista planów < 2 s na 4G; atlas 165+ ćwiczeń bez zbędnych zapytań (statyczny katalog w bundlu - ocena `architekt`); grafiki leniwe; brak dużych obrazów w bundlu.
- **Telefon w trakcie treningu**: wejście do planu z Treningów w max 2 tapnięciach; duże cele dotyku (44 px); tryb pionowy.
- **Offline / PWA**: edycja planu wymaga sieci (dzisiejsze server actions). Wymaganie minimalne: szkic nie ginie przy braku sieci (AC-3.4). Pełne offline edycji planu - poza zakresem v1 (założenie). Odczyt planu do startu sesji - zgodnie z obecnym outboxem sesji (bez zmian).
- **Dostępność**: WCAG AA; czytnik ekranu; kolor nie jako jedyny nośnik (partie = ikona + tekst).
- **Koszty**: statyczny katalog nie generuje kosztów; grafiki sylwetek jako SVG (bez kosztów transferu rastrów); brak nowych zewnętrznych usług (YouTube tylko link). Limity Turso: zapis planu to pojedynczy UPDATE na wiersz; migracja tabeli zależy od Q3.
- **Android**: aplikacja otwiera ścieżki WWW; nowe trasy muszą działać w WebView; brak zmian w API Android (brak `/api/android/*` dla planów - do potwierdzenia).
- **Java backend**: brak CRUD planów w Javie - bez zmian.
- **Zmienne środowiskowe**: brak nowych zmiennych w zakresie analizy. Jeśli `architekt` doda usługę (np. grafiki z CDN), wymagany wpis w `lib/admin-config-status.ts` i `env.example`.

---

## 8. Priorytety MoSCoW

| Pozycja | Priorytet | Uzasadnienie |
|---|---|---|
| US-1 Dostęp z menu, przekierowania | Must | Główne wymaganie użytkownika |
| US-2 Lista i pusty stan | Must | Podstawa ekranu |
| US-3 Tworzenie od zera, bez utraty zmian | Must | Obecny główny bug (utrata danych) |
| US-4 Dodawanie z atlasu | Must | Obecna funkcja do zachowania |
| US-6 Edycja, kolejność, usuwanie z potwierdzeniem | Must | Obecne ryzyko utraty danych |
| US-8 Atlas ćwiczeń | Must | Wymaganie użytkownika |
| US-10 Model bazy ćwiczeń | Must (dla atlasu) | Zależność US-8 |
| US-12 Usunięcie AI | Must | Wymaganie użytkownika |
| US-13 Komunikaty i stany błędów | Must | Jakość |
| US-14 Mobile i dostępność | Must | Wymaganie przepływu treningowego |
| US-16 Zachowanie historii | Must | Brak regresji |
| US-7 Import z podglądem | Should | Zostaje; podgląd to rekomendowana poprawa |
| US-5 Własne ćwiczenia | Should | Obecna funkcja; wzbogacenie z atlasem |
| US-9 Ikony i sylwetka | Should | Wizualne wzmocnienie; może wejść w v1.1 |
| US-11 Pierwsze użycie | Should | Onboarding |
| US-15 Skrót z Treningów | Should | Zależne od Q2 |
| Offline edycji planu | Won't (v1) | Poza zakresem |
| Wersje i historia zmian planu | Won't (v1) | Nowa funkcja |
| Udostępnianie planów innym | Won't (v1) | Poza zakresem |
| Osadzony odtwarzacz YouTube | Won't (v1) | Dane do zewnętrznego serwisu (prawnik) |

---

## 9. Zależności między funkcjami

- US-1 (menu) zależy od decyzji Q1 i Q2 oraz od nowej trasy (`architekt`).
- US-8 (atlas) zależy od US-10 (model danych katalogu) i od Q4.
- US-3/US-6 zależą od decyzji o zapisie szkicu (architekt) i od Q3 (model dni).
- US-7 zależy od US-3 (miejsce podglądu w kreatorze) i od zachowania parserów.
- US-12 (usunięcie AI) jest niezależne i może wejść jako pierwszy krok.
- Wpływ na Android i Javę: niski; wpływ na Treningi (hub): średni (linki, rewalidacja).

---

## 10. Pytania otwarte do użytkownika

Maksymalnie 5 najważniejszych. Przy każdym przyjęte założenie, jeśli brak odpowiedzi.

1. **Q1 - "Pasek boczny"**: rozumiem to jako szufladę "Menu" (prawa, otwierana ikoną ☰), bo aplikacja nie ma stałego panelu bocznego, również na desktopie (układ w jednej kolumnie `APP_SHELL_MAX`). Czy to właściwe miejsce, czy ma powstać stały panel boczny na tablecie/desktopie? **Założenie**: szuflada Menu; stały panel boczny nie wchodzi w zakres.
2. **Q2 - "Wyłącznie z paska bocznego"**: czy CTA "Ustaw plan" w pustych stanach Treningów (`NoPlanCard`, `NextWorkoutCard`, `PlanDayRow`, `PlanDaysPanel`) też mają zniknąć, czy mogą zostać jako skrót do tej samej trasy zarządzania? **Założenie**: zostają jako link do nowej listy planów (nie edytor inline); wszystkie inne wejścia z Profilu są usunięte.
3. **Q3 - Model planu**: czy zostajemy przy modelu "jeden rekord = jeden dzień" (dzisiejszy, zgodny z kolejką treningów i historią), czy chcesz encji "plan tygodniowy" z wieloma dniami? Drugie oznacza zmianę schematu, migrację danych i zmianę kolejki oraz porównań historii (wymaga ADR). **Założenie**: v1 zostaje przy modelu "dzień", a grupowanie dni w "program" to osobne zadanie.
4. **Q4 - Źródło atlasu**: czy atlas ma być statycznym katalogiem w kodzie (dziś 165 ćwiczeń, rozszerzony o opis, cue, sprzęt, mięśnie) zarządzanym przez zespół, czy ma być edytowalny przez administratora w panelu? **Założenie**: statyczny katalog rozszerzony o metadane; edycja opisów przez admina - osobne zadanie.
5. **Q5 - Import z pliku**: czy podgląd przed zapisem (wybór dni i ćwiczeń) jest akceptowalny jako zmiana w imporcie? Rekomendacja: tak, bo dziś import zapisuje od razu i tworzy od razu wiele planów. **Założenie**: podgląd wchodzi w v1; parsery bez zmian.

Dodatkowe założenia (do potwierdzenia, bez osobnego pytania):
- Limity z BR-4 są propozycją; obecnie nie ma limitów.
- Puste ćwiczenie w planie: szkic dozwolony, zapis do Treningów wymaga co najmniej jednego ćwiczenia.
- Własne ćwiczenia są prywatne dla użytkownika.
- Stare adresy przekierowują trwale (301/308 - architekt).

---

## 11. Rekomendacja dotycząca importu z pliku

**Zostaje, w zmienionej formie.**

- Import jest funkcją niezwiązaną z AI, obecnie używaną (karta "Import planu" na ekranie), i nie został wskazany jako usuwany. Usunięcie byłoby poza poleceniem.
- Parsery (PDF, DOCX/DOC, XLSX) i API (`/api/workout-plans/import`) zostają bez zmian logiki, z zachowaniem walidacji (CSRF, rozmiar 8 MB, typ, rate limit).
- Zmiana formy: import przenosi się do kreatora "Utwórz plan" jako druga droga obok "Od zera", z **podglądem** dni i ćwiczeń przed zapisem (AC-7.1, AC-7.2). Obecnie import zapisuje od razu i tworzy plany, których użytkownik nie widzi przed zapisem.
- Dodać wyraźny komunikat o formacie (nagłówki dni, serie/powtórzenia, kolumny Excela) - dziś tekst jest w jednej długiej karcie.
- Ryzyko bezpieczeństwa: plik to dane wejściowe od użytkownika. Parsery nie są zmieniane w tym zadaniu, ale zmiana UI może wymagać ponownego testu bezpieczeństwa, jeśli `architekt` zmieni API (np. dwuetapowy zapis z podglądem). Wtedy `tester-bezpieczenstwa` będzie potrzebny na etapie implementacji.
- Nazewnictwo: import korzysta z bucketu rate limit `bodyReportImport` (przypadkowe współdzielenie z raportami ciała). Do wyjaśnienia przez `architekt` - nie blokuje analizy.

---

## 12. Decyzja o bramkach przepływu

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `analityk` (etap 1) | TAK - wykonane | Ten dokument |
| `prawnik` (etap 2) | NIE | Plany i ćwiczenia nie są danymi osobowymi ani zdrowotnymi; usunięcie AI zmniejsza przetwarzanie danych profilu i żywienia. Jedyne ryzyka (notatki wolnym tekstem, osadzony YouTube) są opisane i nie są w zakresie v1. **Założenie potwierdzone przez analizę** - brak sprzeczności z założeniem z karty. Wrócić do `prawnik`, jeśli zapadnie decyzja o osadzaniu wideo lub o nowych polach zdrowotnych (np. kontuzje w planie). |
| `architekt` (etap 3) | TAK | Nowa trasa i przekierowania, rozdzielenie Start/Zarządzanie, decyzja o modelu (Q3), zapis szkicu, rozszerzenie katalogu i jego źródła (Q4), podgląd importu (API dwuetapowe), usunięcie AI, rewalidacje, ADR. |
| `ux` (etap 4) | TAK | Nowy ekran listy, kreatora, edytora, atlasu i karty ćwiczenia; zmiana wejścia w menu; wizualny system kart i akcentów (gold vs neon). |
| `backend` / `frontend` (etap 5) | NIE na tym etapie | Brak zmian kodu (polecenie użytkownika). |
| `tester` (etap 6) | NIE na tym etapie | Brak implementacji. W implementacji: testy podstawowe planu i importu, test usunięcia AI (AC-12.2). |
| `tester-bezpieczenstwa` (etap 7) | NIE na tym etapie; **prawdopodobnie TAK w implementacji** | Import (dane wejściowe z pliku), zmiana akcji serwerowych i usunięcie endpointu AI zmieniają powierzchnię ataku. Decyzja w etapie implementacji. |
| `tester-wydajnosci` (etap 7) | NIE na tym etapie; **prawdopodobnie NIE w implementacji** | Katalog statyczny, lista małych zbiorów. Wróci, jeśli atlas dostanie rastrowe grafiki lub listę z paginacją po stronie serwera. |

---

## 13. Ryzyka

| Ryzyko | Wpływ | Prawdopodobieństwo | Działanie |
|---|---|---|---|
| Utrata danych przy zamknięciu edytora (istniejący problem) | Wysoki | Wysokie | AC-3.5, AC-3.6 |
| Złamane linki po zmianie trasy (Treningi, rewalidacja, import, dokumentacja) | Średni | Wysokie | Lista punktów wejścia w sekcji 3.3; przekierowania; test E2E |
| Rozjazd "plan" vs "dzień" w UI i danych | Średni | Wysokie | Decyzja Q3, słownik pojęć w UX |
| Zmiana modelu (Q3) wymaga migracji i wpływa na kolejkę i historię | Wysoki (jeśli wybrane) | Średnie | Domyślnie v1 bez zmiany modelu |
| Dwa źródła linków technik niespójne | Średni | Średnie | BR-12, AC-10.5 |
| Atlas rozrasta się w rozmiar bundlu | Średni | Średnie | Dane w osobnym module ładowanym leniwie; ocena `architekt` |
| Notatki wolnym tekstem z danymi zdrowotnymi | Średni (prywatność) | Średnie | Podpowiedź w UI, brak logowania treści, ocena `prawnik`, jeśli pola się rozszerzą |
| Usunięcie AI zostawia martwe typy w `ai/coach.ts` lub testach | Niski | Wysokie | AC-12.2, sprawdzenie `tsc` i `lint` |
| Regresja zmiany nazwy ćwiczenia (historia) | Wysoki | Niskie | AC-16.1, istniejące testy `workout-exercise-rename.test.ts` |
| Zapis planu bez sieci na siłowni | Średni | Średnie | AC-3.4 (szkic lokalny) |
| Dokumentacja `docs/workout-plan-creation.json` nieaktualna po zmianie | Niski | Wysokie | Aktualizacja w ramach implementacji |
| Użytkownik oczekuje stałego panelu bocznego na desktopie | Średni | Średnie | Q1 |

---

## 14. Następne kroki

1. Akceptacja użytkownika dla Q1-Q5 (lub przyjęcie założeń).
2. `architekt` (etap 3): ADR dla nowej trasy, modelu (Q3), zapisu szkicu, źródła katalogu (Q4), podglądu importu, usunięcia AI, przekierowań i rewalidacji.
3. `ux` (etap 4): makiety HTML dla: menu (wejście), listy planów, pustego stanu, kreatora (Od zera / Z pliku), edytora planu (z mobilnym wierszem ćwiczenia), wyboru ćwiczenia z atlasu (sheet/pełny ekran), atlasu (partie), karty ćwiczenia, podglądu importu, dialogów potwierdzenia.
4. Po akceptacji makiet: implementacja (etap 5) w osobnym zadaniu lub w tym samym (decyzja koordynatora), z kolejnością: usunięcie AI, przekierowania i wejście w menu, edytor, atlas, import z podglądem.
5. Aktualizacja `docs/workout-plan-creation.json` i `docs/zespol/wiedza-o-projekcie.md`, jeśli zmieni się stan.
6. Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR.

---

Werdykt etapu 1: **ZATWIERDZONE** (analiza kompletna; pytania Q1-Q5 otwarte z założeniami).
