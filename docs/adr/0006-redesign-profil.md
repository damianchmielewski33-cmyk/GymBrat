# ADR 0006: Redesign ekranu Profil — struktura informacji, model zapisu, źródło wagi, makro posiłków

- Status: zaproponowany (etap 3 zadania 007)
- Data: 2026-10-25
- Autor: architekt
- Karta: `docs/zadania/007-redesign-profil.md`
- Wejście: `docs/analiza/007-redesign-profil.md` (T-1..T-14, R-1..R-13, F-1..F-20, US-1..US-10, BR-1..BR-11, NFR-1..NFR-9, P-1..P-5)
- Równolegle: `prawnik` ocenił P-4 (etap 2, `docs/prawo/006-redesign-profil-ocena-wejsciowa.md`, ZATWIERDZONE Z UWAGAMI) **przed** zamknięciem tego ADR. Werdykt: model `localStorage` nie wystarcza jako docelowy; zapis zgód na serwerze jest **warunkiem Promote** (LR-1), a wybór modelu danych należy do `architekt`. Ten ADR projektuje ten model (sekcja 9) — nie rozstrzyga natomiast treści prawnych (wersje tekstów, zakres eksportu/usunięcia, retencja), co zostaje u `prawnik`-człowieka przed Promote, zgodnie z sekcją 8 jego dokumentu.
- Next.js: zmiana dotyczy App Router — nowe segmenty tras pod `app/(dashboard)/profile/*`, `layout.tsx` współdzielony, Server Components do odczytu, Server Actions (`useActionState`) do zapisu, zgodnie z `node_modules/next/dist/docs/01-app/02-guides/forms.md` (wzorce: `useActionState`, `useFormStatus`, programatyczne `requestSubmit()` do „autozapisu” bez nowego mechanizmu). Brak zmian w cache segmentów, brak nowych route handlerów, brak zmian w `proxy.ts`.
- Zakres: brak implementacji w tym przebiegu. Deliverable to decyzje projektowe, kontrakty i lista zmian dla `ux` (etap 4) i przyszłych `backend`/`frontend` (etap 5, poza zakresem teraz).

---

## 0. Zasada nadrzędna

Zgodnie z A-2 analizy: **żadna funkcja z inwentarza F-1..F-20 nie znika.** Zmienia się układ (podział na podstrony), model zapisu, domyślne wartości formularza ciała i model „makro posiłków”. Nie zmienia się: kontrakt `/api/android/*`, logika kanałów przypomnień (alarmy natywne), strefa czasowa kalendarza (`Europe/Warsaw`), wzór kcal 4/4/9.

---

## 1. P-5 — forma nawigacji: podstrony zamiast jednej przewijanej strony

### Opcje rozważane

**A. Podstrony (osobne trasy) pod `app/(dashboard)/profile/*`, wspólny `layout.tsx` z nagłówkiem konta i zakładkami.**
Każda podstrona to własny Server Component, czyta tylko dane potrzebne do swojej sekcji. `/profile` staje się lekką stroną startową (przegląd stanu + odnośniki), nie kontenerem na 6 pełnych formularzy.

**B. Zakładki po stronie klienta w jednym widoku (`useState`, bez zmiany URL).**
Jedna trasa, jedno pobranie danych dla wszystkich sekcji na starcie (tak jak dziś), przełączanie zakładek wyłącznie w JS.

**C. Zostać przy jednej przewijanej stronie, tylko poprawić grupowanie i dodać sticky nav.**
Najmniejsza zmiana, ale nie rozwiązuje NFR-1 („cel cardio w ≤2 tapnięciach”), US-1, US-9 (telefon w przerwie treningu) — użytkownik wciąż przewija przez dietę, żeby dotrzeć do przypomnień.

### Decyzja: **Opcja A.**

Uzasadnienie:
- Dzisiejsza strona wykonuje 2 zapytania ładujące dane dla **wszystkich** 6 sekcji naraz (`page.tsx:48-79`), nawet gdy użytkownik chce zmienić jedno ustawienie. Podział na trasy pozwala każdej podstronie czytać tylko swój wycinek — to **zmniejsza**, nie zwiększa liczbę kolumn/zapytań na typowe wejście (zgodne z NFR-6, nie dodaje zapytań per sesję użytkownika, bo i tak odwiedza jedną sekcję na raz).
- Każda sekcja ma czysty adres (`/profile/przypomnienia` itd.) — można linkować z powiadomienia push, z Deploy Guardian, z innego ekranu („Ustaw plan” już dziś linkuje na `/profile/workout-plan`, które **zostaje bez zmian** — patrz sekcja 7, nie jest zagnieżdżane głębiej).
- Działa bez JS (prawdziwa nawigacja `<Link>`/`<a>`), więc F-20 („kotwice działające bez JS”) jest spełnione *lepiej* niż dziś — zamiast kotwic do sekcji na jednej stronie, są to pełne trasy z własnym tytułem.
- Zgodne z domyślnym stylem RSC tej wersji Next.js: dane i obliczenia po stronie serwera per segment, komponent kliencki tylko tam, gdzie jest interakcja (`forms.md`, patrz nagłówek ADR).
- Opcja B została odrzucona: nie rozwiązuje kosztu wczytania (wszystko ładowane na starcie), nie daje głębokich linków, a routing w App Router jest już naturalnym mechanizmem „zakładek” — duplikowanie go w JS byłoby niepotrzebną abstrakcją.
- Opcja C odrzucona: nie adresuje NFR-1/US-1/US-9, które są wymaganiami twardymi analizy.

### Kontrakt tras (do potwierdzenia przez `ux` co do treści, nie co do adresów)

Segmenty **zachowują identyfikatory** już używane w `PROFILE_SECTIONS` (`components/profile/profile-ui.tsx:10-17`) jako nazwy folderów — zero nowego mapowania nazw:

```
app/(dashboard)/profile/
  layout.tsx          — nagłówek konta (F-1, F-2) + zakładki (zamiast ProfileNav z kotwicami)
  page.tsx             — PRZEGLĄD: karty stanu + odnośniki do podstron (nowa zawartość, nie 1:1 ze starą)
  body/page.tsx         — „Ciało i dane” (F-3)
  training/page.tsx     — „Trening i postępy” (F-4, F-5, F-6, F-7)
  diet/page.tsx         — „Dieta” (F-8, F-9, F-10)
  reminders/page.tsx    — „Przypomnienia” (F-11)
  app/page.tsx          — „Aplikacja” (F-12, F-13)
  account/page.tsx      — „Konto i prywatność” (F-14..F-18)
  workout-plan/page.tsx — BEZ ZMIAN (istniejąca trasa, linkowana z 15+ miejsc w aplikacji — patrz sekcja 7)
```

`layout.tsx` pobiera **tylko** to, co potrzebne dla nagłówka (imię, e-mail, inicjały, `hasPassword` — do pokazania/skrycia zakładki „Konto” treści warunkowej nie trzeba, zakładka zawsze widoczna, warunek jest wewnątrz `account/page.tsx`) i wagę do `ProfileStat` (patrz sekcja 2). To są te same kolumny `users`, które dziś czyta `page.tsx:50-61` — żadne nowe zapytanie, tylko przeniesione o jeden poziom wyżej w drzewie layoutów.

Zakładki w `layout.tsx` używają `<Link>` + `usePathname()` do `aria-current="page"` (zamiast anchor-pills `ProfileNav`). Etykiety ujednolicone z tytułami sekcji (naprawia T-12: jedna lista etykiet, nie dwie).

### Przegląd (`/profile/page.tsx`) — zawartość

Zastępuje dzisiejszy „pasek 6 kotwic + 6 kart” krótką listą kart stanu, każda linkująca do podstrony:
- Ciało: waga/wzrost/wiek lub „Uzupełnij dane” gdy puste (US-3).
- Trening: „Plan: Siła 5×/tydz.” albo „Brak planu — ustaw” (rozwiązuje R-wymaganie z sekcji 6.6 „dodać podsumowanie stanu”); cel cardio.
- Dieta: cel dnia treningowego/nietreningowego + status sumy posiłków względem celu (R-3/P-2, sekcja 3).
- Przypomnienia: „2 z 3 włączone”.
- Aplikacja, Konto: bez stanu liczbowego — proste odnośniki.

To jest nowa, lekka strona — nie przenosi istniejącej logiki 1:1, więc wymaga od `ux` makiety treści kart stanu (etap 4) i od `backend` jednego zapytania zbiorczego z małym podzbiorem kolumn (nie całych JSON-ów celów, tylko tego, co trzeba do etykiety stanu — np. `hasAnyProfileGoals`, liczba aktywnych przypomnień).

---

## 2. P-1 — źródło prawdy o wadze

### Ustalenie dodatkowe (nieobecne w raporcie analityka, potwierdzone w kodzie)

`lib/body-reports.ts:270-279` (`createBodyReport`) **już dziś** wpisuje wagę z raportu sylwetki do `weight_logs` (z `notes: "raport sylwetki"`), żeby wykres na Start i w Analizie się odświeżał. To znaczy, że `weight_logs` jest **już faktycznie nadzbiorem** dwóch z trzech źródeł (ręczne wpisy wagi + raporty sylwetki). Brakuje w nim tylko trzeciego źródła: edycji wagi we formularzu „Ciało i dane” w Profilu, która dziś pisze wyłącznie do `users.weightKg` (`actions/profile.ts:68-80`) i nigdy do `weight_logs`.

To zawęża problem T-1 do jednego brakującego ogniwa, nie do trzech równoległych, niezależnych systemów.

### Opcje rozważane

**A. Nowa tabela/kolumny do śledzenia „skąd i kiedy” (np. `weight_logs.source`, migracja Drizzle).**
Pozwala pokazać dokładną etykietę pochodzenia („profil” / „raport sylwetki” / „wpis ręczny”).

**B. Bez zmiany schematu: `weight_logs` (po dociągnięciu edycji z Profilu) jako jedyne źródło „aktualnej wagi”, pokazywane z datą, bez etykiety pochodzenia.**
`users.weightKg` zostaje jako szybki, zdenormalizowany cache ostatniej wartości (bez zmiany kolumny), aktualizowany przy każdym zapisie do `weight_logs`, żeby miejsca czytające `users.weightKg` bez joina (np. kalkulacja kcal z cardio) dostawały świeżą wartość.

### Decyzja: **Opcja B.**

Uzasadnienie (zgodnie z A-1 analizy — bez zmiany schematu, jeśli możliwe):
- Pytanie z US-4 („skąd bierze się ta wartość”) w praktyce rozbija się na dwa osobne pytania: *„czy to aktualna wartość”* (rozwiązane przez samą datę) i *„czy edytowałem to ja, czy raport”* (kosmetyka, niskiego ryzyka — użytkownik sam wprowadzał obie wartości, to nie są dwa różne konta). Data wystarcza do odzyskania zaufania; etykieta pochodzenia jest „nice to have”, nie wymogiem bezpieczeństwa.
- Dodanie kolumny `source` wymaga migracji, zmiany 3 miejsc zapisu i backfill decyzji dla starych wierszy (NULL → co?) — koszt nieproporcjonalny do korzyści „dodatkowe słowo w UI”.
- Jeśli po wdrożeniu użytkownicy nadal będą zdezorientowani (feedback z `tester`/produkcji), dodanie `source` jest już zaprojektowane jako odwracalny dług (jedna nullable kolumna tekstowa, bez migracji istniejących wierszy — stare NULL = „wpis wagi”).

### Kontrakt: nowy resolver (bez zmiany schematu)

```ts
// lib/current-weight.ts (nowy plik; żadna istniejąca funkcja nie jest kopiowana, tylko konsolidowana)
export type CurrentWeight = { weightKg: number; recordedAt: Date };

export async function getCurrentWeightKg(userId: string): Promise<CurrentWeight | null> {
  // 1) najnowszy wiersz weight_logs (obejmuje: wpisy ręczne z Analizy, raporty sylwetki,
  //    i — po tej zmianie — edycje z Profilu).
  // 2) fallback: users.weightKg + users.createdAt, dla kont bez jeszcze żadnego wpisu
  //    (np. tylko onboarding, zero wizyt w Analizie/Profilu po rejestracji).
}
```

Konsekwencje dla istniejącego kodu:
- `actions/backend.ts` `getUser()` (linie 92-104) — `getLatestBodyReportMetrics` zastąpione `getCurrentWeightKg`. To **prostsze** niż dzisiejsza logika (jedno źródło zamiast specjalnego przypadku dla raportów) i usuwa duplikat „kto nadpisuje wagę” (naprawia T-1 w jednym miejscu, nie w trzech).
- `actions/profile.ts` `updateBodyParams` — przy zapisie wagi: jeśli podana wartość różni się od aktualnej z `getCurrentWeightKg`, wstawia nowy wiersz do `weight_logs` (bez `notes`, albo `notes: null`) **oraz** aktualizuje `users.weightKg` (write-through, jak dziś). Brak zmiany, gdy wartość jest identyczna — nie zapycha historii duplikatami przy każdym zapisie formularza (użytkownik edytuje imię, nie wagę).
- `components/profile/profile-ui.tsx` `ProfileStat` w nagłówku (nowy `layout.tsx`) i pole wagi w `body/page.tsx` czytają **tę samą** wartość z `getCurrentWeightKg` — koniec sprzeczności „— w nagłówku, 80 w formularzu” (naprawia T-2 częściowo, patrz sekcja 3 dla pełnej naprawy).
- `lib/progress-analysis.ts` i `lib/coach-context.ts` wołają `getLatestBodyReportMetrics` dla **pełnego** zestawu pomiarów ciała (obwody, nie tylko waga) — **nie zmieniać**, to inny przypadek użycia (metryki raportu, nie „aktualna waga”).
- BR-11 z analizy („zmiana wagi w profilu nie zmienia `weight_logs` i odwrotnie”) — **unieważniona tą decyzją**: teraz zmienia, w jedną stronę (profil → weight_logs), zgodnie z P-1.

### Prezentacja (wytyczna dla `ux`)

Karta stanu i pole formularza pokazują: `82,4 kg · 24.10.2026`. Gdy `recordedAt` jest dziś lub wczoraj — bez daty, tylko wartość (nie przeciążać informacją, kiedy jest oczywiście aktualna). Gdy brak jakiejkolwiek wagi — pusty placeholder, nie „—” w jednym miejscu i „80” w drugim (naprawa T-2, patrz dalej).

---

## 3. P-3 — wartości domyślne ciała

### Decyzja

Usunąć domyślne wartości `?? 80` / `?? 180` / `?? 25` z `body-params-form.tsx:75,86,97`. Pola puste pokazują `placeholder` (np. „np. 78”) i nie wysyłają wartości, jeśli użytkownik nie wpisał nic.

**Zapis częściowy, nie wszystko-albo-nic**: schemat w `actions/profile.ts` zmienia pola ciała (`weightKg`, `heightCm`, `age`) z wymaganych na opcjonalne — puste pole nie blokuje zapisu `firstName`/`lastName`/`activityLevel` i nie nadpisuje istniejącej wartości w bazie na `null`. Pole wypełnione i poprawne — zapisywane. Pole wypełnione i niepoprawne (poza zakresem 30-400 kg itd.) — błąd walidacji jak dziś, ale tylko dla tego pola (komunikat wskazuje które).

```ts
// actions/profile.ts — kontrakt (ilustracyjny, nie produkcyjny)
const bodyParamsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  weightKg: z.coerce.number().min(30).max(400).optional(), // "" -> undefined, nie 0/NaN
  heightCm: z.coerce.number().int().min(100).max(250).optional(),
  age: z.coerce.number().int().min(13).max(120).optional(),
  sex: z.enum(["male", "female", ""]).optional(),
  activityLevel: z.enum(activityLevels),
});
```

`db.update(users).set({...})` budowany tak, by pola `undefined` **nie wchodziły** do `set()` (nie nadpisują na `null`) — ten fragment to decyzja implementacyjna dla `backend`, nie zmiana typu kolumny.

To rozwiązuje US-3 w całości (dane givena/when/then) i kasuje T-2: nagłówek i formularz czytają teraz tę samą wartość (`null` → placeholder/„—” w obu miejscach, nigdy 80/180/25).

Zakres wagi: ujednolicić 30-400 (profil) vs 1-600 (`actions/weight.ts:28`, wpis ręczny) — przyjąć **jeden wspólny zakres 1-400 kg** w obu miejscach (niższy dolny limit niż 30, bo wpis wagi używany też przez młodzież/osoby o niskiej masie; górny z profilu, bo 600 kg jest nierealistyczne i niepotrzebnie szerokie). Drobna poprawka, do zrobienia przy implementacji (T-13).

**LR-10 (osoby 16-17 lat, ocena prawnika)**: `age` jest już dostępny po stronie serwera przy każdym odczycie `/profile/diet` (ta sama kolumna `users.age` czytana dla nagłówka). Architektura przewiduje tę ścieżkę bez nowego zapytania: `diet/page.tsx` (RSC) przekazuje `isMinorAccount: age != null && age < 18` jako prop do `NutritionPlanSection`/widoku celów; komponent renderuje stałe ostrzeżenie (treść do `ux`/`prawnik`, nie ustalana tutaj) przy celach z deficytem kalorycznym, zamiast dodawać osobną logikę wieku w każdym miejscu, które pokazuje cele. Brak wartości `age` (konto bez uzupełnionych danych) → ostrzeżenie nie jest pokazywane (nie da się ocenić), zgodnie z zasadą „nie zgaduj”.

---

## 4. P-2 — makro posiłków a cele dnia

### Ustalenie

Problem nie jest arytmetyczny (analiza to potwierdza) — jest strukturalny: `mealTemplatesJson` to **jeden** zestaw 5 posiłków, bez pojęcia „dzień treningowy/nietreningowy”, podczas gdy cele dnia (`trainingNutritionGoalsJson`/`restNutritionGoalsJson`) już mają dwa zestawy. Posiłki i cele nie mogą się zgadzać, bo nie są tym samym kształtem danych.

### Opcje rozważane

**A. Dwa zestawy posiłków (trening/rest), ta sama logika co cele dnia. Reshape istniejącego JSON, bez nowej kolumny.**
`mealTemplatesJson` (kolumna `userSettings.mealTemplatesJson`, bez zmiany DDL) zmienia **kształt** przechowywanej treści z `MealTemplate[5]` na `{ training: MealTemplate[5]; rest: MealTemplate[5] }`.

**B. Nowa kolumna `mealTemplatesRestJson` osobno od `mealTemplatesJson` (trening).**
Dwie kolumny, migracja Drizzle.

**C. Zostaje jeden zestaw; tylko dodać widoczne ostrzeżenie o rozjeździe, bez podziału na typ dnia.**
Najmniejsza zmiana, ale nie rozwiązuje źródła problemu — użytkownik wciąż nie może mieć różnych posiłków na dzień treningowy i wolny (co wynika z samej logiki istnienia dwóch zestawów celów).

### Decyzja: **Opcja A.**

Uzasadnienie: identyczny wzorzec do tego, który już istnieje dla celów (`NutritionSettingsState.training`/`.rest`) — nie wprowadza nowej koncepcji, tylko rozszerza istniejącą na drugi model danych tej samej sekcji. Zero DDL (zgodne z A-1): to jest zmiana **kształtu JSON** w istniejącej kolumnie tekstowej, nie zmiana schematu tabeli.

**Kompatybilność wsteczna** (krytyczne — dziś zapisane dane to płaski `MealTemplate[5]`):

```ts
// lib/meal-templates.ts — kontrakt rozszerzony
export type MealTemplatesByDayType = {
  training: MealTemplate[]; // zawsze 5, znormalizowane jak dziś
  rest: MealTemplate[];
};

export function mealTemplatesForProfile(raw: string | null | undefined): MealTemplatesByDayType {
  const parsed = JSON.parse(raw ?? "null");
  if (Array.isArray(parsed)) {
    // Format legacy (sprzed tej zmiany): jeden zestaw -> kopiowany do obu typów dnia,
    // żeby istniejący użytkownicy nie stracili danych i nie zobaczyli pustych posiłków.
    const legacy = normalizeMealTemplates(/* ... */);
    return { training: legacy, rest: legacy };
  }
  // Format nowy: { training, rest } — parsowane niezależnie, fallback do emptyMealTemplate per slot.
}
```

Przy pierwszym zapisie po redesignie dane są już serializowane w nowym kształcie — migracja jest leniwa (przy odczycie), bez skryptu migrującego dane w bazie.

**Konsumenci wymagający zmiany kontraktu** (potwierdzone wyszukiwaniem w analizie, sekcja 2.2): `components/meal-suggestions/meal-suggestions-page-content.tsx:100`, `components/home/home-today-page-content.tsx`, `app/(dashboard)/supplements/page.tsx`. Każdy musi: ustalić typ dnia dla żądanej daty (ten sam resolver co `resolveProfileDayGoals` w `lib/nutrition-goals.ts:92-111`, czyli `dayTypes[dateKey] ?? "rest"`) i wybrać `training` albo `rest` z `MealTemplatesByDayType` zamiast płaskiej tablicy. To jest zmiana kontraktu wymagająca uwagi `backend` przy implementacji — nie przegląd architekta po fakcie, bo jest przewidziana już tutaj.

### Tolerancja i ostrzeżenie (odpowiedź na „czy suma ma się mieścić w celu”)

Suma posiłków **nie jest wymuszana** do celu (nie blokujemy zapisu, nie przeskalowujemy automatycznie gramów — to należałoby do osobnego zadania „kalkulator posiłków”, poza zakresem redesignu profilu). Pokazujemy różnicę i miękkie ostrzeżenie:

```ts
export const MEAL_SUM_TOLERANCE_PCT = 10; // jedna stała, jedno miejsce (lib/kcal-from-macros.ts)
```

- `|suma − cel| / cel > 10%` → widoczny komunikat „Suma posiłków (2812 kcal) jest o 762 kcal (37%) wyższa niż cel dnia treningowego (2050 kcal)” z odnośnikiem do bloku „Cele dzienne” na tej samej podstronie (nie do pozycji w layoucie — naprawia T-7).
- Brak ustawionego celu dla danego typu dnia → komunikat „Ustaw cel dnia, aby zobaczyć porównanie” (US-2, given/when/then „brak celu dnia”), zero liczby do porównania.
- Próg `10%` jest świadomie szerszy niż `MACRO_TOLERANCE_PP = 5` z ADR 0005 (tam to punkty procentowe na poziomie jednego dnia rzeczywistego spożycia; tutaj to porównanie *planu* posiłków z *celem*, z natury bardziej orientacyjne) — osobna stała, nie współdzielona z bilansem makro.

---

## 5. Jeden model zapisu (R-6, T-5, T-9/T-10 — przygotowanie na P-4)

### Decyzja

Jeden wzorzec dla **wszystkich** bloków zapisu w Profilu, zastępujący 6 niezależnych modeli (SubmitButton×3, Button×2 bez spinnera, autozapis×2, localStorage×1):

```tsx
// components/profile/profile-save-block.tsx (nowy, współdzielony komponent — nie kopiowany per sekcja)
"use client";
type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export function ProfileSaveBlock<T>({
  action,            // Server Action zgodna z useActionState: (prev, payload) => Promise<SaveResult>
  autoSubmitOnChange,// true dla "przełącznik od razu" (jednostka porównań, zgody, dni tygodnia)
  children,          // pola formularza — bez zmian w logice pól, tylko w otoczce zapisu
}: ProfileSaveBlockProps<T>) {
  // useActionState + status "Zapisano HH:MM" / "Niezapisane zmiany" / baner błędu.
  // Dla autoSubmitOnChange: po zmianie pola wywołuje formRef.current?.requestSubmit()
  // (wzorzec z node_modules/next/dist/docs/01-app/02-guides/forms.md, "Programmatic form submission") —
  // to samo API co przycisk "Zapisz", bez drugiego mechanizmu zapisu.
}
```

Konsekwencje:
- `progress-delta-unit-picker.tsx` (dziś: fetch bezpośrednio po kliknięciu) i `reminders-card.tsx` toggles — przechodzą na `ProfileSaveBlock` z `autoSubmitOnChange`, zachowując „działa od razu”, ale przez tę samą rurkę co pozostałe sekcje (koniec T-5).
- `ConsentSettingsCard` jest zaprojektowany tak, by `action` przekazana do `ProfileSaveBlock` mogła być albo lokalną funkcją nad `localStorage`, albo Server Action nad serwerowym zapisem — JSX i wizualna strona bloku nie zmieniają się między tymi dwoma wariantami. `prawnik` (etap 2) już zdecydował, że wariant docelowy to zapis serwerowy (warunek Promote) — model i `action` są zaprojektowane w sekcji 9. To jest odpowiedź na wymóg „przeniesienie zgód na serwer możliwe bez przebudowy ekranu” — i zarazem dowód, że ta architektura realnie to umożliwia, nie tylko w teorii.
- Status „Zapisano/Niezapisane zmiany” (US-7) pochodzi z jednego miejsca — nie z sześciu różnych implementacji toastów.
- `SubmitButton` (istniejący, `components/ui/...` — współdzielony) zostaje używany **wewnątrz** `ProfileSaveBlock` jako jedyny przycisk zapisu, zamiast luźnego `Button` w dwóch miejscach (`nutrition-plan-section.tsx:274`, `meal-templates-form.tsx:163`).

### T-4 — walidacja kcal po stronie serwera (ujednolicenie, nie nowy wzorzec)

`actions/meal-quick.ts` (`saveMealTemplatesAction`, linie 144-168) przestaje ufać `calories` z klienta — przelicza `kcalFromMacros(proteinG, fatG, carbsG)` tak jak `actions/nutrition-settings.ts:71`. Jeden wzorzec: **serwer zawsze przelicza kcal z gramów przy zapisie**, klient liczy je tylko do podglądu.

### T-8/T-9/BR-10 — synchronizacja i konflikt dwóch urządzeń

1. **T-8 (brak resync po zapisie)**: `NutritionPlanSection` dostaje ten sam `useEffect` synchronizujący stan z propsami po `router.refresh()`, jaki już ma `MealTemplatesForm` (`:51-53`) — kopiowanie **istniejącego, działającego** wzorca, nie nowa koncepcja.
2. **T-9/BR-10 (nadpisanie między urządzeniami)**: `userSettings.updatedAt` **już istnieje** w schemacie (`db/schema.ts`) — zero zmiany DDL. Formularz celów/kalendarza przenosi `expectedUpdatedAt` (ISO string wczytany przy otwarciu podstrony) jako skryte pole. `saveNutritionPlanAction` i `saveMealTemplatesAction` porównują je z aktualnym `userSettings.updatedAt` w bazie przed zapisem:
   - zgodne → zapis, nowy `updatedAt`, `revalidatePath`.
   - niezgodne → `{ ok: false, error: "conflict" }`, UI (US-10) pokazuje „Te ustawienia zmieniono z innego urządzenia — wczytaj najnowsze dane” z przyciskiem odświeżenia, zamiast cichego nadpisania.
   Ten sam mechanizm (porównanie `updatedAt`) stosowany konsekwentnie w obu akcjach JSON-owych tej sekcji — nie tylko w jednej.

---

## 6. Rozróżnienie: edytowalne / wyliczone / systemowe (US-6, sekcja 4 analizy)

Nie tylko styl — trzy różne komponenty prezentacyjne o jasnych nazwach, żeby `frontend` nie mieszał semantyki:

- `ProfileField` (istniejący) — pole edytowalne, zawsze z `<label>` i kontrolką.
- Nowy `ProfileComputedValue` — wartość wyliczona (kcal z makro, suma dnia, % rozjazdu z celem). Wizualnie: bez obramowania pola input, etykieta „wyliczone” lub ikona, nigdy w stylu edytowalnego pola. Zastępuje dzisiejsze pokazywanie kcal w tym samym stylu co pola B/W/T (`nutrition-plan-section.tsx`, `meal-templates-form.tsx:101-111`).
- Nowy `ProfileSystemState` — stan systemowy nieedytowalny bezpośrednio (kanał przypomnień: push/alarm natywny/brak; stan zgody „ostatnia decyzja: …”). Wizualnie: chip/badge, nie switch, nie pole.

To są 2 nowe, małe, czysto prezentacyjne komponenty w `components/profile/profile-ui.tsx` (rozszerzenie istniejącego pliku wspólnych klocków, nie nowy plik per typ) — zgodne z regułą „jeden komponent w jednym katalogu”.

---

## 7. Lista komponentów do konsolidacji (T-6, odpowiedź wymagana przez zadanie)

| Duplikat dziś | Docelowo |
|---|---|
| Switch ręczny w `reminders-card.tsx:212-233` | `ProfileSwitch` (już istnieje, `profile-ui.tsx:153-199`) |
| Chipy: `profile-goal-form.tsx:43-60`, `report-cadence-form.tsx:45-62`, dni tygodnia `reminders-card.tsx:245-265` | Nowy `ProfileChipGroup` (`profile-ui.tsx`), jeden wariant z `aria-pressed` |
| `parseMacroGrams` (`lib/kcal-from-macros.ts`) vs `gramsForKcal` (`nutrition-plan-section.tsx:20`) vs `parseGrams` (`meal-templates-form.tsx:40`) | Jedna funkcja `parseMacroGrams` z `lib/kcal-from-macros.ts`, dwie kopie usunięte |
| `kcalStringFromMacros`/`parseGoalsPayload` (`nutrition-plan-section.tsx:27-63`) | Wywołania `kcalFromMacros` bezpośrednio, bez powielania wzoru |
| 6 niezależnych modeli zapisu | `ProfileSaveBlock` (sekcja 5) |
| `ProfileNav` (kotwice) | Zakładki w `layout.tsx` (sekcja 1) |

---

## 8. Co NIE zmieniamy (ryzyka do ochrony)

- **NFR-8 Android/Java**: `AndroidAppVersionCard`, kanały przypomnień (alarmy natywne) i `/api/android/*` — bez zmian kontraktu. Przeniesienie `RemindersCard` na `/profile/reminders` to tylko zmiana adresu strony, nie logiki powiadomień.
- **Strefa czasowa kalendarza** (`Europe/Warsaw`, `lib/local-date.ts`) — bez zmian (A-3 analizy, T-14).
- **Wzór kcal 4/4/9** (`lib/kcal-from-macros.ts`) — jedyna definicja, bez zmiany wzoru, tylko konsolidacja wywołań.
- **`/profile/workout-plan`** — trasa linkowana z ok. 15 miejsc w aplikacji (Start, Treningi, import planu, edytor planu) — zostaje pod tym samym adresem, niezależnie od reszty redesignu.
- **Usunięcie konta** (fraza „USUŃ”, `personal-data-card.tsx:86`) i eksport danych — logika bez zmian, tylko przeniesienie do `/profile/account` z wyraźnym wizualnym oddzieleniem „strefy niebezpiecznej” od eksportu (US-8, do makiety `ux`).
- **Zgody RODO (P-4)** — `prawnik` już zdecydował (etap 2): zapis lokalny nie wystarcza, model serwerowy jest warunkiem Promote. Model danych zaprojektowany w sekcji 9; treści prawne (LR-4, LR-6, LR-7, LR-9) i decyzja o wariancie awaryjnym z jego dokumentu (sekcja 2.3) zostają u `prawnik`-człowieka, nie u `architekt`.

---

## 9. Zapis zgód po stronie serwera (LR-1 — wymóg prawnika przed Promote)

### Kontekst

`prawnik` (etap 2) ustalił, że `localStorage` (`lib/consent-preferences.ts`) nie jest wystarczającym dowodem zgody (art. 7 ust. 1 RODO) i że zapis serwerowy jest **warunkiem Promote** dla części „Konto i prywatność”, z wyborem modelu danych należącym do `architekt`. To jedyny punkt tego ADR, w którym świadomie łamię A-1 (bez zmiany schematu) — uzasadnienie: wymóg nie jest moją preferencją architektoniczną, jest warunkiem bramki `prawnik`, która już zapadła.

### Opcje rozważane

**A. Jedna tabela append-only `user_consents`, jeden wiersz per decyzja (nie per aktualny stan).**
Historia, nie nadpisywany rekord — każda zmiana zgody to nowy wiersz; „aktualny stan” to najnowszy wiersz per `(userId, type)`.

**B. Kolumny zgód bezpośrednio w `user_settings` (np. `consentAnalytics`, `consentMarketing` jako booleany + `consentUpdatedAt`).**
Najmniej nowych obiektów (brak nowej tabeli), ale nadpisuje historię — nie da się wykazać *poprzednich* decyzji ani wersji tekstu, na którą użytkownik się zgodził w przeszłości. Odrzucone: to właśnie **ten** problem (brak dowodu, brak wersjonowania — ryzyka R-1/LR-1 z oceny prawnika) ma rozwiązać ta zmiana; rozwiązanie, które go nie rozwiązuje, nie spełnia warunku bramki.

### Decyzja: **Opcja A.**

```ts
// db/schema.ts — nowa tabela, addytywna, nie zmienia istniejących tabel
export const userConsents = sqliteTable(
  "user_consents",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** "analytics" | "marketing" — przyszłe "health" | "photos" to już nowa zgoda art. 9, poza zakresem (LR-2). */
    type: text("type").notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull(),
    /** Wersja treści zgody widzianej przez użytkownika (LR-1, LR-12) — np. "2026-10-v1". */
    textVersion: text("text_version").notNull(),
    /** "banner" | "profile" | "android_bridge" — skąd przyszła decyzja. */
    source: text("source").notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("user_consents_user_type_decided").on(t.userId, t.type, t.decidedAt)],
);
```

- **Append-only**: `saveConsentAction(type, granted)` zawsze robi `INSERT`, nigdy `UPDATE` — historia jest dowodem (art. 7 ust. 1), a „aktualny stan” to zapytanie `ORDER BY decidedAt DESC LIMIT 1` per typ (funkcja `getCurrentConsents(userId)` w nowym `lib/consents.ts`).
- **`localStorage` zostaje jako cache pierwszego renderu** (dozwolone przez `prawnik`, sekcja 2.3 jego dokumentu: „nie jest dowodem”, ale może przyspieszać wyświetlenie stanu przed hydracją) — `ConsentSettingsCard` czyta serwer przy montażu (RSC przekazuje initial przez props jak inne sekcje) i tylko **zapisuje** przez `saveConsentAction`, nie przez `writeConsentPreferences` do localStorage jako jedyne źródło.
- **Integracja z `ProfileSaveBlock`** (sekcja 5): `action={saveConsentAction.bind(null, "analytics")}`, `autoSubmitOnChange`. To jest właśnie ten punkt rozszerzenia, który sekcja 5 przewidywała — żadna przebudowa JSX, tylko podłączenie prawdziwej akcji.
- **Bramka po stronie serwera dla PostHog** (R-2 z oceny prawnika, backlog pozycja 7: analityka serwerowa dziś nie sprawdza zgody) — **poza zakresem tego ADR** (to zmiana w `lib/analytics/track.ts`, nie w ekranie Profil), ale jest zależnością blokującą Promote według `prawnik`; odnotowane jako zależność w sekcji 11, nie projektowane tutaj.
- **Migracja**: jedna tabela, bez backfill (brak istniejących zgód serwerowych do przeniesienia) — pierwsza wizyta w nowym Profilu po wdrożeniu zapisuje wiersz na podstawie dzisiejszego stanu `localStorage`, jeśli istnieje (żeby nie zmuszać do ponownej decyzji), albo czeka na pierwszą interakcję.
- **Wariant awaryjny z oceny prawnika (sekcja 2.3)**: jeśli właściciel zdecyduje wdrożyć redesign *przed* tą tabelą, architektura z sekcji 5 (`ProfileSaveBlock` z `action` wskazującą na `localStorage`) nadal działa — różnica jest tylko w tym, która implementacja `action` jest podłączona. To nie zmienia decyzji tego ADR, tylko potwierdza, że jest odwracalna bez przebudowy ekranu.

---

## 10. Konsekwencje i zmiany do wdrożenia (gdy właściciel zdecyduje o implementacji)

**Routing / strony**
- Nowe: `app/(dashboard)/profile/layout.tsx`, `.../page.tsx` (przegląd, przebudowany), `.../body/page.tsx`, `.../training/page.tsx`, `.../diet/page.tsx`, `.../reminders/page.tsx`, `.../app/page.tsx`, `.../account/page.tsx`.
- Bez zmian: `app/(dashboard)/profile/workout-plan/page.tsx` i wszystko co do niego linkuje.

**db/schema.ts**
- Nowa tabela `userConsents` (sekcja 9) — jedyna zmiana DDL w tym zadaniu, migracja Drizzle addytywna (nowa tabela, brak zmian istniejących).

**lib/**
- `lib/current-weight.ts` (nowy) — `getCurrentWeightKg`.
- `lib/consents.ts` (nowy) — `getCurrentConsents(userId)`, typy `ConsentType`, `CURRENT_CONSENT_TEXT_VERSION`.
- `lib/meal-templates.ts` — `MealTemplatesByDayType`, reshape `mealTemplatesForProfile`, parser kompatybilny wstecz z formatem legacy (tablica).
- `lib/kcal-from-macros.ts` — dodać `MEAL_SUM_TOLERANCE_PCT`; pozostaje jedynym miejscem `kcalFromMacros`/`parseMacroGrams`.
- `lib/nutrition-goals.ts` — bez zmiany kontraktu publicznego (`resolveProfileDayGoals` itd.), tylko konsumenci (sekcja 4) dostają nowy sposób wyboru zestawu posiłków.

**actions/**
- `actions/backend.ts` `getUser()` — `getLatestBodyReportMetrics` → `getCurrentWeightKg`.
- `actions/profile.ts` `updateBodyParams` — pola ciała opcjonalne, zapis częściowy, insert do `weight_logs` przy zmianie wagi.
- `actions/weight.ts` — zakres walidacji 1-400 kg (ujednolicenie z profilem).
- `actions/nutrition-settings.ts`, `actions/meal-quick.ts` — `expectedUpdatedAt` (konflikt), serwerowe przeliczenie kcal w `meal-quick.ts` (T-4), nowy kształt `MealTemplatesByDayType` w `saveMealTemplatesAction`.
- `actions/consents.ts` (nowy) — `saveConsentAction(type, formData)` zgodnie z kontraktem `useActionState` (sekcja 9), zawsze `INSERT` do `userConsents`.

**components/profile/**
- Nowe: `profile-save-block.tsx`, `profile-chip-group.tsx`; rozszerzenie `profile-ui.tsx` o `ProfileComputedValue`, `ProfileSystemState`.
- Zmiana: `reminders-card.tsx` (switch + chipy → wspólne komponenty + `ProfileSaveBlock`), `nutrition-plan-section.tsx` (resync stanu, usunięcie zduplikowanych parserów, `ProfileSaveBlock`), `meal-templates-form.tsx` (podział training/rest, usunięcie `parseGrams`), `profile-goal-form.tsx`/`report-cadence-form.tsx`/`progress-delta-unit-picker.tsx` (na `ProfileSaveBlock`/`ProfileChipGroup`), `body-params-form.tsx` (puste pola, placeholdery).
- `consent-settings-card.tsx` — przechodzi na `ProfileSaveBlock` + `saveConsentAction` (sekcja 9), inicjalny stan z `getCurrentConsents` przekazany jako prop z RSC zamiast wyłącznie z `localStorage`.

**Zależność poza zakresem tego ADR (blokująca Promote według `prawnik`, nie blokująca etapów 3-4)**
- `lib/analytics/track.ts` — bramka zgody po stronie serwera dla PostHog (backlog pozycja 7 z oceny prawnika). Osobne zadanie; ten ADR tylko dostarcza źródło prawdy (`getCurrentConsents`), z którego ta bramka będzie korzystać.

**Testy** (dla `backend`/`frontend`, weryfikacja przez `tester`)
- `getCurrentWeightKg`: brak wpisów → fallback `users`; wpis w `weight_logs` nowszy niż `users.weightKg` → wygrywa wpis; zapis z Profilu przy niezmienionej wadze → brak nowego wiersza.
- `mealTemplatesForProfile`: format legacy (tablica) → kopiowany do `training` i `rest`; format nowy → parsowany niezależnie.
- Konflikt `expectedUpdatedAt`: zapis z przestarzałym znacznikiem → `{ ok: false, error: "conflict" }`, baza niezmieniona.
- `saveMealTemplatesAction`: `calories` z klienta różne od przeliczonych z gramów → serwer zapisuje przeliczoną wartość, nie sfałszowaną.
- Zapis częściowy ciała: puste pole wagi + wypełnione imię → waga w bazie bez zmian, imię zapisane.

**Changelog / konfiguracja**
- Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR (żadna zmiana zmiennych środowiskowych — brak wpisu w `lib/admin-config-status.ts`).

---

## 11. Ryzyka i dług świadomie odłożony

| Ryzyko | Decyzja |
|---|---|
| Brak etykiety „skąd pochodzi waga” (tylko data) może nie w pełni rozwiązać US-4 dla części użytkowników | Zaakceptowane na ten etap (opcja B, sekcja 2); kolumna `weight_logs.source` jako udokumentowany, odwracalny dług, jeśli feedback pokaże potrzebę. |
| Reshape `mealTemplatesJson` wymaga, by **wszyscy** trzej konsumenci (`meal-suggestions`, `home-today`, `supplements`) zmienili sposób odczytu jednocześnie z zapisem | Sekcja 4 wymienia je explicite; `backend` musi zmienić zapis i odczyt w jednym PR, inaczej stare dane (tablica) i nowy odczyt (obiekt) się rozjedą — parser legacy w `mealTemplatesForProfile` to zabezpieczenie na czas przejścia. |
| Przejście z jednej strony na 6+1 podstron zwiększa liczbę plików i może na chwilę zdublować kod podczas migracji | Migrować sekcja po sekcji (każda `ProfileSection` → osobny PR/commit), stary `page.tsx` usuwany na końcu, nie na początku — mniejsze PR-y, łatwiejszy review. |
| `ProfileSaveBlock` jako nowa, centralna abstrakcja — błąd w niej wpływa na wszystkie sekcje | Pokryć testem jednostkowym niezależnie od konkretnej sekcji (stan `ok`/`error`/`pending`/dirty-tracking) przed podłączeniem do pierwszej sekcji. |
| Konflikt `expectedUpdatedAt` dodaje nowy stan UI („ktoś zmienił z innego urządzenia”) nieistniejący dziś | Niskie ryzyko (rzadki przypadek), ale `ux` musi zaprojektować komunikat (etap 4) — nie zostawiać generycznego błędu. |
| `userConsents` (sekcja 9) jest jedyną zmianą DDL w tym zadaniu, wbrew ogólnej zasadzie A-1 | Zaakceptowane: nie jest decyzją architektoniczną „na wszelki wypadek”, jest warunkiem bramki `prawnik` (LR-1), która już zapadła na etapie 2. Migracja jest addytywna i izolowana (jedna nowa tabela, zero zmian istniejących). |
| Bramka serwerowa dla PostHog (poza zakresem tego ADR) jest warunkiem Promote wg `prawnik`, ale nie jest tu projektowana | Odnotowane jako zależność międzyzadaniowa w sekcji 10; `tester-bezpieczenstwa` powinien to sprawdzić przy implementacji zgód, nie przy samym redesignie layoutu. |

---

## 12. Wytyczne dla `ux` (etap 4)

1. Makieta `/profile` (przegląd): karty stanu wymienione w sekcji 1, mobile-first 360/390/430 px.
2. Makiety 6 podstron — każda jako samodzielny ekran z własnym tytułem (nagłówek `AppPageHeader` jak dziś), nie „karta w karcie”.
3. Wizualny język dla trzech kategorii z sekcji 6: edytowalne / wyliczone / systemowe — co najmniej inny kontener, nie tylko kolor tekstu.
4. Mikrokopia ostrzeżenia makro (sekcja 4) i konfliktu zapisu (sekcja 5/10) — prosty, niealarmistyczny ton (to nie błąd użytkownika).
5. „Strefa niebezpieczna” w `/profile/account` — wyraźny separator wizualny między eksportem i usunięciem konta (US-8).
6. Status „Zapisano HH:MM” / „Niezapisane zmiany” (`ProfileSaveBlock`) — jeden wzorzec mikrokopii dla wszystkich sekcji.
7. Bez żargonu w hintach („Keytel”, „VAPID” — przeformułować prostym językiem, NFR-9).

---

## 13. Werdykt etapu 3

**ZATWIERDZONE.**

Architektura jest ewolucyjna: P-1 i P-2 rozwiązane przeshapowaniem istniejących kolumn JSON i nowym resolverem na istniejących tabelach (zero DDL), zero nowych usług zewnętrznych, zero zmiany kontraktu Android/Java, jeden nowy wzorzec zapisu zamiast sześciu. Jedyna zmiana schematu (`userConsents`, sekcja 9) nie jest wyborem architektonicznym „na wszelki wypadek” — jest warunkiem bramki `prawnik`, która zapadła na etapie 2 przed zamknięciem tego ADR, i jest addytywna (nowa tabela, zero zmian istniejących). Największa zmiana strukturalna — podział na podstrony — jest uzasadniona policzalnie (NFR-6: mniej danych ładowanych per wejście, nie więcej) i nie koliduje z żadną z ok. 15 istniejących tras linkujących do `/profile/workout-plan`.

Decyzje P-1, P-2, P-3, P-5 są rozstrzygnięte w tym dokumencie. P-4 (treść zgód, warunki Promote, wariant awaryjny) pozostaje u `prawnik`-człowieka, zgodnie z sekcją 8 jego oceny — ten ADR dostarcza tylko model danych i punkt integracji (`ProfileSaveBlock` + `userConsents`/`saveConsentAction`), wymagany przez LR-1, tak by decyzja prawna nie wymagała ponownego ADR-u na przebudowę ekranu.

Blokujące przed etapem `ux`: brak. Uwagi do backlogu (niskiego ryzyka): etykieta pochodzenia wagi (`weight_logs.source`, odłożone), zakres wagi 1-400 kg do ujednolicenia przy implementacji (T-13), żargon w hintach (T-7 pokrewne, NFR-9) — do `ux`/`frontend` przy pisaniu treści.
