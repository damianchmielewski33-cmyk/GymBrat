# ADR 0009 — Redesign arkusza „Dodaj cardio” (architektura, bez implementacji)

- **Karta zadania**: `docs/zadania/010-redesign-dodawania-cardio.md` (koordynator zakłada po tym etapie)
- **Etap**: 3 — Projekt techniczny (`architekt`). Zero zmian w kodzie produkcyjnym.
- **Wejście**: `docs/analiza/010-redesign-dodawania-cardio.md` (etap 1, F-1…F-14, U-1…U-12, BR-1…BR-11, US-1…US-12, Q-C1…Q-C5, decyzja o bramkach).
- **Autor**: architekt (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `ux` (etap 4) i dla przyszłego zadania implementacyjnego (etap 5)
- **Przeczytany kod źródłowy**: `components/treningi/cardio-log-sheet.tsx` (cały), `actions/workout.ts` (`logCardioDetailedAction`, l. 1-96), `actions/cardio.ts` (cały), `lib/cardio-utils.ts` (cały), `lib/cardio.ts` (`getWeeklyCardioProgress`), `lib/cardio-hub.ts` (`getCardioHubData`), `lib/workout-cardio-attribution.ts`, `components/home/home-training-card.tsx` (l. 58-145), `components/cardio/cardio-hub-view.tsx` (l. 14, 64-82, 575-580), `components/home/home-today-page-content.tsx` (l. 150-158).

---

## 1. Kontekst

Arkusz „Dodaj cardio” tworzy samodzielny wpis `workouts` z `exercises` JSON `{ kind: "cardio_log" }`. Zgodnie z `countableCardioMinutes` (`lib/workout-cardio-attribution.ts:46-55`) wpis taki zalicza się do celu tygodniowego **w całości i wyłącznie przez minuty**. Dziś arkusz ma trzy niezależne grupy problemów, potwierdzone w analizie i w czytaniu kodu:

1. **Walidacja ucieka przed komunikatem błędu.** `logCardioDetailedAction` (`actions/workout.ts:20-84`) konwertuje wartości spoza zakresu (wysiłek, pośrednio też liczby niefinite/≤0 dla dystansu, tętna, kalorii, kroków) na `null` **przed** wywołaniem `validateCardioMetrics` (`lib/cardio-utils.ts:373-436`). Efekt: `validateCardioMetrics` nigdy nie zobaczy złej wartości wysiłku (bo akcja ją już wyciszyła), a dla tętna/kalorii/kroków/dystansu zobaczy `null` zamiast oryginalnej liczby, więc błąd zakresu (np. tętno 5 bpm) **jest** zgłaszany, ale błąd formatu („abc”, „125 bpm”) **nigdy nie dotrze** do walidatora — po stronie klienta zniknie bez śladu. Dwa różne zachowania dla jednej klasy błędu (F-4, F-6).
2. **Trzy niezgodne zakresy minut w trzech miejscach**: klient `clampMinutes` 1-300 (`cardio-log-sheet.tsx:66-69`), `validateCardioMetrics` 1-1440 (`CARDIO_INPUT_LIMITS.minutesMax = 24*60`), zero wspólnej stałej między nimi (F-3, F-10).
3. **Dwie zweryfikowane definicje tygodnia cardio**: `getWeeklyCardioProgress` (`lib/cardio.ts:20-81`) liczy okno kroczące `now − 7×24h` do teraz, obcięte do dni kalendarzowych (`weekAgo = Date.now() − WEEK_MS`, `calendarDateKey(weekAgo)` jako dolna granica, `calendarDateKey(now)` jako górna) — **potwierdzam F-12: to jest 8 dat kalendarzowych włącznie**, nie 7. `getCardioHubData` (`lib/cardio-hub.ts:72-232`) liczy tydzień poniedziałek–niedziela (`mondayOfWeek`/`weekMonday`/`sunday`). Te dwie funkcje **są** rzeczywiście używane w dwóch różnych miejscach UI: `home-today-page-content.tsx:155,157` (`dash.cardioThisWeekMinutes`/`dash.cardioWeeklyGoal`, pochodzące z `getWeeklyCardioProgress` — potwierdzone nazwą i kształtem, patrz sekcja 3.1) zasila kafelek główny (`home-training-card.tsx`), a `cardio-hub-view.tsx:578` (`data.goalMinutes`, z `getCardioHubData`) zasila hub. Arkusz dziś nie pokazuje żadnego postępu — pokazuje tylko statyczny cel (`cardio-log-sheet.tsx:182`).
4. **Zweryfikowany mechanizm F-13**: efekt po sukcesie (`cardio-log-sheet.tsx:120-131`) ma w zależnościach `onClose`, przekazywany z obu rodziców jako **inline arrow function** (`() => setCardioOpen(false)` w `home-training-card.tsx:131`, `() => setSheetOpen(false)` w `cardio-hub-view.tsx:577`). Taki prop ma nową identyczność przy **każdym** renderze rodzica. Efekt sam w sobie woła `router.refresh()` (l. 126), co wywołuje ponowne wyrenderowanie poddrzewa — w tym samego `CardioLogSheet` z nową funkcją `onClose`. `useActionState`'owy `state` nie resetuje się między renderami (persystuje, aż do następnego `submit`). Rezultat: zależność efektu zmienia się → efekt wykonuje się **drugi raz** dla tego samego `state.ok === true` → drugi `notifySaved`, drugi (no-op, bo już zamknięte) `onClose()`, i **drugi `router.push`/`router.refresh`** dla tego samego, już nieaktualnego `id`. **Potwierdzam F-13 jako realny defekt architektoniczny, nie tylko hipotezę** — wynika deterministycznie z kombinacji (inline prop + efekt wywołujący `router.refresh` + brak resetu stanu akcji), niezależnie od tego, czy `tester` zdąży go zaobserwować manualnie. Priorytet w nowej architekturze: wysoki.

Reszta pól (dystans, tętno, wysiłek, kalorie, kroki, notatka) to metadane do analizy obciążenia/stref — nie wpływają na cel. To jest **potwierdzone przez kod** (`isStandaloneCardioLog`/`countableCardioMinutes`), nie założenie.

---

## 2. Decyzje architektoniczne

### 2.1 Jeden model walidacji i parsowania — parser zwraca błąd, nigdy ciche `null`

**Opcje rozważane**
1. Zostawić dzisiejszy podział (parsowanie liberalne w akcji, walidacja zakresu w `validateCardioMetrics`), tylko dociągnąć brakujące reguły (max≥avg, wysiłek).
2. Przenieść całe parsowanie i walidację do jednej funkcji w `lib/cardio-utils.ts`, wołanej identycznie przez klienta (podgląd błędu przed submitem) i serwer (źródło prawdy), zwracającej **błąd dla każdego pola, które nie jest ani poprawną liczbą w zakresie, ani puste** — zero cichych zamian na `null`/wartość domyślną.
3. Walidacja przez Zod schema w `lib/cardio-utils.ts`, z `safeParse` i mapowaniem błędów na `fieldErrors`.

**Decyzja**: Opcja 2, zaimplementowana jako pojedyncza, czysta funkcja (bez Zod — uzasadnienie niżej), bo to jest zmiana **zachowania** (cicha utrata → błąd blokujący), nie tylko refaktor. Zod jest już używany w repo (zgodnie z zasadami ogólnymi walidacji wejścia), ale nie jest tu konieczny: pola to płaskie liczby/string z niewielką liczbą reguł współzależnych (max≥avg, kcal/min), które czytelniej wyrazić w zwykłych `if`, tak jak `validateCardioMetrics` już robi — **nie dodaję nowej zależności/wzorca bez uzasadnienia** (zasada „nudne, sprawdzone”). Zod zostaje zarezerwowany dla miejsc, gdzie już jest standardem w repo (np. `fitnessGoalsSchema`); tu rozszerzamy istniejący, działający wzorzec.

**Kontrakt** (`lib/cardio-utils.ts`, zastępuje `validateCardioMetrics` — nazwa zostaje, zmienia się sygnatura i semantyka):

```ts
export type CardioFieldKey =
  | "minutes" | "date" | "distanceKm" | "avgHr" | "maxHr"
  | "effortScore" | "calories" | "steps" | "notes";

export type CardioFieldError = { field: CardioFieldKey; message: string };

export type CardioMetricsInput = {
  minutes: unknown;        // wymagane, niepusty string/number
  distanceKm?: unknown;    // opcjonalne: "" / null / undefined = brak; inaczej musi parsować się jako liczba w zakresie
  avgHr?: unknown;
  maxHr?: unknown;
  calories?: unknown;
  steps?: unknown;
  effortScore?: unknown;   // teraz WALIDOWANE (dziś: brak reguły w validateCardioMetrics — F-5)
};

export type ValidatedCardioMetrics = {
  minutes: number; distanceKm: number | null; avgHr: number | null;
  maxHr: number | null; calories: number | null; steps: number | null;
  effortScore: number | null;
};

export function validateCardioMetrics(input: CardioMetricsInput):
  | { ok: true; values: ValidatedCardioMetrics }
  | { ok: false; fieldErrors: CardioFieldError[] };
```

Reguły (jedna funkcja, wołana identycznie z klienta — do podglądu błędu przy `onBlur`/przed `submit` — i z serwera jako źródło prawdy):

- **Minuty**: wymagane. Pusty string → błąd `"Podaj czas w minutach."`, nie `1`. Separator dziesiętny (`,`/`.`) → błąd `"Podaj minuty jako liczbę całkowitą."`, zamiast odfiltrowania cyfr po przecinku (koniec z F-2: parser **nie** robi `replace(/[^\d]/g, "")`, akceptuje tylko `/^\d+$/` i w innym przypadku zwraca błąd pola). Zakres `1–CARDIO_MINUTES_MAX` (sekcja 2.2) — przekroczenie to błąd pola, nigdy ucinanie (koniec F-3).
- **Pola opcjonalne liczbowe (dystans, śr. tętno, max tętno, kalorie, kroki)**: pusty string/`null`/`undefined` → `null`, poprawne (koniec F-1 analogicznie dla tych pól — pusty jest legalny, bo są opcjonalne). **Każda wartość niepusta, która nie parsuje się jako liczba dodatnia** (np. `"abc"`, `"3 km"`, `"125 bpm"`, `0`, liczba ujemna) → błąd pola z nazwą tego pola, **zamiast cichego `null`** (koniec F-4). Wartość w zakresie limitów (sekcja 2.2, z `CARDIO_INPUT_LIMITS`) → OK; poza zakresem → błąd pola z tym samym komunikatem co dziś (koniec F-6 — jedna ścieżka obsługi, nie dwie).
- **Max tętno ≥ śr. tętno**, gdy oba podane → błąd pola `maxHr`: `"Maksymalne tętno nie może być niższe od średniego."` (nowa reguła, F-7).
- **Wysiłek**: pusty → `null` (opcjonalne). Niepusty, poza `1–10` całkowite → błąd pola (koniec F-5: dziś cicho `null` w obu akcjach, `actions/workout.ts:75-81` i `actions/cardio.ts:133-139`, zero reguły w `validateCardioMetrics`). W nowej architekturze pole UI to wybór ze skali (sekcja `ux`), więc klient strukturalnie nie może wysłać wartości poza zakresem — walidacja serwerowa zostaje jako obrona w głąb (np. zmanipulowany request).
- **Kalorie realne**: `kcal/min > 25` → błąd pola `calories` (zostaje, F-8 chce komunikat **przy polu**, nie tostem — to już zmiana w sekcji 2.5, nie w tej funkcji).
- **Notatka**: limit 280 znaków (BR-11, A4 z analizy sekcja 7 — do zatwierdzenia przez właściciela, patrz pytania otwarte), trim, same spacje → `null`. Walidacja długości wchodzi do tej samej funkcji jako osobne pole `CardioFieldKey = "notes"`, egzekwowana identycznie klient/serwer.
- **Data**: zostaje osobną funkcją `resolveCardioLogDate` (już w `actions/cardio.ts:31-50`, reguły OK — zero zmiany logiki), ale jej błąd trafia do **tego samego** kontraktu `CardioFieldError` (`field: "date"`), żeby `fieldErrors` UI miało jedno miejsce odczytu dla wszystkich pól łącznie z datą. Przenoszę `resolveCardioLogDate` do `lib/cardio-utils.ts` razem z resztą walidacji (dziś żyje tylko w `actions/cardio.ts`), żeby `lib/cardio-utils.ts` było jedynym miejscem reguł wejścia cardio — `actions/cardio.ts` i `actions/workout.ts` tylko **wywołują**, nie definiują reguł.

**Zero cichych zmian (BR-3)**: usuwam z `actions/workout.ts:38-81` cały blok `Number(...) → niefinite/≤0 → null` — to parsowanie przenosi się **do** `validateCardioMetrics`, jako jego wewnętrzna, spójna logika z błędami, a nie przed-filtr w akcji. `logCardioDetailedAction` po zmianie tylko odczytuje `FormData`, woła `validateCardioMetrics(rawInput)` i albo zwraca `fieldErrors`, albo przekazuje `values` do `createCardioLog`. `createCardioLog` **nie** woła drugiej walidacji z własnym parsowaniem (dziś woła `validateCardioMetrics` ponownie na już „oczyszczonych” przez akcję liczbach — po zmianie woła ją raz, na surowym wejściu, bo akcja przestaje czyścić).

### 2.2 Limit minut — jedna stała, jeden zakres

**Opcje rozważane**
1. Zostawić serwer na 1-1440 (24h), podnieść klienta do 1440 (zero zmiany zakresu, tylko usunięcie rozjazdu).
2. Jedna wspólna stała **1-600** (10h) dla klienta i serwera, z jawnym błędem powyżej (założenie A4 analizy).
3. Jedna wspólna stała, ale 1-300 (dzisiejsze UI), podnosząc restrykcyjność serwera.

**Decyzja**: Opcja 2, zgodnie z rekomendacją analityka (Q-C2, założenie A4) — 600 minut (10h) pokrywa realistyczne cardio (maraton, długi trekking, triathlon) z marginesem, a 1440 (24h) nie odfiltrowywało literówek typu „400” zamiast „40”, które dziś przechodzą bez błędu na serwerze mimo że klient je uciął po cichu do 300. Jedna stała w `lib/cardio-utils.ts`:

```ts
export const CARDIO_INPUT_LIMITS = {
  minutesMax: 600, // ZMIANA z 1440 (serwer) i 300 (klient, cicho) — jeden limit, jawny błąd powyżej
  // ... resztą bez zmian
} as const;
```

Klient importuje `CARDIO_INPUT_LIMITS.minutesMax` z `lib/cardio-utils.ts` (dziś go nie importuje — ma własny magiczny `300`). Zero drugiego źródła liczby. Komunikat błędu: `"Maksymalnie 600 min w jednym wpisie."` (AC-1.4). Istniejące wpisy 300-600 min nie są przeliczane ani blokowane retroaktywnie (ryzyko z analizy, tabela 13 — ograniczenie: limit działa tylko na nowe zapisy, odczyt/edycja istniejących wpisów > 600 min nadal wyświetla je bez błędu, bo walidacja wejścia nie jest wywoływana przy odczycie).

### 2.3 Definicja tygodnia cardio w arkuszu — decyzja o zakresie zmiany

**Rozstrzygnięcie Q-C3 (rekomendacja dla właściciela, nieblokujące)**: rekomenduję **tydzień poniedziałek–niedziela** (`getCardioHubData`/`cardio-hub.ts`) jako definicję kanoniczną dla **postępu wyświetlanego w arkuszu**, z trzech powodów: (a) to jest definicja zgodna z kalendarzem, którą użytkownik widzi w hubie — jeśli arkusz ma pokazywać „ile już mam w tym tygodniu”, powinien zgadzać się z tym, co użytkownik zobaczy natychmiast po zamknięciu arkusza w hubie (AC-2.7); (b) okno kroczące `getWeeklyCardioProgress` zmienia granicę **w ciągu dnia** (bo liczy od `Date.now()`, nie od północy), co jest złym kandydatem na liczbę pokazywaną w formularzu, gdzie użytkownik oczekuje stabilnej wartości w trakcie wypełniania; (c) tydzień pn-nd ma już gotową, przetestowaną implementację z rozbiciem na dni (`last8[0]`), którą można odczytać bez nowego zapytania.

**Decyzja o zakresie tego zadania (jawna, zgodnie z poleceniem architekta w analizie sekcja 15.1)**: **ten ADR NIE ujednolica `lib/cardio.ts` i `lib/cardio-hub.ts`.** Zakres to redesign ekranu arkusza, nie przebudowa całej logiki cardio. Pozostawiam obie funkcje bez zmian zachowania — `getWeeklyCardioProgress` (rolling 7 dni) nadal zasila kafelek główny tak jak dziś (poza zakresem tego zadania zmieniać to, co pokazuje kafelek), a arkusz **niezależnie od miejsca otwarcia** zawsze pokazuje postęp wg definicji pn-nd, czytany z `getCardioHubData`. To oznacza:

- Gdy arkusz jest otwarty **z hubu** (`cardio-hub-view.tsx`), rodzic już ma `data` z `getCardioHubData` — przekazuje `weekProgress` bez nowego zapytania (propsy istnieją, patrz `data.minutesThisWeek`/`data.goalMinutes`, `lib/cardio-hub.ts:218-231`).
- Gdy arkusz jest otwarty **z kafelka głównego** (`home-training-card.tsx`), rodzic dziś ma tylko `cardioThisWeekMinutes`/`cardioGoalMinutes` z `getWeeklyCardioProgress` (rolling), **niezgodne** z definicją, którą arkusz ma pokazywać. Rodzic musi dociągnąć minimalny podzbiór z `getCardioHubData` (tylko `minutesThisWeek`+`goalMinutes`, nie całą listę 400 wierszy) **albo** wywołać nową, lekką funkcję `getCardioWeekProgressPnNd(userId): { minutesThisWeek: number; goalMinutes: number; weekMonday: string }` w `lib/cardio-hub.ts`, która liczy **tylko** tydzień bieżący (bez 8-tygodniowej historii, bez `items`), żeby nie płacić kosztu całego huba na stronie głównej. To jest nowa, mała funkcja (ekstrakcja fragmentu istniejącej logiki `getCardioHubData`, nie duplikat wzoru liczenia — woła tę samą `countableCardioMinutes`), **nie** zmiana istniejących funkcji.
- **Konsekwencja widoczna dla użytkownika, do ujawnienia w changelogu**: kafelek główny (poza arkuszem) **nadal** pokazuje rolling-7-dni (bez zmiany w tym zadaniu), a sam arkusz po otwarciu pokaże inną liczbę (pn-nd) niż kafelek pod nim w tym samym ekranie. To jest świadomy, tymczasowy kompromis zakresu — **rekomendacja dla właściciela**: osobne zadanie ujednolicenia `lib/cardio.ts`/`lib/cardio-hub.ts` dla całego produktu (BR-2 z analizy 009), nie część tego ADR. Jeśli właściciel uzna tę niezgodność za nieakceptowalną w tym zadaniu, alternatywa to pokazać w arkuszu rolling-7-dni (ta sama liczba co kafelek, zero nowego zapytania na stronie głównej, ale rozjazd z hubem) — przesuwam tę decyzję do właściciela jako pytanie otwarte (sekcja 5).

### 2.4 Źródło danych postępu tygodnia w arkuszu — propsy, nie nowy fetch przy każdym otwarciu

**Opcje rozważane**
1. `CardioLogSheet` sam woła Server Action przy `open=true` (klient → serwer przy każdym otwarciu arkusza).
2. **Rodzic (RSC) przekazuje już policzony postęp jako prop; po zapisie klient pokazuje sumę zwróconą przez samą akcję zapisu (nie przez drugi fetch).**
3. Kontekst React współdzielony między hubem i kafelkiem głównym.

**Decyzja**: Opcja 2 — zgodna z NF-7 analizy („podgląd postępu nie dodaje zapytań przy każdym naciśnięciu pigułki/±5 — dane z propsów rodzica”) i z wzorcem już przyjętym w ADR 0008 (sekcja 6, „bez nowej zależności do pobierania danych, Server Actions zwracają świeże dane po akcji”). Nowy kontrakt propsów:

```ts
type CardioWeekProgress = {
  minutesCompleted: number;   // tydzień pn-nd, bieżący (sekcja 2.3)
  goalMinutes: number;
  weekLabel: string;          // np. "12–18 paź" — gotowe z lib/cardio-hub.ts (weekShortLabel), bez liczenia w kliencie
};

type CardioLogSheetProps = {
  open: boolean;
  onClose: () => void;
  weekProgress: CardioWeekProgress;   // ZMIANA: zastępuje `cardioGoalMinutes: number`
  defaultTitle?: string;
};
```

`cardio-hub-view.tsx` przekazuje `weekProgress={{ minutesCompleted: data.minutesThisWeek, goalMinutes: data.goalMinutes, weekLabel: weekShortLabel(data.weekMonday) }}` bez nowego zapytania (dane już w `data`). `home-training-card.tsx` przekazuje analogiczny obiekt, zasilony przez nowy, lekki loader z sekcji 2.3 (osobne, małe zapytanie w RSC rodzica tej karty — do zlokalizowania przez `backend` tam, gdzie dziś woła się `getWeeklyCardioProgress` dla `dash.cardioThisWeekMinutes`).

**Po zapisie (AC-2.6)**: wynik zapisu z `createCardioLog` zwraca dodatkowo `weekMinutesAfter: number` (suma **po** zapisie, policzona w tej samej akcji serwerowej, jednym dodatkowym, lekkim zapytaniem — nie przez ponowne wołanie całego `getCardioHubData`, tylko przez nową, małą funkcję z sekcji 2.3 ograniczoną do bieżącego tygodnia). Klient pokazuje tę wartość w komunikacie sukcesu (sekcja 2.6), **nie** przelicza sam `minutesCompleted + wpisane minuty` jako liczbę finalną (bo data wpisu może nie być „dziś” — wpis wstecz do innego tygodnia nie zmienia bieżącego tygodnia; podgląd **przed** zapisem, czyli „po zapisie będzie X”, może być liczony po stronie klienta jako *szacunek*, jawnie oznaczony, tylko gdy wybrana data wpada w aktualnie wyświetlany tydzień — inaczej podgląd pokazuje tydzień docelowy z etykietą daty, bez liczby „po”, zgodnie z AC-2.5).

### 2.5 Kontrakt błędów — `fieldErrors`, nie tylko toast

Wynik akcji (`logCardioDetailedAction`/`createCardioLog`) zmienia kształt:

```ts
type CardioSaveResult =
  | { ok: true; id: string; weekMinutesAfter: number }
  | { ok: false; error?: string; fieldErrors?: CardioFieldError[] };
```

`error` (ogólny, np. „Sesja wygasła”, błąd sieci/5xx) zostaje tostem (`notifyError`), zgodnie z dzisiejszym wzorcem. `fieldErrors` (walidacja pól, sekcja 2.1) renderuje się **przy polu** w `CardioLogSheet` (`aria-invalid`, `aria-describedby`, fokus na pierwszym błędnym polu — AC-4.6/4.7), **bez** tostu dla tej klasy błędów (żeby nie duplikować komunikatu w dwóch miejscach). To jest zmiana kontraktu Server Action, więc dotyka `useActionState` w kliencie — do uwzględnienia przez `frontend` jako przebudowa stanu formularza (osobny `useState<CardioFieldError[]>` albo mapowanie z `state.fieldErrors`).

### 2.6 F-13 — stabilny efekt po zapisie

**Potwierdzony mechanizm** (sekcja 1, punkt 4): inline `onClose` w obu rodzicach + `router.refresh()` wewnątrz efektu + brak resetu `state` = potencjalnie wielokrotne wykonanie efektu dla tego samego sukcesu.

**Opcje rozważane**
1. Memoizować `onClose` w obu rodzicach (`useCallback`) — usuwa tylko jedną z trzech przyczyn, zostaje fragile (każdy trzeci rodzic w przyszłości może powtórzyć błąd).
2. **Śledzić, który `id` wyniku już został obsłużony, lokalnie w `CardioLogSheet` (`useRef<string | null>`), i uruchamiać efekt tylko gdy `state.id` różni się od ostatnio obsłużonego — niezależnie od tożsamości `onClose`.**
3. Resetować `state` z `useActionState` po obsłużeniu (nie jest możliwe bezpośrednio — `useActionState` nie udostępnia settera stanu niezależnego od akcji; wymagałoby `key` resetującego cały komponent, co jest bardziej inwazyjne).

**Decyzja**: Opcja 2, jako **kontrakt obowiązkowy** dla nowego `CardioLogSheet`, niezależnie od tego, czy rodzice dalej przekazują inline `onClose` (wygodna, czytelna konwencja w repo — nie wymuszam `useCallback` na wywołujących, bo odporność nie powinna zależeć od dyscypliny każdego nowego miejsca wywołania):

```ts
const handledIdRef = useRef<string | null>(null);
useEffect(() => {
  if (state?.ok === true && state.id && handledIdRef.current !== state.id) {
    handledIdRef.current = state.id;
    notifySaved(`Zapisano ${state.values?.minutes ?? ""} min. ${weekSummaryText}`);
    onClose();
    // Bez router.push/router.refresh automatycznego — patrz 2.7 (Q-C1).
  }
}, [state, notifySaved, onClose]);
```

To usuwa F-13 strukturalnie: drugi render z nową tożsamością `onClose` wejdzie w efekt (deps się zmieniły), ale warunek `handledIdRef.current !== state.id` jest `false`, więc ciało efektu się nie wykonuje drugi raz. `handledIdRef` resetuje się naturalnie przy ponownym otwarciu arkusza (razem z resetem pól formularza w istniejącym `useEffect` na `open`, `cardio-log-sheet.tsx:103-118` — dopisać `handledIdRef.current = null` tam).

### 2.7 Zachowanie po zapisie — Q-C1

**Decyzja**: rekomendacja analityka (AC-8.1, „zostać w kontekście”) — **zatwierdzam jako decyzję architektoniczną domyślną**, bo usuwa jednocześnie F-14 (utrata kontekstu) i zmniejsza powierzchnię F-13 (brak automatycznego `router.push`/`router.refresh` w efekcie sukcesu = jedna przyczyna mniej, nawet bez 2.6). Po sukcesie: arkusz się zamyka (`onClose()`), toast/komunikat pokazuje `"Zapisano {minuty} min. Tydzień: {weekMinutesAfter} z {goalMinutes} min"` z opcjonalnym linkiem „Zobacz wpis” (`/cardio/{id}`) jako **akcja użytkownika**, nie automatyczne przekierowanie. `router.refresh()` **nie** jest wołane z efektu klienta — odświeżenie danych rodzica (hub/kafelek) następuje przez `revalidatePath` już wykonywane w `revalidateCardio()` (`actions/cardio.ts:52-61`), które działa po stronie serwera i odświeży RSC przy następnej nawigacji/renderze, zgodnie z modelem Next.js tej wersji (do zweryfikowania przez `frontend` w `node_modules/next/dist/docs/` przed implementacją — `revalidatePath` bez jawnego `router.refresh()` po stronie klienta może wymagać potwierdzenia, że klient zobaczy świeże dane w tym samym widoku bez ręcznej nawigacji; jeśli nie, dopuszczalne jest jedno, świadome, pojedyncze `router.refresh()` wywołane **przed** `onClose()` w tej samej, idempotentnej (dzięki `handledIdRef`) ścieżce — nie jako automatyczne przekierowanie na inną stronę).

**Pytanie otwarte dla właściciela** (nieblokujące, zob. sekcja 5): to jest zmiana zachowania, do której użytkownicy mogli się przyzwyczaić (dziś zawsze trafiają na `/cardio/[id]`). Rekomendacja architekta: zostać w kontekście.

### 2.8 Oznaczenie „co się liczy do celu”

Zgodnie z BR-1: jedno zdanie w stopce/nagłówku arkusza (mikrokopia dla `ux`), np. „Liczy się czas. Pozostałe pola to dane do analizy obciążenia.” — czysto prezentacyjne, zero zmiany logiki. Kontrakt danych dla `ux`/`frontend`: pole `minutes` ma wizualną hierarchię nadrzędną (nagłówek sekcji, nie tylko większy font) względem sekcji „Szczegóły (opcjonalne)”, która zwija pozostałe pola (US-3). To jest w całości w gestii `ux` (etap 4) — architektura tylko gwarantuje, że dane do pokazania tej hierarchii (które pole jest krytyczne) są już jawne w typach (`ValidatedCardioMetrics.minutes` jest `number`, reszta `| null`).

### 2.9 Podział komponentu

`components/treningi/cardio-log-sheet.tsx` (dziś jeden plik, 365 linii) dzielę na, bez nowego katalogu (zgodnie z konwencją „jeden komponent w jednym katalogu komponentów” — zostaje `components/treningi/`):

- `cardio-log-sheet.tsx` — powłoka: portal, dialog, `form action`, orkiestracja stanu (`useActionState`, `handledIdRef`), komponuje poniższe.
- `cardio-log-type-picker.tsx` — pigułki rodzaju (`aria-pressed`, etykiety z `CARDIO_TYPE_LABELS_PL`, nie z lokalnego `MACHINES` — koniec U-10/AC-6.1).
- `cardio-log-minutes-field.tsx` — stepper + pole minut + presety (15/30/45/60, U-6), zintegrowany z nowym parserem (2.1).
- `cardio-log-details-section.tsx` — sekcja zwijana „Szczegóły (opcjonalne)” z licznikiem wypełnionych pól (AC-3.2), zawiera dystans/tętno/wysiłek/kalorie/kroki/notatkę z `fieldErrors` przy każdym polu.
- `cardio-log-week-progress.tsx` — nagłówek z paskiem postępu tygodnia (`weekProgress` z propsów, sekcja 2.4).

Każdy plik ma jedną odpowiedzialność, testowalny w izolacji (props → render), zgodnie z wzorcem przyjętym w ADR 0007/0008.

### 2.10 Zasięg wspólnego modelu walidacji (US-11) — decyzja zakresu

**Decyzja**: ten ADR projektuje wspólny model walidacji (`validateCardioMetrics` w `lib/cardio-utils.ts`, sekcja 2.1) jako **jedyne** miejsce reguł wejścia cardio, z zamiarem, że **wszystkie** trzy miejsca wprowadzania/edycji cardio (arkusz „Dodaj cardio”, `cardio-detail-client.tsx`, edytor w `workout-finished-screen.tsx`) go używają. **Zakres implementacji w tym zadaniu dotyczy jednak tylko arkusza „Dodaj cardio”** (`createCardioLog`/`logCardioDetailedAction`) — zgodnie z zakresem zlecenia użytkownika i analizy (sekcja 2.2 analizy, „Nie wchodzi”). `updateCardioLogAction` (`actions/cardio.ts:172-300`) i edytor po treningu **nie są zmieniane w tym zadaniu**, ale ponieważ `validateCardioMetrics` jest już dziś wołane przez `updateCardioLogAction` (l. 198-205), **zmiana sygnatury tej funkcji (sekcja 2.1: `fieldErrors` zamiast `error: string`, limit minut 600 zamiast 1440) jest zmianą kontraktu, która automatycznie dotyka edycję wpisu, nawet bez zmiany UI edycji.** To wymaga:
- `updateCardioLogAction` musi się zaktualizować do nowego kształtu wyniku (`fieldErrors` zamiast pojedynczego `error`) **jako część implementacji tego zadania** (minimalna zmiana — zwrócenie pierwszego `fieldErrors[0].message` jako `error` zachowuje dzisiejszy UI edycji bez zmian wizualnych, jeśli `frontend` nie chce w tym zadaniu przebudowywać ekran edycji).
- Limit 600 min obowiązuje też przy edycji (konsekwencja jednego źródła prawdy) — jeśli istnieje historyczny wpis > 600 min, jego **edycja** (zmiana jakiegokolwiek pola, łącznie z minutami) może zacząć wymagać zmniejszenia minut do ≤600, żeby zapis się powiódł. To jest zamierzona konsekwencja (BR-5 „jedna walidacja”), do ujawnienia w changelogu i do potwierdzenia przez `tester`, że nie blokuje edycji **innych** pól bez zmiany minut (czyli: jeśli formularz edycji wysyła istniejące minuty niezmienione, a te przekraczają 600, trzeba zdecydować — blokować zapis całości, czy dopuścić „grandfathering” dla wartości niezmienionej). **Pytanie otwarte dla właściciela** (sekcja 5).

US-11 (pełna przebudowa UI edycji wg tego samego wzorca co arkusz) zostaje **poza zakresem** tego zadania — osobne zadanie, jeśli właściciel zdecyduje.

---

## 3. Android, Java, zmienne środowiskowe, prywatność

- **Android/WebView**: arkusz jest stroną webową renderowaną w WebView, bez osobnego kontraktu natywnego. `Grep` po `android/` nie znalazł odwołań do `validateCardioMetrics`/`CARDIO_INPUT_LIMITS` po nazwie (potwierdzenie z analizy, sekcja 14) — zero wpływu na kontrakt `/api/android/*`.
- **Java backend**: zero odwołań w `java-backend/` do reguł cardio (potwierdzenie z analizy). Zmiana zakresu minut (1440→600) i nowych reguł (max≥avg, wysiłek) żyje wyłącznie w TypeScript — `JAVA_API_BASE_URL` nie jest zaangażowane w ten moduł.
- **Zmienne środowiskowe**: brak nowych. Brak wpisu do `lib/admin-config-status.ts` — zmiana nie wprowadza żadnej konfiguracji zależnej od środowiska.
- **Dane wrażliwe**: tętno, kalorie, kroki, dystans to dane o ciele/zdrowiu — bez zmiany kategorii (denormalizacja/parsowanie tych samych pól, nie nowe pole). Komunikaty błędów (sekcja 2.1, 2.5) **nie zawierają** wartości wpisanej przez użytkownika w treści (np. nie „Tętno 5 bpm jest błędne”, tylko „Tętno musi mieścić się w zakresie 30–250 bpm” — zgodnie z dzisiejszym wzorcem w `validateCardioMetrics`, zachowany). Dotyczy to też `fieldErrors` — komunikat statyczny per pole, bez interpolacji wpisanej wartości, żeby nie trafiła do Sentry przy ewentualnym logowaniu stanu formularza.
- **`prawnik`**: bez zmiany oceny z etapu 1 analizy (pominięty) — redesign nie dodaje nowej kategorii danych, nie zmienia celu przetwarzania, nie wprowadza zgody.

---

## 4. Ryzyka (uzupełnienie do sekcji 13 analizy)

| Ryzyko | Prawdopodobieństwo / wpływ | Ograniczenie |
|---|---|---|
| Zmiana limitu minut (1440→600) blokuje zapis istniejących bardzo długich wpisów przy edycji (sekcja 2.10) | Niskie / średni | Pytanie otwarte do właściciela (sekcja 5); do czasu decyzji — blokować tylko gdy użytkownik *zmienia* minuty powyżej limitu, nie gdy zapisuje inne pole z niezmienionymi, historycznie poprawnymi minutami |
| Dwie definicje tygodnia pozostają w kodzie (świadomie, sekcja 2.3) — ryzyko, że przyszła zmiana w jednym miejscu nie zostanie odzwierciedlona w drugim | Średnie / średni | Jawne komentarze w obu plikach (`lib/cardio.ts`, `lib/cardio-hub.ts`) odsyłające do tego ADR i do rekomendacji ujednolicenia w przyszłym zadaniu |
| Nowa, mała funkcja agregująca tydzień pn-nd dla kafelka głównego (sekcja 2.4) dodaje jedno zapytanie SQL na stronie głównej | Niskie / niski | Zapytanie ograniczone do bieżącego tygodnia (7 dni), analogiczne kosztowo do istniejącego `getWeeklyCardioProgress`; `tester-wydajnosci` wchodzi na etapie 7 (decyzja analizy, warunek już spełniony przez tę decyzję) |
| Usunięcie automatycznego przekierowania po zapisie (2.7) zmienia przyzwyczajenie użytkowników | Wysokie / niski | Komunikat zmiany w changelogu; link „Zobacz wpis” zostaje dostępny jako akcja opcjonalna |
| Przeniesienie `resolveCardioLogDate` do `lib/cardio-utils.ts` (2.1) zmienia miejsce importu w `actions/cardio.ts` | Niskie / niski | Czysta przenosina bez zmiany logiki; `npx tsc --noEmit` wychwyci złamane importy |

---

## 5. Pytania otwarte dla właściciela produktu (nieblokujące ADR)

- **Q-C1 (z analizy, potwierdzone)**: zostać w kontekście po zapisie (rekomendacja architekta, sekcja 2.7) czy zachować przekierowanie na `/cardio/[id]`? Założenie robocze: zostać w kontekście.
- **Q-C2 (z analizy, potwierdzone)**: limit 600 min — zatwierdzenie zakresu. Założenie robocze: tak.
- **Q-C3 (z analizy, częściowo rozstrzygnięte architektonicznie)**: definicja tygodnia w arkuszu = pn-nd (rekomendacja architekta, sekcja 2.3), z jawną, tymczasową niezgodnością wobec kafelka głównego (rolling-7-dni) w tym samym zadaniu. Czy właściciel akceptuje tę niezgodność jako tymczasowy kompromis zakresu, czy wymaga ujednolicenia **teraz** (rozszerzając zadanie na `lib/cardio.ts`)?
- **Nowe Q-C6 (z tego ADR, sekcja 2.10)**: przy edycji istniejącego wpisu cardio z minutami > 600 (nowy limit), czy zapis innych pól bez zmiany minut ma być blokowany, czy dopuszczony („grandfathering” wartości historycznej)? Założenie robocze: dopuszczony (blokować tylko wtedy, gdy pole minut jest *zmieniane* powyżej limitu).
- **Nowe Q-C7 (z tego ADR, sekcja 2.10)**: zakres US-11 (pełna przebudowa UI edycji wg wzorca arkusza) — czy to osobne zadanie od razu po tym, czy odłożone bez terminu?

---

## 6. Kontrakt danych dla `ux` i przyszłej implementacji (podsumowanie)

- **Propsy `CardioLogSheet`**: `open`, `onClose`, `weekProgress: { minutesCompleted, goalMinutes, weekLabel }` (zamiast `cardioGoalMinutes: number`), `defaultTitle?`.
- **Wynik zapisu**: `{ ok: true; id; weekMinutesAfter } | { ok: false; error?; fieldErrors?: { field; message }[] }`.
- **Walidacja**: jedna funkcja `validateCardioMetrics` w `lib/cardio-utils.ts`, wołana identycznie klient (podgląd) i serwer (źródło prawdy); zero cichych zamian na `null`/wartość domyślną; `resolveCardioLogDate` przeniesione tam i zintegrowane z tym samym kontraktem błędów.
- **Limit minut**: `CARDIO_INPUT_LIMITS.minutesMax = 600`, jedna stała importowana przez klienta i serwer.
- **Nowa reguła**: max tętno ≥ śr. tętno (gdy oba podane); wysiłek 1-10 walidowany (dziś brak reguły).
- **Źródło postępu**: tydzień pn-nd (`lib/cardio-hub.ts`), dociągane przez propsy rodzica bez nowego zapytania w hubie; nowa, mała funkcja w `lib/cardio-hub.ts` dla kafelka głównego (tylko bieżący tydzień, bez historii 8 tygodni).
- **Stabilność efektu po zapisie**: `handledIdRef` w `CardioLogSheet`, zero automatycznego przekierowania.
- **Hierarchia UI (dla `ux`)**: minuty = sekcja nadrzędna zawsze widoczna; rodzaj + data pod nią; „Szczegóły (opcjonalne)” zwinięte z licznikiem wypełnionych pól; jedno zdanie o tym, co się liczy do celu.
- **Podział plików**: `cardio-log-sheet.tsx` (powłoka) + 4 nowe pliki w `components/treningi/` (sekcja 2.9).

---

## 7. Werdykt

**ZATWIERDZONE.** Wymagania z etapu 1 są wykonalne bez zmiany schematu bazy (A3 z analizy potwierdzone — wszystkie zmiany są w parsowaniu/walidacji/UI, nie w kolumnach `workouts`). F-13 jest potwierdzonym (nie tylko hipotetycznym) defektem architektonicznym z jasną przyczyną i naprawą (`handledIdRef`, sekcja 2.6). Definicja tygodnia cardio pozostaje świadomie podwójna w kodzie (poza zakresem tego zadania ujednolicenie `lib/cardio.ts`/`lib/cardio-hub.ts`) — arkusz dostaje jedną, kanoniczną definicję (pn-nd) niezależnie od miejsca otwarcia, z jawnym, tymczasowym rozjazdem wobec kafelka głównego do rozstrzygnięcia przez właściciela (Q-C3). Wejście dla `ux` (etap 4): makieta może zakładać kontrakt propsów i podział komponentu z sekcji 2.9/6.
