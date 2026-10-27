# 010 - Redesign arkusza "Dodaj cardio" (analiza wymagań i architektury)

- **Karta zadania**: `docs/zadania/010-redesign-dodawania-cardio.md` (zakłada koordynator po zebraniu wyników etapów 1-4)
- **Etap**: 1 - Wymagania (analityk). Zero zmian w kodzie produkcyjnym, bez karty zadania, bez makiety (makieta to etap 4, `ux`).
- **Autor**: analityk (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `architekt` (etap 3) i `ux` (etap 4)
- **Źródła**: polecenie użytkownika (opis zrzutu ekranu: ciemny arkusz, złoty akcent, pigułki rodzaju, stepper minut, pola data/dystans/tętno/wysiłek/kalorie/kroki/notatka, przycisk "Zapisz X min"), `components/treningi/cardio-log-sheet.tsx`, `actions/workout.ts` (`logCardioDetailedAction`), `actions/cardio.ts` (`createCardioLog`, `updateCardioLogAction`, `resolveCardioLogDate`), `lib/cardio-utils.ts` (`CARDIO_INPUT_LIMITS`, `validateCardioMetrics`, `CARDIO_TYPE_LABELS_PL`), `lib/cardio.ts` (`getWeeklyCardioProgress`), `lib/cardio-hub.ts` (tygodnie pn-nd), `lib/workout-cardio-attribution.ts` (`countableCardioMinutes`), `components/cardio/cardio-hub-view.tsx`, `components/home/home-training-card.tsx`, `components/cardio/cardio-detail-client.tsx`, `docs/zespol/wiedza-o-projekcie.md`, `docs/bledy-do-naprawy/bledy.md` (Q-P2, pozycje z edytorów cardio).

Uwaga o metodzie: wnioski oparte na czytaniu kodu, bez uruchamiania aplikacji i bez testów na danych. Hipotezy oznaczone jako "hipoteza" wymagają potwierdzenia przez `tester` (etap 7). Zrzutu ekranu nie zobaczono w repozytorium; opis pól pochodzi z polecenia i kodu komponentu.

---

## 1. Kontekst i cel

Arkusz "Dodaj cardio" służy do ręcznego zapisu samodzielnego wpisu cardio (osobny wpis `workouts` z `exercises` = payload `kind: "cardio_log"`). Wpis z arkusza zawsze trafia do celu tygodniowego w całości (patrz sekcja 3.3). Dlatego minuty są jedyną daną krytyczną dla wyliczeń, a reszta (tętno, kalorie, kroki, dystans, wysiłek, notatka) to metadane do analizy obciążenia i stref, bez wpływu na cel.

Dziś arkusz:
- pokazuje 9 pól na jednym poziomie wagi (brak hierarchii i oznaczenia, które pola są opcjonalne),
- nie pokazuje postępu tygodnia, tylko statyczne "Zalecenie: 150 min / tydzień",
- po cichu zmienia lub gubi część wartości (sekcja 4),
- po zapisie przenosi użytkownika na stronę wpisu `/cardio/[id]`, tracąc kontekst miejsca, z którego dodawał.

Cel zlecenia (zakres etapu 1):
1. Zebrać wymagania i kryteria akceptacji dla redesignu arkusza: UX, architektura danych i walidacji, spójność klient/serwer.
2. Ocenić, czy zbierane są wszystkie dane potrzebne do wyliczenia cardio dodatkowego (sekcja 4) i czy walidacja jest poprawna.
3. Wskazać luki UX i architektury dla `architekt` i `ux`.
4. Zdecydować o bramkach zespołu (sekcja 12).

Poza zakresem tego etapu: makieta (etap 4), kod, ADR (etap 3), zmiana wyglądu innych ekranów cardio.

---

## 2. Zakres

### 2.1 Wchodzi
- Arkusz "Dodaj cardio" (`components/treningi/cardio-log-sheet.tsx`): hierarchia pól, sposób wprowadzania, stany błędów, postęp tygodnia, zachowanie po zapisie.
- Walidacja wpisu: klient (podgląd i komunikaty), akcja serwerowa (`logCardioDetailedAction`), reguły w `lib/cardio-utils.ts` (`validateCardioMetrics`).
- Model danych wpisu: które pola są krytyczne, które metadane, jak parsować i zwracać błędy (bez zmiany schematu bazy - patrz założenie A3).
- Spójność z miejscami otwarcia: hub cardio (`cardio-hub-view.tsx`) i ekran główny (`home-training-card.tsx`).

### 2.2 Nie wchodzi
- Zmiana schematu bazy, migracje, nowe kolumny (założenie A3; jeśli `architekt` uzna inaczej, wraca do etapu 1).
- Edycja istniejącego wpisu (`cardio-detail-client.tsx`, `updateCardioLogAction`, edytor w `workout-finished-screen.tsx`) - poza zakresem wdrożenia, ale wymóg zgodności modelu walidacji (US-11, decyzja architekta).
- Dodatek cardio po treningu siłowym (popup po treningu, `completed_session` z `cardioMinutes > 0`) - inny przepływ, tylko zachowanie liczenia (BR-1).
- Integracje ze smartwatchem, import z Apple Health / Google Fit, automatyczne tętno (poza zakresem).
- Zmiany w Javie (`java-backend/`) i Androidzie, poza potwierdzeniem zgodności kontraktu (sekcja 14).
- Analityka cardio (`lib/analytics/*`, obciążenie, strefy) - tylko odbiorca danych, bez zmian formuł.

---

## 3. Stan obecny (mapa z kodu)

### 3.1 Miejsca otwarcia arkusza
W kodzie są **dwa** miejsca renderowania `CardioLogSheet` (zlecenie mówi o "kilku" - potwierdzone dwa komponenty, każdy z innym zestawem danych):

| Miejsce | Plik | Co przekazuje | Uwagi |
|---|---|---|---|
| Hub cardio | `components/cardio/cardio-hub-view.tsx` (ok. l. 575) | `cardioGoalMinutes={data.goalMinutes}`, `defaultTitle="Marsz"`, `onClose` jako inline arrow | Dane tygodnia w hubie (`lib/cardio-hub.ts`) liczone w tygodniu pn-nd; czy `data` zawiera sumę tygodnia do podglądu - do potwierdzenia przez `architekt`. |
| Ekran główny (kafelek treningu) | `components/home/home-training-card.tsx` (ok. l. 128) | `cardioGoalMinutes`, bez `defaultTitle` (domyślnie "Marsz"), `onClose` jako inline arrow | Komponent ma już `cardioThisWeekMinutes` i `extraCardio` (pasek `HomeCardioProgressStrip`), ale **nie przekazuje ich do arkusza**. |

Wniosek: dane do pokazania postępu są już w obu kontekstach; brakuje tylko przekazania ich do arkusza.

### 3.2 Pola i przepływ danych

| Pole (UI) | Typ w UI | Walidacja w kliencie | Obsługa w `logCardioDetailedAction` (`actions/workout.ts`) | Walidacja w `validateCardioMetrics` | Liczy się do celu tygodnia? |
|---|---|---|---|---|---|
| Rodzaj (8 pigułek) | przycisk | brak (wybór z listy) | `cardioType` przez `isCardioTypeSlug`, fallback `resolveCardioType(title)` | brak (typ nie jest walidowany poza slugiem) | nie (metadana) |
| Minuty (stepper + pole) | tekst, filtr `\D` | `clampMinutes`: 1-300, NaN→30 | `cardioMinutes: Number(...)` | 1-1440, liczba całkowita po `Math.round` | **tak - jedyna krytyczna** |
| Data | `input type=date`, min -60 dni, max dziś | brak walidacji wartości przy `onChange` | `date` jako tekst | `resolveCardioLogDate`: format, nie przyszłość, max 60 dni wstecz | **tak, pośrednio** (decyduje, który tydzień dostaje minuty) |
| Dystans (km) | tekst dowolny | brak | `Number(...replace(",","."))`, niedodatnie/NaN → **null po cichu** | max 500 km | nie |
| Śr. tętno | tekst dowolny | brak | `Number`, niedodatnie/NaN → **null po cichu** | 30-250 bpm (błąd) | nie |
| Max tętno | tekst dowolny | brak | jw. | 30-250 bpm (błąd) | nie |
| Wysiłek (1-10) | tekst dowolny | brak | 1-10 włącznie, poza zakresem → **null po cichu** | **brak** | nie (wpływa na intensywność w `lib/analytics/cardio-load.ts`) |
| Kalorie | tekst dowolny | brak | `Number`, niedodatnie/NaN → **null po cichu** | max 20 000; kcal/min max 25 (błąd) | nie |
| Kroki | tekst dowolny | brak | `Number`, niedodatnie/NaN → **null po cichu** | max 500 000 (błąd) | nie |
| Notatka | textarea, bez `maxLength` | brak | `trim`, pusta → `undefined` | brak | nie |

Zapis: `createCardioLog` → `validateCardioMetrics` → `resolveCardioLogDate` → insert `workouts` z `cardioMinutes` i `exercises = JSON(cardio_log)`. Wysiłek i strefa HR są liczone po zapisie (`heartRateZoneFromHr` na `avgHr` i wieku użytkownika).

### 3.3 Co liczy się do celu tygodniowego (BR-1)
- Wpis z arkusza ma `kind: "cardio_log"`, więc `countableCardioMinutes` (`lib/workout-cardio-attribution.ts`) zalicza **pełną wartość minut**. Dystans, tętno, kalorie, kroki, wysiłek i notatka nie wpływają na cel.
- Sprzeczność definicji tygodnia (do rozstrzygnięcia, F-12): `lib/cardio.ts` (`getWeeklyCardioProgress`) opisuje cel jako **kroczące 7 dni**, a zakres od `now - 7 dni` do dziś po dacie kalendarzowej obejmuje 8 kolejnych dat (do potwierdzenia). `lib/cardio-hub.ts` liczy **tydzień kalendarzowy pn-nd**. Analiza 009 i wiedza o projekcie (kroczące 7 dni) też się różnią. Ten sam wpis może więc być inaczej widoczny na różnych ekranach.

---

## 4. Ocena: czy zbierane są wszystkie dane i czy są poprawnie walidowane

### 4.1 Dane krytyczne i metadane

| Klasa | Pola | Wymóg |
|---|---|---|
| **Krytyczne dla celu** | Minuty | Muszą być poprawne, jednoznaczne i widoczne przed zapisem. Nie mogą być zmienione po cichu. |
| **Krytyczne pośrednio** | Data (dzień lokalny użytkownika) | Decyduje o tygodniu, do którego trafią minuty. Musi być jawnie pokazana w wyniku zapisu. |
| **Wymagane do wpisu, z domyślną** | Rodzaj (domyślnie "Marsz") | Zawsze wysyłany. Etykieta z jednego źródła. |
| **Metadane opcjonalne** | Dystans, tętno (śr./max), wysiłek, kalorie, kroki, notatka | Nie wpływają na cel. Ich błędne zapisanie psuje analizę obciążenia i stref, a nie cel. |

Ocena kompletności: **zbierane są wszystkie dane potrzebne do wyliczenia cardio dodatkowego** (minuty + data) oraz wszystkie metadane, które dziś ma model. Nie brakuje pola, którego wyliczenie wymaga. Brakuje natomiast **wiedzy o postępie** (ile już jest w tygodniu) przed i po zapisie oraz **jednoznacznego komunikatu, co się liczy**.

### 4.2 Walidacja - luki (F-1 do F-14)

Klasyfikacja: **wysoki** = zniekształca dane lub ukrywa błąd na ścieżce zapisu; **średni** = niespójność lub zła obsługa błędu; **niski** = dług lub drobiazg. Wszystkie pozycje są w zakresie redesignu i trafiają do wymagań implementacji (nie do `bledy.md`), chyba że koordynator zdecyduje inaczej.

| # | Luka | Dowód (kod) | Skutek dla użytkownika | Priorytet |
|---|---|---|---|---|
| F-1 | Puste pole minut zapisuje **1 min** bez komunikatu | `clampMinutes(Number(""))` → `Math.max(1, 0)` = 1; etykieta przycisku pokazuje "Zapisz 1 min" | Użytkownik kasuje wartość i zapisuje; w tygodniu jest 1 min zamiast czasu treningu | wysoki |
| F-2 | Przecinek / kropka w minutach jest usuwany filtrem `\D` | `onChange: replace(/[^\d]/g,"")` | "1.5" albo "1,5" staje się **15 min** po cichu | wysoki |
| F-3 | Minuty ucinane do 300 po cichu (przy blur) | `clampMinutes` 1-300 w kliencie; serwer przyjmuje do 1440 | Wpis "400" staje się "300" bez komunikatu; serwer nie widzi różnicy | wysoki |
| F-4 | Pola liczbowe (dystans, tętno, kcal, kroki) z tekstem ("3 km", "125 bpm", "abc") i wartościami ≤ 0 zapisują się jako **brak** bez komunikatu | `logCardioDetailedAction`: `Number` → niefinite/≤0 → `null` przed `validateCardioMetrics` | Użytkownik myśli, że dystans/tętno zostały zapisane; w danych jest pusto | wysoki (zaufanie do danych) |
| F-5 | Wysiłek poza 1-10 (np. 11, 0) znika po cichu; wartość 6,5 jest zaokrąglana do 7 bez komunikatu; brak reguły w `validateCardioMetrics` | `actions/workout.ts` l. 75-81 i `actions/cardio.ts` l. 133-139 | Obciążenie w analizie liczone z innej wartości niż wpisana, albo wcale | średni |
| F-6 | To samo pole tętna ma dwie obsługi: wartość 5 daje błąd zakresu, a "abc" daje cichy brak | `validateCardioMetrics` (błąd 30-250) vs akcja (cicho null) | Niespójne komunikaty; użytkownik nie wie, dlaczego jedno pole działa, a drugie nie | średni |
| F-7 | Brak reguły: śr. tętno nie może być wyższe niż max tętno | `validateCardioMetrics` sprawdza tylko zakres | Wpis "śr. 165 / max 125" jest przyjmowany; strefy HR błędne | średni |
| F-8 | Błędy walidacji serwera pokazywane tylko jako toast, bez wskazania pola | `notifyError(state.error)` | Przy kilku polach użytkownik nie wie, które poprawić | średni |
| F-9 | Notatka bez limitu długości w UI; limit serwera nieznany (do potwierdzenia) | `textarea` bez `maxLength`; akcja `trim` bez limitu | Ryzyko bardzo długiego tekstu w bazie i w logach/Sentry (do sprawdzenia w bezpieczeństwie) | średni |
| F-10 | Klient i serwer nie dzielą reguł: klient ma własny clamp 1-300, serwer 1-1440, a wysiłek i HR tylko na serwerze i cicho | Sekcja 3.2 | Reguły rozjeżdżają się przy każdej zmianie | wysoki (architektura) |
| F-11 | Data: etykieta "dziś, <dzień>" liczona w przeglądarce, a domyślny wpis (pusta data) liczony przez serwer w `calendarDateKey`; granice min/max liczone raz (`useMemo([])`) | `cardio-log-sheet.tsx` l. 133-141; `actions/cardio.ts` `resolveCardioLogDate` | Przy zmianie strefy lub przekroczeniu północy etykieta i zapisany dzień mogą się różnić (AC-1.3); hipoteza do potwierdzenia | wysoki (do sprawdzenia) |
| F-12 | Dwie definicje tygodnia cardio: kroczące 7 dni (`getWeeklyCardioProgress`, zakres do potwierdzenia jako 8 dat) vs tydzień pn-nd (`cardio-hub.ts`) | Sekcja 3.3 | Postęp w arkuszu, na ekranie głównym i w hubie może pokazywać różne liczby (BR-1, BR-2 z analizy 009) | wysoki - wymaga decyzji właściciela (Q-C3) przed implementacją |
| F-13 | Hipoteza: po sukcesie `useActionState` zostaje w stanie; efekt zależy od `onClose` (inline arrow w obu rodzicach), więc przy kolejnym renderze rodzica może ponownie wywołać toast i `router.push("/cardio/<id>")` dla **starego** wpisu | `cardio-log-sheet.tsx` l. 120-131; `onClose` w `cardio-hub-view.tsx` i `home-training-card.tsx` | Powtórne przekierowanie lub toast przy odświeżeniu rodzica. Nie odtworzono - wymaga testu | wysoki, jeśli potwierdzone |
| F-14 | Po sukcesie zawsze przekierowanie do `/cardio/<id>` i `router.refresh()` | `cardio-log-sheet.tsx` l. 124-126 | Użytkownik traci kontekst (kafelek główny, hub); nie widzi wpływu na tydzień | średni (UX, sekcja 5) |

### 4.3 Co działa dobrze (zachować)
- Serwerowa walidacja minut (1-1440), dystansu (≤ 500), tętna zakresowa (30-250 po błędzie), kalorii (≤ 20 000 oraz kcal/min ≤ 25), kroków (≤ 500 000) - zwraca czytelne komunikaty w `validateCardioMetrics`.
- Data: `resolveCardioLogDate` odrzuca przyszłość i więcej niż 60 dni wstecz.
- Przycisk w stanie `pending` jest zablokowany (brak podwójnego zapisu w jednym kliknięciu).
- Stan formularza zeruje się przy każdym otwarciu (`useEffect` na `open`).
- Zapis i odczyt z jednego modułu liczenia (`countableCardioMinutes`, `lib/cardio.ts`), bez kopii liczb w kliencie (wymaganie US-15 z analizy 009).

---

## 5. Ocena UX - braki arkusza

| # | Problem | Opis |
|---|---|---|
| U-1 | Brak postępu tygodnia | "Zalecenie: 150 min / tydzień" to tylko cel. Użytkownik nie wie, ile już ma (dane są na ekranie głównym i w hubie, ale nie w arkuszu). |
| U-2 | Brak efektu zapisu w tygodniu | Po zapisie nie widać, ile minut dodał i ile zostało do celu. |
| U-3 | Dziewięć pól o tej samej wadze | Minuty (krytyczne) wyglądają tak samo jak kroki czy notatka. Brak hierarchii i brakuje informacji, co jest wymagane. |
| U-4 | Brak oznaczenia opcjonalnych pól | Użytkownik nie wie, czy musi wypełnić tętno, czy może pominąć. |
| U-5 | Błędy pokazywane tostem | Brak błędu przy polu, brak `aria-invalid` i `aria-describedby`, brak fokusu na błędnym polu. |
| U-6 | Pole minut z filtrem znaków | Przecinek, kropka i spacja znikają bez informacji (F-2). Nie ma presetów (15/30/45/60), tylko ±5. |
| U-7 | Wysiłek jako wolny tekst | Skala 1-10 powinna być wyborem, nie wpisywaniem (eliminuje F-5). |
| U-8 | Dystans, tętno, kalorie, kroki z wolnym tekstem i bez jednostki w polu | Jednostka jest tylko w etykiecie; brak sufiksu (km, bpm, kcal, kroki). |
| U-9 | Po sukcesie przeniesienie na stronę wpisu | Kontekst miejsca (kafelek lub hub) zostaje utracony (F-14). |
| U-10 | Pigułki bez stanu dla czytników | Przyciski rodzaju nie mają `aria-pressed`; lista nazw nie pochodzi z jednego źródła (`MACHINES` dubluje `CARDIO_TYPE_LABELS_PL`). |
| U-11 | Przycisk mówi tylko "Zapisz X min" | Nie mówi, co się liczy i gdzie trafi wpis (dzień). |
| U-12 | Sheet na telefonie | Wysokość `min(88dvh, 640px)` i stała stopka są dobre; pola w siatce 2 kolumn są małe na telefonie w ruchu. Do oceny przez `ux` na makiecie 390 px. |

---

## 6. Interesariusze i persony

| Persona | Opis | Co jest naprawdę potrzebne w arkuszu | Czego nie potrzebuje na pierwszym ekranie |
|---|---|---|---|
| **P1 Początkujący** | Dodaje spacer albo marsz, chce szybko zapisać czas | Rodzaj, minuty (presety), postęp tygodnia, jeden przycisk | Tętno, kalorie, kroki, wysiłek |
| **P2 Zaawansowany** | Wpisuje wynik z zegarka po treningu: tętno, dystans, wysiłek | Wszystkie pola, poprawna walidacja, błąd przy polu | Presety, wielkie kafelki |
| **P3 Osoba na redukcji** | Wpisuje kroki i kalorie, patrzy na cel tygodnia | Kroki, kcal (zwinięte), postęp tygodnia | Notatka, wysiłek |
| **Administrator** | Brak bezpośredniego użycia | Stabilne reguły (wspólne z edycją) | - |
| **Użytkownik na siłowni** | Dodaje wpis po treningu lub w przerwie, sieć bywa słaba | Szybki zapis, dane nie znikają po błędzie sieci | Długie formularze |

Założenie: P1 to większość użytkowników arkusza, P2 najczęściej wpisuje metadane. Układ musi obsłużyć obie grupy bez przełącznika "prosty/zaawansowany" (spójnie z Q2 z analizy 009): minuty na wierzchu, szczegóły pod rozwijaną sekcją.

---

## 7. Założenia

- **A1** Arkusz tworzy wyłącznie samodzielny wpis `cardio_log` (kind). Dodatek do treningu siłowego powstaje w innym przepływie i nie zmienia liczenia w tym arkuszu. Do potwierdzenia przez `architekt`, czy `home-training-card` nie przekazuje kontekstu treningu.
- **A2** Cel tygodniowy domyślnie 150 min, z ustawień użytkownika (BR-12 z analizy 009).
- **A3** Brak zmian schematu bazy: wpis dalej zapisuje się jako `workouts` z `exercises` JSON. Walidacja i parsowanie to zmiany w kodzie, nie w danych. Jeśli `architekt` uzna, że potrzebna jest kolumna, zadanie wraca do etapu 1.
- **A4** Limit minut w UI: 1-300 w kliencie jest rozjazdem (F-3). Założenie robocze: **jeden limit dla UI i serwera w zakresie 1-600 min na wpis** (10 h, powyżej typowego treningu cardio), z jawnym błędem powyżej limitu, bez cichego ucinania. Serwer 1440 zostaje do decyzji `architekt` (kompatybilność z innymi wejściami). Do zatwierdzenia (Q-C2).
- **A5** Data: domyślnie "dziś" wg dnia lokalnego użytkownika. Okno wstecz 60 dni i zakaz przyszłości zostają (istniejąca reguła).
- **A6** Tydzień dla celu i postępu w arkuszu: do rozstrzygnięcia (Q-C3). Analityk rekomenduje jedną definicję dla całego produktu (BR-1 z 009), ale wybór należy do właściciela.
- **A7** Dane tętna, kalorii, kroków i dystansu to dane o zdrowiu i ciele (sekcja 9.1). Redesign nie dodaje nowych kategorii, nie zmienia celów przetwarzania i nie wprowadza zgody w arkuszu. Warunek: rozstrzygnięcie Q-P2 (sekcja 12).
- **A8** Wpis zapisywany wyłącznie przy połączeniu z siecią (brak trybu offline w zakresie tego zadania; patrz NF-6).

---

## 8. User stories i kryteria akceptacji

Format: "Jako <rola> chcę <cel>, aby <korzyść>". Kryteria w Given/When/Then. Priorytet MoSCoW.

### US-1 Szybki zapis minut (Must)
Jako osoba ćwicząca chcę dodać czas cardio jednym krótkim ruchem, aby zapisać wpis w czasie krótszym niż minuta.

- AC-1.1: Given otwarty arkusz, When wybieram preset (np. 30 min) lub ±5, Then pole minut pokazuje wybraną wartość, a przycisk "Zapisz 30 min" ją odzwierciedla.
- AC-1.2 (brzeg - pusta wartość, F-1): Given pole minut wyczyszczone, When próbuję zapisać, Then zapis jest zablokowany, a pod polem pojawia się "Podaj czas w minutach (1-600)". Nie zapisuję 1 min.
- AC-1.3 (brzeg - przecinek, F-2): Given wpisuję "1,5" lub "1.5", When zatwierdzam pole, Then widzę komunikat "Podaj minuty jako liczbę całkowitą" i wartość nie zmienia się na 15.
- AC-1.4 (brzeg - ponad limit, F-3): Given wpisuję 700, When pole traci fokus, Then pokazuje się błąd "Maksymalnie 600 min w jednym wpisie" i przycisk jest nieaktywny. Wartość nie zmienia się po cichu.
- AC-1.5: Given poprawny czas, When przycisk Zapisz, Then serwer zapisuje dokładnie tę liczbę minut, którą widać w polu.

### US-2 Postęp tygodnia przed i po zapisie (Must)
Jako osoba ćwicząca chcę widzieć, ile minut cardio mam w tygodniu i ile doda ten wpis, aby wiedzieć, czy osiągam cel.

- AC-2.1: Given cel 150 min i 90 min w bieżącym tygodniu, When arkusz otwarty, Then widzę "90 z 150 min (60%)" i pasek postępu.
- AC-2.2: Given zmieniam minuty na 30, When wpis jest w bieżącym tygodniu, Then podgląd pokazuje "Po zapisie: 120 z 150 min".
- AC-2.3 (brzeg - przekroczenie celu): Given 140 min w tygodniu i wpis 30 min, When podgląd, Then pokazuje "Cel osiągnięty: 170 z 150 min" (bez ujemnej reszty).
- AC-2.4 (brzeg - pierwszy wpis, pierwsze użycie bez danych): Given brak wpisów w tygodniu, When arkusz otwarty, Then widzę "0 z 150 min" i zdanie "To pierwszy wpis w tym tygodniu", bez pustych kart.
- AC-2.5 (brzeg - wstecz): Given wybieram datę z poprzedniego tygodnia, When podgląd, Then postęp dotyczy tygodnia tej daty, z jej etykietą (np. "Tydzień 12-18 paź: 90 z 150 min"). Zasada definicji tygodnia wg decyzji Q-C3.
- AC-2.6: Given wpis zapisany, When sukces, Then wynik zapisu pokazuje sumę po zapisie z serwera (nie z podglądu klienta).
- AC-2.7 (zgodność, BR-1): Given ten sam stan danych, When liczymy postęp w arkuszu, na ekranie głównym i w hubie, Then liczba jest identyczna.

### US-3 Hierarchia: minuty na wierzchu, szczegóły pod rozwinięciem (Must)
Jako osoba ćwicząca chcę widzieć tylko to, czego potrzebuję do zapisu, aby nie wypełniać pól, które nie są mi potrzebne.

- AC-3.1: Given otwarty arkusz, When pokazany, Then widoczne są tylko: rodzaj, minuty, data (zwinięta do wiersza "Dziś, <dzień>") i przycisk zapisu.
- AC-3.2: Given sekcja "Szczegóły (opcjonalne)", When zwinięta, Then pokazuje liczbę wypełnionych pól (np. "Szczegóły: 2 z 6") i nie zabiera miejsca, gdy pusta.
- AC-3.3: Given szczegóły rozwinięte, When pole jest opcjonalne, Then etykieta lub podpis mówi "opcjonalne" albo nie ma żadnego znaku wymagalności poza minutami.
- AC-3.4 (brzeg - zapis z ukrytymi szczegółami): Given szczegóły wypełnione i zwinięte, When zapisuję, Then wartości są zapisane (zwinięcie nie kasuje danych).

### US-4 Walidacja przy polu, bez cichych zmian (Must)
Jako osoba ćwicząca chcę widzieć, które pole ma błąd i dlaczego, aby poprawić wpis bez utraty pozostałych danych.

- AC-4.1: Given wpisuję "3 km" w dystans, When pole traci fokus, Then pod polem jest "Podaj dystans liczbą, np. 3,5", a wartość nie znika.
- AC-4.2 (F-4): Given tętno "abc" lub "125 bpm", When zapisuję, Then zapis jest zablokowany, a komunikat wskazuje pole. Nie zapisuję pustej wartości.
- AC-4.3 (F-6): Given tętno 5, When zapisuję, Then komunikat "Tętno w zakresie 30-250 bpm" pod polem (ta sama reguła dla śr. i max).
- AC-4.4 (F-7): Given śr. tętno 165 i max 125, When zapisuję, Then błąd "Maksymalne tętno nie może być niższe od średniego" pod polem max.
- AC-4.5 (F-5): Given wysiłek wybrany z skali 1-10, When zapisuję, Then wartość jest liczbą całkowitą z zakresu, bez możliwości wpisania 11 lub 6,5.
- AC-4.6: Given błąd walidacji serwera dotyczący pola, When wynik wraca, Then błąd pojawia się przy polu (`aria-invalid`, `aria-describedby`), a fokus przechodzi na pierwsze błędne pole. Toast tylko dla błędów ogólnych.
- AC-4.7 (brzeg - kilka błędów naraz): Given błędy w dwóch polach, When zapis zablokowany, Then oba błędy są widoczne jednocześnie.
- AC-4.8 (brzeg - kalorie): Given 2000 kcal przy 10 min (200 kcal/min), When zapis, Then błąd "Kalorie nierealne przy tym czasie - sprawdź wpis" przy polu kalorii.

### US-5 Data wpisu zgodna z dniem lokalnym (Must)
Jako osoba ćwicząca chcę, aby wpis trafił na dzień, który widzę na ekranie, aby minuty były w poprawnym tygodniu.

- AC-5.1 (brzeg - zmiana dnia lokalnego, AC-1.3 z 009): Given trening o 23:50 w strefie lokalnej, When otwieram arkusz o 00:10 następnego dnia, Then etykieta i zapisany dzień to ten sam dzień lokalny (do potwierdzenia, F-11).
- AC-5.2 (brzeg - przekroczenie północy, otwarty arkusz): Given arkusz otwarty o 23:59, When godzina zmienia się na 00:01, Then granica daty (max) i etykieta zostają odświeżone, a wpis zapisany bez zgadywania.
- AC-5.3: Given wstecz do 60 dni, When wybieram datę, Then zapis trafia na tę datę, a komunikat potwierdza ją przed zapisem.
- AC-5.4: Given data w przyszłości, When wybieram, Then pole jest zablokowane, a komunikat wyjaśnia powód.
- AC-5.5 (brzeg - inna strefa urządzenia): Given przeglądarka w innej strefie niż konto, When zapisuję bez zmiany daty, Then zapisany dzień jest pokazany w wyniku zapisu.

### US-6 Rodzaj aktywności z jednego źródła (Must)
Jako osoba ćwicząca chcę wybrać rodzaj z listy, która zgadza się z historią, aby wpisy były spójne.

- AC-6.1: Given lista 8 rodzajów, When wyświetlona, Then etykiety pochodzą z `CARDIO_TYPE_LABELS_PL` (jedno źródło, nie `MACHINES`).
- AC-6.2: Given wybrany rodzaj, When przycisk, Then ma `aria-pressed` i stan wizualny (dla czytników i kontrastu).
- AC-6.3 (brzeg - domyślny rodzaj spoza listy, np. stary wpis): Given `defaultTitle` nie na liście, When otwieram, Then wybrany jest "Inne" i nazwa trafia do notatki (zachowanie dzisiejsze, z jawnym opisem).

### US-7 Tętno i wysiłek w jednej, spójnej logice (Should)
Jako zaawansowany użytkownik chcę wpisać tętno i wysiłek, aby strefy i obciążenie były poprawne.

- AC-7.1: Given śr. i max tętno puste, When zapis, Then wpis zapisuje się bez strefy (brak danych, nie 0 min w strefie).
- AC-7.2: Given tylko śr. tętno, When zapis, Then strefa liczy się z śr. i wieku (zachowanie dzisiejsze).
- AC-7.3: Given wysiłek 7 w skali, When zapis, Then wartość 7 jest zapisana i wpływa tylko na intensywność, nie na cel.

### US-8 Po zapisie zostaję w kontekście (Should, decyzja Q-C1)
Jako osoba ćwicząca chcę po zapisie zostać tam, gdzie byłam/byłem, aby zobaczyć efekt w tygodniu.

- AC-8.1 (założenie): Given zapis udany, When wynik, Then arkusz się zamyka, na ekranie jest komunikat "Zapisano 30 min. Tydzień: 120 z 150 min" z linkiem "Zobacz wpis". Bez automatycznego przekierowania.
- AC-8.2 (F-13): Given zapis udany i rodzic ponownie się renderuje, When kolejny render, Then komunikat i przekierowanie nie powtarzają się dla tego samego wpisu.
- AC-8.3 (alternatywa, jeśli Q-C1 = dzisiejsze): Given zapis udany, When wynik, Then przekierowanie do `/cardio/<id>` działa, ale tylko raz.

### US-9 Dostępność i dotyk na siłowni (Must)
Jako osoba ćwicząca chcę obsługiwać arkusz jedną ręką w pocie, aby zapis nie wymagał precyzji.

- AC-9.1: Given telefon, When arkusz otwarty, Then wszystkie cele dotyku mają min. 44 px, a przycisk zapisu jest w stopce widocznej bez przewijania.
- AC-9.2: Given klawiatura systemowa, When pole minut, Then klawiatura numeryczna (`inputMode="numeric"`) i przycisk "Gotowe" zamyka klawiaturę.
- AC-9.3: Given otwarcie arkusza, When pojawia się, Then fokus trafia do pierwszego pola (minuty), a Esc i przycisk X zamykają arkusz z powrotem fokusu na przycisk otwierający.
- AC-9.4: Given tekst błędu, When wyświetlony, Then kontrast spełnia WCAG AA (dziś `white/35` i `white/40` do sprawdzenia przez `ux`).

### US-10 Notatka z limitem (Should)
Jako osoba ćwicząca chcę krótką notatkę, aby zapisać kontekst (np. nachylenie), bez długiego tekstu w bazie.

- AC-10.1: Given notatka, When wpisuję, Then licznik znaków i limit (założenie 280) są widoczne od 240 znaków.
- AC-10.2: Given notatka dłuższa niż limit, When zapis, Then błąd przy polu (serwer odrzuca tak samo jak klient).
- AC-10.3: Given notatka z samymi spacjami, When zapis, Then zapisuje się jako brak notatki.

### US-11 Jeden model walidacji dla dodawania i edycji (Should)
Jako zespół chcę, aby dodawanie i edycja wpisu cardio miały te same reguły, aby nie było dwóch wersji prawdy.

- AC-11.1: Given reguła zakresu tętna, When zmieniona w jednym miejscu, Then obowiązuje w arkuszu, w edycji wpisu (`cardio-detail-client.tsx`) i w edytorze po treningu (`workout-finished-screen.tsx`).
- AC-11.2: Given wpis dodany w arkuszu, When otwarty w edycji, Then wartości są takie same jak w arkuszu (bez zmiany przez parser).
- AC-11.3 (zakres): samo UI edycji jest poza zakresem tego zadania; wymagany jest wspólny model walidacji (decyzja `architekt`).

### US-12 Działanie przy słabej sieci (Must)
Jako osoba ćwicząca na siłowni chcę, aby przy błędzie sieci wpis nie znikał, aby nie wpisywać go drugi raz.

- AC-12.1 (brzeg - brak sieci na siłowni): Given brak połączenia, When Zapisz, Then komunikat "Brak połączenia - wpis nie został zapisany", a wszystkie pola zostają wypełnione.
- AC-12.2: Given błąd po stronie serwera (5xx), When Zapisz, Then komunikat ogólny i możliwość ponowienia bez utraty pól.
- AC-12.3 (brzeg - dwukrotne kliknięcie): Given przycisk w stanie "Zapisuję…", When kliknięty drugi raz, Then nie tworzy się drugi wpis.
- AC-12.4 (brzeg - dwa urządzenia): Given wpis dodany na telefonie, When na komputerze odświeżę hub, Then wpis i postęp są takie same (dane z serwera).

---

## 9. Reguły biznesowe

- **BR-1 Krytyczne są tylko minuty i data.** Cel tygodnia liczy się z minut (`countableCardioMinutes`); dystans, tętno, kalorie, kroki, wysiłek i notatka nie zmieniają celu. Komunikat w arkuszu mówi to jednym zdaniem (np. "Liczy się czas. Szczegóły służą do analizy").
- **BR-2 Jedna definicja tygodnia.** Postęp w arkuszu, na ekranie głównym i w hubie używa tej samej funkcji i tej samej definicji okna (decyzja Q-C3). Brak lokalnych kopii liczb w kliencie poza podglądem przed zapisem.
- **BR-3 Brak cichych zmian.** Żadne pole nie zmienia wartości bez komunikatu. Puste pole nie jest zamieniane na 1 ani 30. Tekst nieparsowalny nie jest zamieniany na brak.
- **BR-4 Jedna walidacja.** Reguły i limity żyją w jednym miejscu (`lib/cardio-utils.ts`, `CARDIO_INPUT_LIMITS`) i są używane w kliencie (podgląd i komunikaty) oraz na serwerze (decyzja autorytatywna).
- **BR-5 Limity minut.** Wpis 1-600 min (założenie A4, do zatwierdzenia Q-C2). Serwer dopuszcza do 1440 do czasu decyzji architekta. Komunikat powyżej limitu wskazuje wartość.
- **BR-6 Tętno.** Zakres 30-250 bpm dla śr. i max (istniejący). Śr. ≤ max, jeśli oba podane.
- **BR-7 Wysiłek.** Liczba całkowita 1-10, wybór ze skali (bez wolnego tekstu).
- **BR-8 Data.** Domyślnie dziś wg dnia lokalnego użytkownika; wstecz max 60 dni; przyszłość zakazana (istniejące reguły w `resolveCardioLogDate`).
- **BR-9 Dane zdrowotne.** Tętno, kalorie, kroki i dystans to dane o zdrowiu i ciele. Nie trafiają do logów, Sentry ani analityki zdarzeń (zasada BR-9 z analizy 009). Komunikaty błędów nie zawierają wartości wpisanej przez użytkownika (ryzyko ujawnienia w logach).
- **BR-10 Kalorie realne.** Kalorie ≤ 20 000 i kcal/min ≤ 25 (istniejące), błąd przy polu.
- **BR-11 Notatka.** Limit długości (założenie 280 znaków) egzekwowany po obu stronach; pusta i same spacje = brak.

---

## 10. Wymagania niefunkcjonalne i prywatność

- **NF-1 Telefon w trakcie treningu.** Arkusz otwierany z ekranu głównego i z hubu; zapis w < 3 dotknięcia dla typowego wpisu (rodzaj domyślny + minuty + zapisz). Czas do widocznego wyniku zapisu < 1 s przy dobrej sieci.
- **NF-2 Szybkość logowania serii.** Dotyczy aktywnego treningu siłowego, nie tego arkusza. Arkusz nie może wydłużać sesji siłowej (nie jest w niej osadzony).
- **NF-3 Dostępność.** WCAG AA; komunikaty błędów z `aria-live`; pigułki z `aria-pressed`; cele dotyku min. 44 px; fokus i Esc zgodnie z US-9.
- **NF-4 Prywatność.** Minimalizacja: arkusz nie zbiera nowych pól. Nie dodaje zgody, nie zapisuje tętna bez wyboru użytkownika ponad obecny stan (warunek: Q-P2, sekcja 12).
- **NF-5 Bezpieczeństwo wejścia.** Każde pole liczbowe parsowane ściśle (liczba, zakres, typ), notatka z limitem, brak wykonywania treści. Tu jest powierzchnia dla `tester-bezpieczenstwa` (sekcja 12).
- **NF-6 Tryb offline / PWA.** Brak kolejkowania offline w tym zadaniu (A8). Przy braku sieci wpis nie zapisuje się, a dane zostają w formularzu (US-12). Kolejkowanie to osobna decyzja produktu.
- **NF-7 Wydajność.** Podgląd postępu nie może dodawać zapytań przy każdym naciśnięciu pigułki lub ±5 (dane z propsów rodzica). Jeśli po zapisie potrzebna jest suma z serwera, to jedno lekkie zapytanie agregujące; wejście `tester-wydajnosci` zależy od decyzji `architekt`.
- **NF-8 Koszty.** Brak nowych usług zewnętrznych, brak nowych zmiennych środowiskowych. Zmiany są w kodzie, nie w konfiguracji.
- **NF-9 Analityka zdarzeń.** Jeśli arkusz wysyła zdarzenia (np. PostHog), to tylko nazwa ekranu i akcji, bez minut, tętna, kalorii, kroków i notatki (BR-9).

---

## 11. Pytania otwarte do właściciela produktu

Maksymalnie 5. Każde ma założenie, więc nie blokuje etapów 3-4.

- **Q-C1 - Zachowanie po zapisie.** Zostać w kontekście z komunikatem i linkiem, czy przekierować na `/cardio/<id>` jak dziś? Założenie: zostać w kontekście (AC-8.1). Wpływa na UX, nie na dane.
- **Q-C2 - Limit minut w jednym wpisie.** Założenie: 1-600 min w UI, z jawnym błędem powyżej. Alternatywa: 1-300 (dzisiejsze UI) albo 1-1440 (serwer). Wpływa na zakres UX i walidację.
- **Q-C3 - Definicja tygodnia cardio.** Kroczące 7 dni (`getWeeklyCardioProgress`, wiedza o projekcie) czy tydzień pn-nd (`cardio-hub`, analiza 009)? Założenie: jedna definicja dla całego produktu; analityk rekomenduje tydzień pn-nd dla spójności z kalendarzem tygodnia (decyzja metodologiczna, właściciel). Blokuje implementację postępu (F-12).
- **Q-C4 - Szczegóły rozwinięte czy zwinięte.** Założenie: zwinięte domyślnie, z licznikiem wypełnionych pól (AC-3.2). Alternatywa: otwarte dla P2 (pamiętane ostatnie ustawienie).
- **Q-C5 - Domyślny rodzaj.** Założenie: "Marsz" jak dziś (hub) albo ostatnio użyty (propozycja, nowe zachowanie). Wybór właściciela.

Q-P2 z bazy wiedzy (tętno i kroki jako dane art. 9 RODO, otwarte z etapu 005) nie jest pytaniem do właściciela tego zadania, ale jest warunkiem wejścia prawnika (sekcja 12).

---

## 12. Decyzja o bramkach (etap 1, wg `docs/zespol/przeplyw.md` "Dobór ról")

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `prawnik` | **POMINIĘTY na etapie 1**, z warunkiem ponownej oceny | Pola (tętno, kalorie, kroki, dystans, wysiłek, notatka) są te same co dziś, z tym samym odbiorcą i bez nowych usług. Redesign nie zmienia celów przetwarzania ani nie dodaje zgody. **Warunek ponownej oceny**: (a) Q-P2 z bazy wiedzy jest otwarte i wybrany zostanie wariant (B) "nie zapisywać tętna/kroków bez zgody" albo inny wariant wymagający zgody w arkuszu; (b) pojawi się nowe pole zdrowotne, eksport, udostępnianie lub zapis zdjęć. Wtedy `prawnik` wchodzi przed etapem 5. |
| `architekt` | **TAK** (etap 3) | Model walidacji i parsowania (F-1 do F-7, F-10), kontrakt wyniku z błędami pól, źródło postępu tygodnia i definicja okna (F-12, Q-C3), podział komponentu, wspólny model z edycją (US-11), zgodność z `java-backend/` i `/api/*`. Decyzje w ADR (nowy numer po 0008). |
| `ux` | **TAK** (etap 4), model `sonnet` | Nowy układ arkusza od zera (hierarchia, szczegóły zwinięte, postęp tygodnia, stany błędów, stany sieci). Według przeplywu projekt nowego ekranu od zera = `sonnet`. Makieta statyczna w `docs/ux/010-redesign-dodawania-cardio-makieta.html` (referencja dla `frontend`) i specyfikacja `docs/ux/010-redesign-dodawania-cardio.md`. |
| `backend` | **TAK** (etap 5) | Parsowanie ścisłe i walidacja w `lib/cardio-utils.ts` oraz `actions/workout.ts` / `actions/cardio.ts`, kontrakt wyniku, ewentualne zapytanie sumy po zapisie. Model `sonnet` (kod produkcyjny). |
| `frontend` | **TAK** (etap 5) | Rozbicie arkusza w `components/treningi/` (bez nowego katalogu), stan formularza, komunikaty przy polach, fokus i dostępność, podgląd postępu. Model `sonnet`. |
| `tester` | **TAK** (etap 7), **pełny plan testów** | Złożona logika czasowa (dzień lokalny, granica północy, okno tygodnia z F-12), reguły walidacji i parsowania z wieloma przypadkami brzegowymi, hipoteza F-13 (powtórne efekty). Zgodnie z przeplywem: złożona logika domenowa = `sonnet` i pełny plan. |
| `tester-bezpieczenstwa` | **TAK** (etap 7) - **nie zgadzam się z wstępną oceną koordynatora (pominięty)** | Zadanie zmienia obsługę danych wejściowych użytkownika (parsowanie liczb, notatka tekstowa, walidacja serwerowa jako autorytatywna, błędy zwracane do klienta), a arkusz przetwarza dane zdrowotne (tętno, kroki, kalorie). Przeplyw wymaga bramki przy "danych wejściowych" i przy danych zdrowotnych. Zakres: limit notatki, brak wartości w komunikatach i logach (BR-9), nadużycie wpisów (rate, duplikaty), zgodność walidacji klient/serwer. Model: domyślny `haiku` (zakres prosty, jeśli nie znajdzie problemów). |
| `tester-wydajnosci` | **POMINIĘTY na etapie 1, z warunkiem wejścia** | Dane tygodnia są przekazywane przez rodzica (brak nowego zapytania przy podglądzie). Wejście, jeśli `architekt` doda zapytanie agregujące po zapisie (NF-7) lub zmieni źródło danych hubu/ekranu głównego. Wtedy wchodzi na etapie 9, model `haiku` (jedno proste zapytanie). |

Ścieżka: **pełna**. Etapy 1-4 w tym zadaniu (analiza, decyzje, ADR, makieta). Etapy 5-10 po akceptacji użytkownika. Karta: `docs/zadania/010-redesign-dodawania-cardio.md` (zakłada koordynator).

---

## 13. Ryzyka

| Ryzyko | Prawdopodobieństwo / wpływ | Ograniczenie |
|---|---|---|
| Naprawa F-1 do F-4 zmieni zachowanie, do którego użytkownicy przywykli (np. puste pole zapisywało "1") | Wysokie / niski | Komunikat zmiany w changelogu; wpisy historyczne bez zmian |
| Nowy limit minut (A4) odrzuci dotychczas poprawne wpisy 300-600 min | Niskie / niski | Istniejące wpisy nie są przeliczane; limit tylko dla nowych |
| Postęp w arkuszu pokaże inną liczbę niż ekran główny lub hub (F-12) | Wysokie / wysoki | Q-C3 przed implementacją; test zgodności (AC-2.7) |
| Hipoteza F-13 (powtórny toast/przekierowanie) potwierdzi się i zostanie przeniesiona do nowego arkusza | Średnie / wysoki | Stabilny efekt po zapisie i test AC-8.2 w `tester` |
| Walidacja klient/serwer rozjedzie się ponownie | Średnie / średni | Wspólny parser i zakresy (BR-4), wspólne testy jednostkowe (wymaganie dla `tester`) |
| Dane zdrowotne (tętno, kroki) w komunikatach błędów lub logach | Niskie / wysoki | BR-9, `tester-bezpieczenstwa`, brak wartości w tekście błędu |
| Zwinięte szczegóły ukryją pola, które P2 chce wypełniać | Średnie / średni | Licznik wypełnionych (AC-3.2) i pamiętanie stanu (Q-C4) |
| Data i strefa czasowa (F-11) dadzą wpis w złym dniu i złym tygodniu | Średnie / wysoki | `tester` z testami na granicy północy i strefy; decyzja architekta o źródle dnia |
| Rozszerzenie zakresu na edycję wpisu (US-11) wydłuży etap | Średnie / średni | Edycja poza zakresem wdrożenia, tylko wspólny model walidacji |

---

## 14. Zależności i wpływ

- **Zależności**: Q-C3 (definicja tygodnia) blokuje US-2 i AC-2.7; decyzja z analizy 009 (BR-1, BR-2) jest tu kontekstem; Q-P2 (prawnik) jest warunkiem wejścia zgody.
- **Edycja wpisu**: `components/cardio/cardio-detail-client.tsx` (pole `avgHr` i inne) oraz edytor w `workout-finished-screen.tsx` (wiersz "Edytuj", pozycje S-2/S-3 w `docs/bledy-do-naprawy/bledy.md`) mają własne formularze. Wspólny model walidacji dotyczy ich pośrednio (US-11). Decyzja zakresu: `architekt`.
- **Android**: WebView otwiera te same strony; arkusz jest częścią webu. Nie znaleziono w `android/` odwołań do walidacji cardio po nazwach reguł (`validateCardioMetrics`, `CARDIO_INPUT_LIMITS`). Potwierdzi `architekt`, czy Android zapisuje cardio przez inny kontrakt.
- **Java**: w `java-backend/` nie znaleziono tych reguł po nazwach. Według bazy wiedzy Java nie obsługuje PATCH cardio (ADR p.9) i parytet jest świadomie ograniczony. Potwierdzi `architekt`, czy nowy zakres limitów i komunikatów wymaga zmiany po stronie Javy.
- **Bramka `deploy:check`**: przed merge (etap implementacji). Zmienne środowiskowe: brak nowych (NF-8).
- **Changelog**: wpis `planned: true` na PR; zmiana zachowania (zapis pustej minuty, limit, komunikaty) opisana w changelogu.
- **Wpływ na dokumenty**: `docs/zespol/wiedza-o-projekcie.md` (sekcja cardio) po implementacji; `docs/ux/` (nowy wzorzec: arkusz z hierarchią i postępem tygodnia).

---

## 15. Kolejność proponowana dla etapów 3-4

1. **`architekt` (ADR nowy numer)**: 
   - potwierdzić F-12 (zakres 8 dat w `getWeeklyCardioProgress`) i wybrać jedną definicję tygodnia zgodnie z decyzją Q-C3;
   - zaprojektować jeden parser pól liczbowych (ścisły, zwraca błąd zamiast `null`) i wspólny kontrakt wyniku z `fieldErrors` (kompatybilny z obecnym `notifyError`);
   - ustalić, skąd pochodzi postęp w arkuszu: propsy od rodzica bez zapytania, a po zapisie suma z serwera (jedno zapytanie, NF-7);
   - potwierdzić F-11 (strefa czasowa `calendarDateKey` a etykieta w przeglądarce) i wybrać źródło dnia dla wpisu;
   - potwierdzić hipotezę F-13 i zaprojektować stabilny efekt po zapisie;
   - rozdzielić komponent na powłokę, wybór rodzaju, stepper, sekcję szczegółów i hook formularza, bez nowego katalogu (`components/treningi/`);
   - ustalić wspólny model z edycją (US-11), zgodność z `/api/*`, Androidem i Javą (sekcja 14);
   - potwierdzić A1 (samodzielny wpis `cardio_log` w arkuszu).
2. **`ux` (sonnet, makieta)**: 
   - układ: nagłówek z postępem tygodnia i podglądem po zapisie, rodzaj (pigułki z `aria-pressed`), minuty z presetami i stepperem, data jako wiersz, sekcja "Szczegóły (opcjonalne)" zwinięta z licznikiem, wysiłek jako skala 1-10, stopka z przyciskiem i zdaniem "Liczy się czas";
   - stany: domyślny, pierwszy wpis w tygodniu, cel osiągnięty, błąd przy polu, błąd sieci (dane zostają), zapisywanie, sukces (Q-C1);
   - makieta 390 px i desktop (`docs/ux/010-redesign-dodawania-cardio-makieta.html`), spójna z systemem `docs/ux/00-system-projektowy-stan.md`;
   - mikrokopia po polsku (sekcja 8, komunikaty AC) do zatwierdzenia przez właściciela.
3. **Akceptacja użytkownika** przed etapem 5 (decyzje Q-C1 do Q-C5, zatwierdzenie limitu A4, akceptacja tester-bezpieczenstwa w bramkach).

---

## 16. Najważniejsze wnioski dla koordynatora (skrót)

- Zbierane są wszystkie dane potrzebne do liczenia cardio dodatkowego, ale tylko minuty (i pośrednio data) są krytyczne. Pozostałe pola to metadane.
- Najgroźniejsze luki to cicha zamiana wartości: puste pole minut = 1 min, przecinek = dopisanie cyfr, "3 km" i "125 bpm" znikają bez komunikatu.
- Dwie definicje tygodnia cardio (kroczące 7 dni vs pn-nd) wymagają decyzji właściciela przed implementacją postępu.
- Dwa miejsca otwarcia, a nie kilka; oba mają już dane tygodnia, których arkusz nie używa.
- Zmiana `tester-bezpieczenstwa` z pominiętego na wymagany, bo zadanie zmienia obsługę danych wejściowych i danych zdrowotnych.
