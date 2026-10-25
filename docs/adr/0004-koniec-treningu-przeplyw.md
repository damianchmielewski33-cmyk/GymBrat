# ADR 0004: Koniec treningu — idempotentny zapis, patch cardio, scalenie trzech ścieżek zakończenia w jeden ekran

- Status: zaproponowany (etap 3 zadania 005)
- Data: 2026-10-25
- Autor: architekt
- Karta: `docs/zadania/005-koniec-treningu-przeplyw.md` (p. 1-8, decyzje właściciela p. 7-8)
- Wejście: `docs/analiza/005-koniec-treningu-przeplyw.md` (P1-P10, F-1..F-3, Q1-Q5, BR-1..BR-10, R-1..R-11), `docs/prawo/005-koniec-treningu-przeplyw-wejscie.md` (LR-1..LR-8, szczególnie LR-3 i LR-4 — wymagane przed merge)
- Równolegle: `docs/ux/005-...` (mikrokopia, wygląd ekranu „Trening zakończony”, dialogu, stanu zapisu). Ten ADR ustala kontrakty danych, miejsce logiki i podział plików, nie ustala wyglądu.
- Next.js: zmiana dotyczy route handlera (`app/api/workouts/complete/route.ts`), nowego route handlera PATCH, komponentów klienckich (`"use client"`) i czystych funkcji `lib/`. Nie zmienia `proxy.ts`, RSC cache ani segment config — przewodniki frameworka nie mają tu zastosowania poza standardowym użyciem `NextResponse`/`revalidatePath`, już stosowanym w repo.

## 0. Podsumowanie — pliki do zmiany (dla podziału pracy backend/frontend)

**Backend (Next.js route handlery, Drizzle, lib bez `"use client"`)**
- `db/schema.ts` — nowa kolumna `operationId` w `workouts` (+ unikalny indeks `(userId, operationId)`).
- `db/migrations/0033_workout_operation_id.sql` (+ wpis w `db/migrations/meta/_journal.json` przez `npm run db:generate`) — migracja.
- `app/api/workouts/complete/route.ts` — klucz idempotencji (`operationId`), zwracanie `workoutId`, wykrywanie duplikatu.
- `app/api/workouts/[workoutId]/cardio/route.ts` (nowy) — PATCH cardio, autoryzacja właściciela, wartości absolutne, 0 min = usunięcie, jedna transakcja na `cardioMinutes` + `exercises.cardio`.
- `lib/workout-plan-compare.ts` — nowa funkcja `patchCardioInCompletedSessionJson` (aktualizacja obiektu `cardio` w JSON `exercises` bez przeliczania reszty).
- `lib/user-facing-errors.ts` — nowe komunikaty (błąd patcha cardio, duplikat/konflikt operacji).
- `java-backend/.../workout/WorkoutController.java`, `WorkoutService.java`, `CompleteWorkoutRequest.java` — pole `operationId` w żądaniu, pole `workoutId` w odpowiedzi (patrz p. 9, zakres ograniczony, Java jest dziś niekompletnym stubem).
- `lib/admin-config-status.ts` — bez nowego wpisu (brak nowej zmiennej środowiskowej).

**Frontend (komponenty, store, hooki, czyste funkcje UI)**
- `lib/stores/active-workout.ts` — pole `operationId` (generowane raz na sesję przy starcie treningu), czyszczone po sukcesie zapisu.
- `lib/workout-complete-submit.ts` — przekazanie `operationId` w payloadzie; typ `SubmitWorkoutResult` rozszerzony o `workoutId`.
- `lib/workout-outbox-db.ts` — `PendingWorkoutPayload.operationId: string`.
- `lib/workout-cardio-patch-submit.ts` (nowy) — lekki klient PATCH cardio.
- `lib/workout-skipped-sets.ts` — reguła 0 kg + powtórzenia > 0 = zaliczona (usunięcie warunku ciężaru z `isSkippedWorkoutSet`/`resolveSetSaveIssue`/`canCompleteWorkoutSet`).
- `lib/active-workout-copy.ts` — etykieta „Zakończ ostatnią serię i zapisz”; aktualizacja `workoutFinishFooterLine`/treści niezależnych od „Gotowe”.
- `lib/workout-finish-format.ts` — tekst stopki bez „Po „Gotowe””.
- `components/active-workout/use-workout-finish-flow.ts` (nowy hook) — wspólna logika: dialog pominiętych → zapis → ekran końcowy, używana przez wszystkie trzy wejścia.
- `components/active-workout/workout-saving-screen.tsx` (nowy) — ekran „Zapisuję trening…” / błąd / wolne połączenie.
- `components/active-workout/workout-finished-screen.tsx` — przebudowa na docelowy ekran „Trening zakończony” (tonaż, delta, pełna lista serii, „Zobacz postęp”, cardio patch, „Zamknij”); dawny `PlanCompareDialog` przeniesiony tu jako sekcja.
- `components/active-workout/workout-all-sets-done-dialog.tsx` — poprawka tytułu/treści, rozdzielenie liczników pominiętych/niewykonanych.
- `components/active-workout/active-workout-view.tsx` — `completeWorkout` przeniesione do hooka, podłączenie dialogu, usunięcie `startRest` po ostatniej serii, usunięcie `sessionStorage`.
- `components/active-workout/active-workout-global-bar.tsx` — użycie wspólnego hooka, usunięcie czerwonego CTA i własnego `AlertDialog`/`window.alert`.
- `components/active-workout/guided-session-layout.tsx` — etykieta ostatniej serii, usunięcie błędu „Podaj ciężar” dla bodyweight, `onFinishSession` przez wspólny hook (Q-P4).
- `components/reports/workout-complete-popup.tsx` — **usunięcie pliku**.
- `components/layout/app-shell.tsx` — usunięcie montowania `WorkoutCompletePopup`.
- `components/workout/WorkoutSummary.tsx` — **usunięcie pliku** (martwy kod).
- `lib/ghost-training/timeline.ts` — bez zmian kodu (decyzja właściciela p.8: bodyweight liczy się normalnie), ale wymaga testu regresji potwierdzającego brak dodatkowego filtra.
- `components/changelog/changelog-data.ts` — wpis `planned: true`.

Pliki dotykane przez oboje (kontrakt, do uzgodnienia przed kodowaniem): typ `SubmitWorkoutResult`/`CompleteWorkoutInput`, kształt odpowiedzi `/api/workouts/complete`, kształt żądania/odpowiedzi PATCH cardio.

---

## 1. Idempotencja zapisu (LR-3)

### Kontekst
`POST /api/workouts/complete` (`app/api/workouts/complete/route.ts:369-398`) generuje `workoutId = crypto.randomUUID()` przy każdym wywołaniu i zawsze wykonuje `INSERT`. Odpowiedź (`{ ok, strengthDeltaPercent, planCompare }`) nie zawiera identyfikatora. `submitCompletedWorkout` (`lib/workout-complete-submit.ts:70-79`) kolejkuje do `outboxEnqueue` przy błędzie sieciowym — który może nastąpić **po** zapisie na serwerze (zgubiona odpowiedź). Nowy przycisk „Spróbuj ponownie” (AC-3.5) ponawia ten sam zapis. Każdy z tych przypadków dziś tworzy drugi rekord `workouts` i drugi wpis w feedzie zespołu (`publishTeamFeedAfterWorkout` wywoływane przy każdym `INSERT`, `route.ts:379-390`).

### Decyzja
Klucz idempotencji (`operationId`, UUID v4) generowany **raz na sesję treningu**, w momencie startu sesji (`lib/stores/active-workout.ts`, w akcji `start()`/`beginWorkoutFromPlan`, obok `workoutStartedAtMs`). Klucz żyje w store (persystowany jak reszta stanu sesji) i w payloadzie wysyłanym do `/api/workouts/complete`, oraz w rekordzie kolejki offline. Serwer sprawdza unikalność `(userId, operationId)` przed `INSERT`; przy konflikcie zwraca wynik pierwszego zapisu (nie tworzy drugiego rekordu, nie publikuje drugi raz w feedzie).

### Projekt
**Schemat (`db/schema.ts`, tabela `workouts`):**
```ts
export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workoutPlanId: text("workout_plan_id"),
    date: text("date").notNull(),
    cardioMinutes: integer("cardio_minutes").notNull().default(0),
    exercises: text("exercises").notNull(),
    /** Klucz idempotencji zapisu — jeden na sesję treningu (LR-3). Nullable: wiersze historyczne. */
    operationId: text("operation_id"),
  },
  (t) => [
    index("idx_workouts_user_plan_date").on(t.userId, t.workoutPlanId, t.date),
    index("idx_workouts_user_date").on(t.userId, t.date),
    uniqueIndex("uq_workouts_user_operation").on(t.userId, t.operationId),
  ],
);
```
`operationId` jest `nullable`, żeby nie wymagać backfillu dla istniejących wierszy (SQLite/libSQL: `NULL` nie koliduje w unikalnym indeksie, wiele `NULL` mogą współistnieć). Migracja: `ALTER TABLE workouts ADD COLUMN operation_id text; CREATE UNIQUE INDEX uq_workouts_user_operation ON workouts(user_id, operation_id);` — bezpieczna dla działającej bazy (bez zmiany istniejących danych, bez blokady tabeli na Turso/libSQL przy `ADD COLUMN`).

**Kontrakt żądania (`bodySchema` w `route.ts`):** nowe wymagane pole
```ts
operationId: z.string().uuid(),
```
(dodane też do `exerciseSchema`'s sibling — czyli do `bodySchema` głównego, nie do `CompleteWorkoutInput` typu w `lib/workout-complete-submit.ts`, który już re-eksportuje `PendingWorkoutPayload` — tam też dodać pole).

**Logika serwera (`handlePOST`):**
1. Po walidacji Zod, **przed** budowaniem `planCompare` (koszt obliczeń): `SELECT id FROM workouts WHERE user_id = ? AND operation_id = ? LIMIT 1`.
2. Jeśli istnieje → odpowiedź musi zawierać te same dane co pierwszy zapis. Ponieważ `strengthDeltaPercent`/`planCompare` nie są trwale zapisywane (liczone w locie), przy duplikacie serwer **przelicza** `planCompare` z aktualnych danych znalezionego wiersza (ten sam deterministyczny wynik, bo wiersz się nie zmienił) i zwraca `{ ok: true, workoutId: existing.id, strengthDeltaPercent, planCompare, duplicate: true }`. To unika przechowywania snapshotu odpowiedzi, kosztem jednego dodatkowego `SELECT` + rebuild porównania — koszt już ponoszony przy zapisie normalnym.
3. Jeśli nie istnieje → normalny przebieg, `INSERT` z `operationId`, publikacja feedu, zwrócenie `{ ok: true, workoutId, strengthDeltaPercent, planCompare, duplicate: false }`.
4. Unikalny indeks jest siecią bezpieczeństwa przy wyścigu (dwa równoczesne żądania z tym samym `operationId`, np. dwa urządzenia — patrz p. E-11): drugi `INSERT` rzuci błąd ograniczenia; `catch` na ten konkretny błąd traktuje go jak krok 2 (ponowny `SELECT` i zwrócenie istniejącego wiersza), zamiast 500.

**Odpowiedź (`SubmitWorkoutResult` w `lib/workout-complete-submit.ts`):**
```ts
export type SubmitWorkoutResult =
  | { status: "saved"; workoutId: string; strengthDeltaPercent: number | null; planCompare: WorkoutPlanComparePayload | null }
  | { status: "queued"; localId: string }
  | { status: "error"; message: string };
```
`workoutId` jest wymagany do patcha cardio (p. 2). Status `"queued"` nie ma `workoutId` — patrz AC-6.7, rozstrzygnięcie w p. 2.5.

**Blokada podwójnego tapnięcia / równoległego zapisu z dwóch ścieżek (AC-3.2):** stan `saving`/`completing` w store aktywnego treningu (nie lokalny `useState` per-komponent, bo trzy komponenty — ekran główny, pasek, menu — muszą dzielić ten sam flag). Nowe pole w `lib/stores/active-workout.ts`: `finishPending: boolean` + akcje `beginFinish()/endFinish()`. Wspólny hook (p. 4) sprawdza `finishPending` przed wysłaniem i ustawia go na czas zapisu; wszystkie trzy UI blokują swój przycisk na tym samym polu.

**Kolejka offline (`lib/workout-outbox-db.ts`):** `PendingWorkoutPayload.operationId: string` — ten sam klucz jak przy pierwszej próbie (generowany w store, nie w momencie enqueue). `outboxEnqueue` nie generuje nowego id dla operacji biznesowej (`id` rekordu kolejki to osobny, techniczny identyfikator wpisu w IndexedDB — zostaje bez zmian, nie jest tym samym co `operationId`).

**Java (`WorkoutController.java`, `WorkoutService.java`, `CompleteWorkoutRequest.java`):** dodać pole `operationId` do `CompleteWorkoutRequest`; `WorkoutService` (dziś `ConcurrentHashMap` w pamięci, bez trwałego magazynu) sprawdza istniejący wpis po `(userId, operationId)` w swojej mapie przed dodaniem; `WorkoutController` zwraca pole `workoutId` (zmiana nazwy z dzisiejszego `id`, dla jednego kontraktu z TS). Patrz p. 9 — zakres ograniczony, bo Java nie ma dziś `planCompare`, cardio ani feedu.

### Konsekwencje i kompromisy
- Jeden dodatkowy `SELECT` na każde żądanie zapisu (indeksowany, tani). Akceptowalne wobec wymogu LR-3.
- `operationId` nullable w schemacie — nie wymaga migracji danych historycznych, ale oznacza, że stare wiersze (bez klucza) nigdy nie są traktowane jako duplikat niczego — poprawne, bo powstały przed tą zmianą.
- Nie przechowujemy snapshotu pierwszej odpowiedzi — przeliczanie `planCompare` przy duplikacie jest deterministyczne (dane wejściowe = zapisany wiersz + ten sam `workoutPlanId`), więc wynik jest identyczny z pierwszym zapisem. Alternatywa (zapisanie snapshotu JSON odpowiedzi w nowej kolumnie) była rozważana i odrzucona — dodaje kolumnę i ryzyko rozjazdu, bez korzyści, bo przeliczenie jest bezstanowe i tanie.
- Odrzucona alternatywa: idempotencja po stronie klienta tylko (blokada przycisku). Nie chroni przed kolejką offline + ponowieniem po restarcie aplikacji ani przed dwoma urządzeniami (E-11) — stąd wymóg LR-3 po stronie serwera.

---

## 2. Patch cardio po zapisie (LR-4)

### Kontekst
Cardio jest zapisane w dwóch miejscach: kolumna `workouts.cardioMinutes` oraz obiekt `cardio` wewnątrz JSON `exercises` (`completedSessionJsonForCompare`, `lib/workout-plan-compare.ts:151-213`, pole `cardio: { distanceKm, avgHr, maxHr, calories, caloriesBurned, steps, paceMinPerKm, cardioType, effortScore, heartRateZone }`). Dziś cardio idzie tylko razem z pełnym zapisem treningu. Potrzebny jest lekki, osobny zapis po tym, jak trening już istnieje.

### Decyzja
Nowy endpoint `PATCH /api/workouts/[workoutId]/cardio`. Przyjmuje **wartości absolutne** (cały nowy stan cardio, nie delty). Autoryzacja: `workouts.userId === session.user.id`, sprawdzone przed jakimkolwiek zapisem (404, nie 403, żeby nie ujawniać istnienia cudzego rekordu — zgodnie ze wzorcem `workoutPlanMismatch` już używanym w `route.ts:277-282`). Jedna transakcja Drizzle (`db.transaction`) aktualizuje `cardioMinutes` i obiekt `cardio` w `exercises` razem. 0 minut usuwa cały obiekt `cardio` (nie tylko zeruje pola) — tętno, kalorie, kroki, dystans znikają z JSON.

### Projekt

**Route: `app/api/workouts/[workoutId]/cardio/route.ts`**
```ts
const cardioPatchSchema = z.object({
  cardioMinutes: z.number().finite().min(0).max(24 * 60),
  cardio: z.object({ /* te same pola co w bodySchema.cardio */ }).nullable().optional(),
});

async function handlePATCH(req: Request, { params }: { params: { workoutId: string } }) {
  const csrf = assertCsrf(req); if (csrf) return csrf;
  const rl = await checkRateLimitAsync(rateLimitKey("workout-cardio-patch", req), RATE.workoutCardioPatch.limit, RATE.workoutCardioPatch.windowMs);
  if (!rl.ok) return 429;
  const session = await auth(); if (!session?.user?.id) return 401;
  const parsed = cardioPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return 400;

  const db = getDb();
  const [row] = await db.select({ id: workouts.id, userId: workouts.userId, exercises: workouts.exercises })
    .from(workouts).where(eq(workouts.id, params.workoutId)).limit(1);
  if (!row || row.userId !== session.user.id) return NextResponse.json({ ok: false, error: UserMessages.notFound }, { status: 404 });

  const minutes = Math.max(0, Math.round(parsed.data.cardioMinutes));
  const nextExercisesJson = patchCardioInCompletedSessionJson(row.exercises, minutes > 0 ? parsed.data.cardio ?? null : null, minutes);

  await db.transaction(async (tx) => {
    await tx.update(workouts)
      .set({ cardioMinutes: minutes, exercises: nextExercisesJson })
      .where(and(eq(workouts.id, params.workoutId), eq(workouts.userId, session.user.id)));
  });

  revalidatePath("/reports"); revalidatePath("/workout-history");
  return NextResponse.json({ ok: true, cardioMinutes: minutes });
}
export const PATCH = withApiErrors(handlePATCH);
```
Brak `console.log`/Sentry breadcrumb z payloadem (LR-6) — `withApiErrors` nie loguje body, do zweryfikowania przez `backend` przy implementacji (sprawdzić, że wrapper nie dołącza request body do kontekstu błędu).

**`lib/workout-plan-compare.ts` — nowa funkcja czysta:**
```ts
/** Patch cardio po zapisie: minuty + obiekt cardio w JSON exercises, bez przeliczania reszty sesji. 0 min = usunięcie całego obiektu cardio. */
export function patchCardioInCompletedSessionJson(
  exercisesJson: string,
  cardioExtras: CardioExtrasInput | null,
  cardioMinutes: number,
): string {
  const parsed = JSON.parse(exercisesJson) as Record<string, unknown>;
  if (cardioMinutes <= 0) {
    delete parsed.cardio;
  } else {
    parsed.cardio = cardioExtras ? { ...cardioExtras } : undefined;
    if (!parsed.cardio) delete parsed.cardio;
  }
  return JSON.stringify(parsed);
}
```
(Dokładny kształt pól `cardio` — identyczny z `completedSessionJsonForCompare` dzisiejszym, nie zmienia się; funkcja operuje na już sparsowanym `completed_session` JSON, nie przelicza `kind`/`startedAt` itd.)

**Autoryzacja przez Javę:** jeśli `isJavaApiEnabled()`, proxy identycznie jak dla `POST /complete` (`fetchJavaApi`). Java dziś **nie ma** trwałego magazynu treningów (`ConcurrentHashMap` w pamięci procesu) — patch cardio przez Javę nie jest realnie wdrażalny bez przepisania `WorkoutService` na persystencję. Decyzja: **PATCH cardio nie jest proxowany do Javy w tej zmianie** — endpoint działa wyłącznie przez ścieżkę TypeScript/Drizzle, niezależnie od `JAVA_API_BASE_URL`. To jest świadome ograniczenie zakresu (p. 9); właściciel Java-parytetu dostaje pozycję backlogu, nie blokuje tego zadania, bo LR-4 wymaga poprawności zapisu cardio, a dziś produkcja i tak biegnie przez TS (Java bez `JAVA_API_BASE_URL` nieaktywna).

**Kolejka offline i cardio bez `workoutId` (AC-6.7, Q-tech-2):** gdy trening jest w statusie `"queued"` (brak `workoutId`, bo serwer nigdy nie odpowiedział), ekran „Trening zakończony” **nie pokazuje** pola do edycji cardio — pasek cardio renderuje się w stanie wyłączonym z tekstem „Cardio będzie dostępne po wysłaniu treningu” (druga opcja z AC-6.7). Uzasadnienie: dołączanie cardio do payloadu kolejki po fakcie wymaga mutowania wpisu IndexedDB z osobnej ścieżki (ekran końcowy vs flush kolejki) i tworzy dwa źródła prawdy o tym, co jest w kolejce — koszt większy niż wygoda; użytkownik może dodać cardio z historii treningu po wysłaniu (poza zakresem tego zadania, ale ścieżka istnieje: `workout-history-edit-client.tsx`).

**Rate limit:** nowy wpis `RATE.workoutCardioPatch` w `lib/rate-limit.ts`, limit zbliżony do `RATE.workoutComplete` (patch jest rzadką, jednorazową operacją na ekranie podsumowania).

**Feed zespołu (Q-P3, R-5):** patch cardio **nie** wywołuje `publishTeamFeedAfterWorkout`. Wpis feedu pokazuje tylko stan z pierwszego zapisu (decyzja właściciela, p.8). Brak zmian w `lib/community/team-feed-auto.ts`.

### Konsekwencje i kompromisy
- Jedna transakcja obejmuje tylko `UPDATE` jednego wiersza `workouts` (dwa pola) — nie jest to rozproszona transakcja między tabelami, więc "jedna transakcja" tu głównie gwarantuje, że `cardioMinutes` i `exercises` się nie rozjedą przy równoczesnym zapisie (Drizzle `db.transaction` na libSQL serializuje to na poziomie połączenia); przy braku wsparcia transakcji na danym drivierze (do zweryfikowania przez `backend` z konfiguracją Turso) fallback to update całego wiersza jednym `UPDATE SET cardio_minutes = ?, exercises = ?` — atomowe z natury SQLite (pojedyncze stwierdzenie), co w praktyce wystarcza i może zastąpić `db.transaction`, jeśli ten generuje niepotrzebny narzut na libSQL HTTP. `backend` wybiera wariant przy implementacji; wymóg funkcjonalny (oba pola razem albo żadne) jest zachowany w obu wariantach.
- Odrzucona alternatywa: osobna tabela `workout_cardio` (1:1 z `workouts`). Odrzucona — rozbija dziś jednorodny model `workouts`, wymaga JOIN wszędzie, gdzie czytane jest `exercises`/`cardioMinutes` (wiele miejsc: historia, raporty, eksport), bez korzyści dla tego zadania. Zostaje przy istniejącym podwójnym miejscu (kolumna + JSON), tylko patch je synchronizuje.

---

## 3. Przeniesienie momentu zapisu

### Decyzja
Zapis (`submitCompletedWorkout`) następuje natychmiast po potwierdzeniu zakończenia (po dialogu pominiętych, jeśli pokazany; od razu, jeśli brak pominiętych/niewykonanych), **przed** pokazaniem ekranu „Trening zakończony”. Stan przejściowy „Zapisuję trening…” jest pełnoekranowy, bez przycisków wyjścia (poza przerwaniem przeglądarki — A-3 z analizy).

### Projekt
Nowy komponent `components/active-workout/workout-saving-screen.tsx`:
```ts
type WorkoutSavingScreenState =
  | { phase: "saving" }
  | { phase: "slow" }        // > 10 s (A-4), nadal to samo żądanie
  | { phase: "error"; message: string };

type WorkoutSavingScreenProps = {
  state: WorkoutSavingScreenState;
  onRetry: () => void;       // ponawia z tym samym operationId
  onReturnToWorkout: () => void; // zamyka stan błędu, sesja nienaruszona
};
```
- `phase: "saving"` → `role` kontenera: `aria-live="polite"`, tekst „Zapisuję trening…”.
- Po 10 s bez wyniku → `phase: "slow"`, tekst „Wolne połączenie, nadal zapisujemy…”, żądanie nie jest przerywane (`setTimeout` w hooku, czyszczony przy zakończeniu `fetch`).
- `phase: "error"` → `role="alert"`, przyciski „Spróbuj ponownie” (ponawia `submitCompletedWorkout` z tym samym payloadem i `operationId`, `endedAt` pozostaje z pierwszej próby — nieliczone na nowo) i „Wróć do treningu” (zamyka, store sesji nienaruszony — zgodnie z AC-3.5/E-5/E-12: `reset()` store woła się dopiero PO sukcesie zapisu, nie przed).

**Kolejność w `completeWorkout` (przenoszona do hooka, p. 4):** dziś `reset()`/`setExercises([])` następują **przed** sprawdzeniem wyniku zapisu w części przypadków (patrz `active-workout-view.tsx:792-815` — `setSessionExitPending(true)` i `reset()` są wołane po `submitCompletedWorkout`, ale PRZED sprawdzeniem `newMaxHits`/przed pokazaniem czegokolwiek; to już jest poprawne — `reset()` jest po `result.status === "error"` throw, więc w błędzie nie dochodzi do `reset()`). Nowy przepływ zachowuje tę kolejność: zapis → (błąd: `workout-saving-screen` w stanie error, store nienaruszony) → (sukces/queued: `reset()` store + przejście na ekran „Trening zakończony” z danymi z odpowiedzi, nie z `sessionStorage`).

### Konsekwencje
- Ekran „Trening zakończony” nie jest nigdy pokazany przed zapisem (BR-1) — wymusza to struktura stanu w hooku (`"idle" | "confirming" | "saving" | "done" | "error"`), nie kolejność renderów w jednym komponencie jak dziś.
- `onDone`/„Gotowe” nie istnieje — zamykanie ekranu końcowego to „Zamknij”, które nie zapisuje nic (AC-4.11). Tekst na ekranie zapisu i błędu musi być zgodny z LR-2 (np. nigdy „Zamknij (nie zapisuje)” w UI — ustalenie tekstu robi `ux`/prawnik-człowiek, ADR tylko zakazuje tej frazy w kodzie).

---

## 4. Scalenie trzech ścieżek zakończenia w jeden hook

### Kontekst
Trzy miejsca wywołują dziś zapis/zakończenie niezależnie: `completeWorkout` (`active-workout-view.tsx:747-859`), `completeWorkoutFromBar` (`active-workout-global-bar.tsx:103-153`), `onFinishSession` (`active-workout-view.tsx:881-883`, bez dialogu wcale). Każde ma własną obsługę błędu, własną nawigację, własne `sessionStorage`.

### Decyzja
Nowy hook `components/active-workout/use-workout-finish-flow.ts`, używany przez wszystkie trzy wejścia (ekran główny, pasek globalny, dolne menu sesji). Żyje w `components/active-workout/` (nie `lib/`), bo zależy od store Zustand, routera Next (`useRouter`) i efektów (`useState`/`useEffect`) — nie jest czystą funkcją testowalną w Vitest bez mocków DOM/routera; logika czysta (liczenie pominiętych, budowanie payloadu) zostaje w `lib/` i jest wołana przez hook.

### Projekt
```ts
// components/active-workout/use-workout-finish-flow.ts
export type WorkoutFinishFlowState =
  | { phase: "idle" }
  | { phase: "skipped-dialog"; skippedCount: number; incompleteCount: number; target: SkippedWorkoutTarget }
  | { phase: "saving" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: WorkoutFinishedScreenData };

export function useWorkoutFinishFlow(): {
  state: WorkoutFinishFlowState;
  /** Wejście ze wszystkich trzech miejsc: sprawdza pominięte/niewykonane, otwiera dialog albo zapisuje od razu. */
  requestFinish: () => void;
  confirmFinishFromDialog: () => void;  // "Zakończ i zapisz" w dialogu
  goToSkippedTarget: () => void;        // "Wróć do serii"
  retry: () => void;
  returnToWorkout: () => void;
  close: () => void;                    // "Zamknij" na ekranie końcowym — nawigacja, zero żądań
} { /* ... */ }
```
Wewnątrz hooka:
1. `requestFinish()` czyta `exercises` ze store, liczy pominięte (`countSkippedWorkoutSets`) i niewykonane (nowa `countIncompleteWorkoutSets` w `lib/workout-skipped-sets.ts`, analogiczna do istniejącej, filtrująca `!s.done`). Jeśli suma > 0 → `phase: "skipped-dialog"` z oboma licznikami i `findFirstSkippedWorkoutTarget`. Jeśli 0 → wywołuje `doSave()` od razu (BR-7, zero wyjątków — AC-2.2).
2. `confirmFinishFromDialog()` → `doSave()`.
3. `doSave()` (prywatna): sprawdza `finishPending` w store (blokada p. 1), ustawia `finishPending=true`, `phase: "saving"`, woła `submitCompletedWorkout` z `operationId` ze store. Na `"saved"`/`"queued"` → `reset()` store, `phase: "done"` z danymi zbudowanymi z odpowiedzi + lokalnie liczonym tonażem/seriami (bez `sessionStorage`). Na `"error"` → `phase: "error"`, `finishPending=false`, store NIE resetowany.
4. `close()` → `router.push("/workout-plan")`, brak żądań sieciowych (AC-4.11); jeśli wywołany z paska globalnego/menu sesji, ten sam cel (A-10 — ujednolicenie miejsca lądowania, patrz p. 5.2 niżej).

**Użycie:**
- `active-workout-view.tsx`: `onFinishSession={() => flow.requestFinish()}` (zamiast `setFinishOpen(true)` wprost); ostatnia seria zaliczona → `patchSet` wywołuje `flow.requestFinish()` zamiast `startRest` (p. 5).
- `active-workout-global-bar.tsx`: przycisk „Zakończ trening” → `flow.requestFinish()`; dialog potwierdzenia paska (`confirmCompleteOpen`) zostaje jako wstępne pytanie „Zakończyć trening?” → „Tak” woła `flow.requestFinish()` (które samo decyduje, czy pokazać dialog pominiętych, czy zapisać od razu — dwa dialogi w rzadkim przypadku to akceptowalny koszt rozdzielenia odpowiedzialności: „czy w ogóle chcę kończyć” vs „czy wiem, że są pominięte”; `ux` może zdecydować o scaleniu w jeden ekran przy przeglądzie wizualnym).
- `guided-session-layout.tsx` dolne „Zakończ” → `onFinish` już wywołuje `onFinishSession` z widoku, więc automatycznie dostaje `flow.requestFinish()` bez zmian w tym pliku poza etykietą (P7: „Zakończ” → „Zakończ trening”).
- Ekran „Trening zakończony” (p. 7) renderuje się, gdy `flow.state.phase === "done"`, niezależnie od tego, które z trzech wejść wywołało `requestFinish`.

Hook jest zamontowany **jeden raz** na poziomie, który obejmuje wszystkie trzy UI — `ActiveWorkoutView` (bo tam już żyje store i routing dla ekranu głównego), a `ActiveWorkoutGlobalBar` i `SessionMenuSheet`/`guided-session-layout` dostają jego wynik przez props albo przez bezpośrednie wywołanie tego samego hooka (hook czyta globalny store Zustand, więc wywołanie go w dwóch komponentach naraz dzieli stan przez `finishPending` w store, ale **lokalny** `state` hooka — `useState` wewnątrz `useWorkoutFinishFlow` — byłby zduplikowany, gdyby hook był wołany w dwóch miejscach). Żeby uniknąć dwóch niezależnych instancji stanu: hook trzyma swój `WorkoutFinishFlowState` w store aktywnego treningu (`lib/stores/active-workout.ts`), nie w lokalnym `useState` komponentu — `useWorkoutFinishFlow()` staje się tylko fasadą nad akcjami store + `useRouter`. To jedno źródło prawdy, czytane przez wszystkie trzy komponenty.

### Konsekwencje i kompromisy
- Przeniesienie `WorkoutFinishFlowState` do store (nie lokalny stan Reacta) jest konieczne, bo trzy niezależnie montowane komponenty muszą widzieć ten sam stan (np. pasek globalny musi zniknąć, gdy ekran główny jest w trakcie zapisu, i odwrotnie). Koszt: store rośnie o jeden obiekt stanu UI, co jest odstępstwem od "store = dane sesji" — uzasadnione, bo to jedyny sposób scalenia bez przeniesienia całego UI do jednego komponentu (co zmieniłoby strukturę stron silniej niż potrzebne).
- Odrzucona alternatywa: `Context` React obejmujący wszystkie trzy komponenty. Odrzucona — pasek globalny (`app-shell.tsx`) i widok `active-workout` nie mają współnego przodka blisko w drzewie bez podnoszenia Context do layoutu głównego, co dotyka więcej plików niż dodanie pola do istniejącego store Zustand (który już jest globalny i używany przez oba).

---

## 5. Podłączenie dialogu pominiętych serii

### Decyzja
Dialog (`WorkoutAllSetsDoneDialog`) otwiera się wyłącznie przez `requestFinish()` w hooku (p. 4), nigdy przez `patchSet` wprost. To zastępuje dzisiejsze dwa miejsca domykania sesji:
1. **Ostatnia seria zaliczona/pominięta** (`patchSet`, `active-workout-view.tsx:685-700`): usunięcie `startRest(defaultSeconds)` i gałęzi „Koniec treningu”. Po `workoutComplete` (`done >= total`) wołane jest `flow.requestFinish()` zamiast przerwy. Dotyczy to też ostatniej serii pominiętej linkiem „Pomiń” (AC-1.4) — `isSkippedNext` już jest policzone w tej funkcji, ale teraz nie wpływa na to, czy wywołać `requestFinish` (zawsze wywołuje się przy domknięciu, niezależnie od pominięcia) — rozróżnienie pominięte/niewykonane dzieje się wewnątrz `requestFinish`, nie w `patchSet`.
2. **Pasek globalny i dolne „Zakończ”**: oba wołają `flow.requestFinish()` (p. 4) — ten sam dialog, ta sama logika liczenia.

### Projekt
`requestFinish()` (p. 4, krok 1) ustawia w store:
```ts
{ phase: "skipped-dialog", skippedCount, incompleteCount, target }
```
`WorkoutAllSetsDoneDialog` jest renderowany raz, na poziomie, gdzie dziś żyje (`active-workout-view.tsx`), kontrolowany przez `flow.state.phase === "skipped-dialog"` (zamiast dzisiejszego `skippedTarget`/`allSetsDoneOpen` lokalnego stanu) — te dwa lokalne stany (`allSetsDoneOpen`, `allSetsDoneSkipped`) są usuwane z `active-workout-view.tsx`, zastąpione przez pole w store.

### Konsekwencje
- Dialog pojawi się teraz przy każdym zakończeniu z pominięciem/niewykonaniem, niezależnie od wejścia — zgodnie z R-4/F-1 z analizy (zmiana zachowania wymaga wpisu w changelogu, nie jest regresją, jest zamierzonym naprawieniem martwego kodu).
- Pasek globalny traci swój osobny `AlertDialog` z pytaniem „Zakończyć trening?” **albo** go zachowuje jako pierwszy krok przed `requestFinish()` (decyzja UX, nie architektury — oba warianty są poprawne kontraktowo, bo `requestFinish()` jest idempotentny względem tego, czy jest wywołany od razu czy po dodatkowym pytaniu).

---

## 6. Reguła bodyweight: 0 kg + powtórzenia > 0 = zaliczona

### Decyzja
`lib/workout-skipped-sets.ts`:
```ts
export function isSkippedWorkoutSet(set: { done: boolean; skipped?: boolean; reps: number | null; weight: number }): boolean {
  if (!set.done) return false;
  if (set.skipped) return true;
  return !hasPerformedReps(set.reps); // usunięty warunek !hasExternalWeight(set.weight)
}

export type SetSaveIssue = "reps"; // "weight" usunięte — ciężar nigdy nie blokuje zaliczenia

export function resolveSetSaveIssue(weight: number, reps: number | null): SetSaveIssue | null {
  return hasPerformedReps(reps) ? null : "reps";
}

export function canCompleteWorkoutSet(weight: number, reps: number | null): boolean {
  return resolveSetSaveIssue(weight, reps) === null;
}
```
`hasExternalWeight` zostaje w pliku (wciąż używana np. do wyświetlania kg vs „masa ciała” w UI historii), ale nie wpływa już na `isSkippedWorkoutSet`.

### Wpływ na inne moduły (zweryfikowany Grep, p. przegląd kodu wyżej)
- **`guided-session-layout.tsx:348-351,564`**: `resolveSetSaveIssue` zwraca już tylko `"reps"` — usunąć branch `issue === "weight"` (fokus na `weightInputRef`, `error="Podaj ciężar"` na polu kg). `saveIssue` state może zostać `boolean` (czy brakuje powtórzeń) zamiast `{weight, reps}` — **frontend** decyduje przy implementacji, czy zwęzić typ czy zostawić `weight` zawsze `false` (zalecenie: zwężyć, żeby nie zostawiać martwego pola).
- **`lib/workout-session-calculations.ts` (`kind: "bodyweight"`, l. 109-163)**: bez zmian — już liczy serie 0 kg + reps jako osiągnięcie bodyweight; teraz ta logika jest zgodna z `isSkippedWorkoutSet`, usuwając sprzeczność opisaną w F-3 analizy.
- **`lib/ghost-training/timeline.ts:64-66`**: bez zmian kodu. `isCompletedWorkoutSet` automatycznie zacznie zwracać `true` dla bodyweight — zgodnie z decyzją właściciela (p.8, Q-P1 rozstrzygnięte: bez osobnej reguły dla Ghost). **Wymaga testu regresji** potwierdzającego, że to jest zamierzone (nie przez przypadek — `tester`/`tester-bezpieczenstwa` sprawdza, że żadna osobna funkcja „zaliczona z obciążeniem” nie jest potrzebna, bo LR-5 z bramki prawnej dopuszczał to jako wariant zaakceptowany przez właściciela).
- **`lib/last-workout-hints.ts`** (linie 102-178, 261-413 wg Grep): filtruje przez `isCompletedWorkoutSet`, ale osobno sprawdza `s.weight > 0`/`top * 0.98` dla wykrywania najlepszego ciężaru (PR sugestii) — te dodatkowe warunki **zostają bez zmian**, bo już wykluczają bodyweight z porównań opartych na kg. Bodyweight teraz dodatkowo przechodzi przez `isCompletedWorkoutSet` w miejscach liczących streaki/frekwencję (`lib/live-coach/streaks.ts`, `fatigue.ts`, `build-coach-signals.ts`) — to jest poprawne i pożądane: seria bodyweight ma się liczyć jako wykonana aktywność, nie tylko jako dane do rankingu kg.
- **`lib/session-new-max.ts` (`detectSessionNewMaxes`)**: już filtruje `s.weight <= 0` niezależnie od `isSkippedWorkoutSet` (własny warunek, linia 78) — bez zmian, PR nadal tylko dla ciężaru > 0 (BR-8 niezmienione).
- **`lib/workout-session-progress.ts`**: korzysta z `isCompletedWorkoutSet`/`isSkippedWorkoutSet` do liczenia nagłówka „seria X/Y” — automatycznie poprawne po zmianie, bez osobnej zmiany kodu.
- **`active-workout-view.tsx:654-679` (`patchSet`)**: korzysta z `canCompleteWorkoutSet`/`resolveSkippedAfterEdit` — automatycznie poprawne, seria 0 kg + reps>0 nie będzie już automatycznie oznaczana `skipped: true`.

### Konsekwencje i kompromisy
- To jest zmiana reguły biznesowej obejmująca całą aplikację (zgodnie z decyzją właściciela, p.7 karty), nie tylko ekran końca treningu — ryzyko R-1 z analizy jest zamknięte tą decyzją, ale efekt uboczny: ciężar wpisany jako 0 przez pomyłkę (dla ćwiczenia, które normalnie ma obciążenie) teraz zalicza się jako bodyweight bez ostrzeżenia. Właściciel zaakceptował to ryzyko (p.7); nie dodajemy dodatkowej walidacji "czy to ćwiczenie zwykle ma ciężar" — brak takiej klasyfikacji w danych ćwiczeń dziś, a jej dodanie wykracza poza zakres zadania.
- Historia zapisana wcześniej (przed zmianą) nie jest migrowana — interpretacja przy odczycie zmienia się dla wszystkich istniejących wierszy automatycznie (bo `isSkippedWorkoutSet` liczy się z surowych `reps`/`weight`, nie z zapisanej flagi). To jest zamierzone i bezpieczne (LR-5): dane źródłowe (`reps`, `weight`, `skipped`) się nie zmieniają, zmienia się tylko interpretacja przy wyświetlaniu/analizie. Trzeba to odnotować w changelogu, bo stare treningi bodyweight "zyskują" tonaż/zaliczenie retroaktywnie w statystykach (streaki, Ghost, progress-hub).

---

## 7. Ekran „Trening zakończony”

### Decyzja
Jeden komponent (przebudowany `workout-finished-screen.tsx`) zastępuje `WorkoutFinishedScreen` + `WorkoutCompletePopup`. Dane trafiają przez props z wyniku hooka `useWorkoutFinishFlow` (`state.result` gdy `phase === "done"`), nie przez `sessionStorage`.

### Kontrakt danych
```ts
type WorkoutFinishedScreenData = {
  title: string;
  planLabel: string;
  endedAtMs: number;
  durationSeconds: number;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  exercises: WorkoutExerciseState[];       // pełna lista, do wiersza "wszystkie serie" (AC-4.6)
  weightRecords: SessionWeightRecord[];
  newMaxHits: NewMaxHit[];
  cardioMinutes: number;
  cardioExtras: ActiveCardioExtras;
  saveStatus: "saved" | "queued";
  workoutId: string | null;                // null tylko gdy saveStatus === "queued"
  planCompare: WorkoutPlanComparePayload | null; // z odpowiedzi POST /complete, bez nowego zapytania (AC-4.2)
};
```
- **Tonaż + delta „vs ostatnio”**: `volumeKg` liczony lokalnie (`sessionTotal`, bez zmian), delta z `planCompare.volumeDeltaPercent` — dostępna natychmiast po zapisie, bo `route.ts` już liczy `planCompare` przed odpowiedzią (p. 1). Usuwa potrzebę ponownego przeliczania po nawigacji, którą dziś robi `WorkoutCompletePopup` po stronie klienta z danych w `sessionStorage` — teraz to te same dane, tylko przekazane przez props zamiast przez storage.
- **Pełna lista serii**: druga linia pod wierszem ćwiczenia (AC-4.6) renderowana z `data.exercises` (już w pamięci, bez nowego zapytania) — `bestSetsFromSession` zostaje dla wiersza głównego, nowa funkcja `allSetsLineFromSession(exercise)` w `lib/workout-session-calculations.ts` (lub nowy mały moduł `lib/workout-finish-sets-line.ts`, żeby nie rozdmuchiwać pliku obliczeń) buduje tekst „1: 80×8 · 2: 80×7 · 3: pominięta · 4: niewykonana”.
- **„Zobacz postęp”**: `PlanCompareDialog` z `workout-complete-popup.tsx` przenosi się jako wewnętrzna sekcja rozwijana (`<details>`/kontrolowany `expanded` stan) w tym samym pliku co ekran końcowy — nie osobny modal. Treść i obliczenia (`formatExerciseDelta`, `progressDeltaTone`) kopiowane bez zmian logiki, tylko zmiana layoutu z `AlertDialogContent` na sekcję inline.
- **NOWY MAX (Q4)**: sekcja „Nowe rekordy” zostaje na tym ekranie (jak dziś w `WorkoutFinishedScreen`), **przekierowanie do `/progress/exercises/...` zostaje usunięte** — `router.push` warunkowy w `completeWorkout` (dzisiejsze linie 827-840) nie przenosi się do hooka; `hapticNewMax()` nadal wywoływany.

### `sessionStorage` + `usePathname` w `workout-complete-popup.tsx`
**Rekomendacja: usunąć cały plik**, zgodnie z poleceniem z karty zadania. Mechanizm round-trip przez `sessionStorage`/`usePathname` istniał wyłącznie, by pokazać popup po nawigacji po stronie — nowy przepływ nie nawiguje przed pokazaniem podsumowania (BR-1: podsumowanie pokazuje się jako overlay na tej samej stronie, zanim nastąpi `router.push("/workout-plan")` z przycisku „Zamknij”). Nie ma scenariusza, w którym plik byłby jeszcze potrzebny — zachowanie go jako martwego kodu dodaje dług bez korzyści (sprzeczne z zasadą "brak martwego kodu" z `przeplyw.md`).

### Konsekwencje
- `app-shell.tsx` nie montuje już `WorkoutCompletePopup` — jeden mniej globalny listener/efekt na każdej stronie.
- Klucze `workout:completedSummary`, `gymbrat:newMaxToast` znikają z `active-workout-view.tsx` i `active-workout-global-bar.tsx` (AC-5.2). `gymbrat:workoutQueued` i `QueuedWorkoutBanner` na `/reports` **zostają** (poza zakresem usuwania) — obsługują przypadek, gdy użytkownik zamyka przeglądarkę na ekranie „Trening zakończony” w stanie `queued` i wraca później na `/reports`; to jest komunikacja spoza przepływu zakończenia (zgodnie z pytaniem z analizy, AC-5.4) — decyzja: baner zostaje, bo pokrywa inny moment w czasie (po zamknięciu aplikacji) niż ekran P4 (w trakcie).

---

## 8. Ujednolicenie CTA

### Decyzja
- `components/workout/WorkoutSummary.tsx` — **usunięcie pliku** (0 importów, potwierdzone w analizie i w tym przeglądzie; czerwony `#FF1A4B` dziś żyje gdzie indziej, patrz niżej).
- `components/active-workout/active-workout-global-bar.tsx`: przyciski „Zakończ trening” (l. 202-219) i „Zakończ i zapisz” w `AlertDialogContent` (l. 277-294) zmieniają klasę z `bg-[#FF1A4B] text-white hover:bg-[#e61645]` na `gym-btn-primary` (token używany już w `workout-finished-screen.tsx` dla „Zapisz cardio”/„Gotowe” i w `workout-complete-popup.tsx` dla „Zobacz postęp”/„Zamknij” — to jest istniejący, spójny wariant złotego CTA w repo, preferowany nad gołym `var(--gym-gold)` inline, bo niesie też kolor tekstu/hover zdefiniowany raz w CSS).
- Przycisk „Odrzuć” (l. 319-329, `variant="destructive"`) **zostaje czerwony** — to semantyczna destrukcja (AC-9.3), nie akcja zakończenia.

### Konsekwencje
- Test `grep -r "#FF1A4B" components/active-workout` po zmianie zwraca zero wyników (AC-9.2) — włączyć do testów `tester` jako prosty regresyjny `grep`/`toMatch` w pliku testowym, nie tylko manualne sprawdzenie.

---

## 9. Zakres pominięty / ograniczony świadomie (do backlogu)

- **Java backend — pełny parytet.** `WorkoutService.java` jest dziś w pamięci procesu (`ConcurrentHashMap`), bez `planCompare`, cardio extras, feedu zespołu ani trwałego magazynu. Ten ADR wymaga tylko: pole `operationId` w żądaniu + dedup w mapie w pamięci, zmiana nazwy pola odpowiedzi `id` → `workoutId`. **PATCH cardio nie jest wdrażany w Javie w tej zmianie** (p. 2) — Java nie ma gdzie trwale zapisać cardio. Ponieważ `isJavaApiEnabled()` jest wyłączone na produkcji (brak `JAVA_API_BASE_URL`, zgodnie z opisem repo), to nie blokuje LR-3/LR-4 dla ścieżki rzeczywiście używanej. Rekomendacja: osobny ADR, jeśli/gdy Java ma dostać pełny parytet.
- **Android.** Jeśli aplikacja natywna wywołuje `/api/workouts/complete` z własnym klientem, musi zacząć wysyłać `operationId` — pole jest dodawane jako **wymagane** w schemacie (`z.string().uuid()`, bez `.optional()`), co jest zmianą łamiącą kontrakt dla starszych klientów Android bez aktualizacji. Decyzja: pole wymagane (nie opcjonalne z fallbackiem na serwerze), bo opcjonalność psuje cel LR-3 (klient, który nie wysyła klucza, nie ma ochrony przed duplikatem). **Wymaga potwierdzenia przez `backend`/właściciela, czy Android w ogóle używa tego endpointu bezpośrednio, i jeśli tak — wersjonowania (nowa wersja minimalna aplikacji) przed Promote.** To jest pytanie Q-tech-4 z analizy, nierozstrzygnięte w tym ADR — blokuje Promote, nie blokuje implementacji/Preview.
- **Dwa urządzenia (E-11).** Unikalny indeks `(userId, operationId)` chroni przed duplikatem **tego samego** treningu (ten sam `operationId`, bo klucz jest per-sesja, a sesja w store jest per-urządzenie po wczytaniu z chmury). Scenariusz "dwa urządzenia z osobno wygenerowanym `operationId` dla tej samej logicznej sesji" (np. sesja wznowiona z chmury na drugim telefonie już po zapisie na pierwszym) nie jest w zakresie tego ADR — wymaga znacznika zamknięcia sesji w chmurze (`requestActiveWorkoutCloudPush`/cloud sync), co jest już opisane jako osobne ryzyko R-8 w analizie. Backlog, średni priorytet.
- **Klasyfikacja danych cardio jako zdrowotnych (LR-6/Q-P2).** Poza zakresem architektonicznym — decyzja prawnik-człowiek, dokumenty `docs/prawo/00-...`/`01-...` aktualizowane osobno przed Promote (już odnotowane w karcie zadania).

---

## 10. Weryfikacja zgodności z bramką prawną

| Wymóg LR | Status w tym ADR |
|---|---|
| LR-1 (brak nowych pól/celów) | Zachowane — `operationId` jest metadanymi operacji, nie nową kategorią danych osobowych; PATCH cardio przesyła tylko pola cardio. |
| LR-2 (prawdziwość tekstów) | Ustalenia architektury to umożliwiają (zapis przed ekranem końcowym, komunikat błędu bez wartości serii); ostateczne teksty — `ux`/prawnik-człowiek. |
| LR-3 (idempotencja) | Zaprojektowane w p. 1: `operationId`, unikalny indeks, zwracanie `workoutId`, dedup przy konflikcie. |
| LR-4 (patch cardio) | Zaprojektowane w p. 2: autoryzacja właściciela, wartości absolutne, jedno zapytanie/transakcja na dwa miejsca, 0 min usuwa cały obiekt, brak logowania payloadu, brak ponownej publikacji feedu. |
| LR-5 (Ghost) | Rozstrzygnięte decyzją właściciela (p.8) — bez zmiany filtra Ghost, odnotowane w p. 6. |
| LR-6 (logi) | `withApiErrors`/nowy endpoint nie logują body — do weryfikacji przez `tester-bezpieczenstwa` przy przeglądzie kodu. |
| LR-7 (grafika PR) | Bez zmian w tym ADR — `lib/pr-achievement-image.ts` nie jest dotykany; zmiana seeda/promptu to osobna decyzja, poza zakresem tego zadania (nie wymagana przez P1-P10). |
| LR-8 (retencja/eksport) | Bez zmian — nowa kolumna `operationId` i endpoint PATCH nie zmieniają ścieżki eksportu/usuwania (kaskada po `userId` nadal działa; `lib/user-data-export.ts` nie wymaga zmian, bo `operationId` nie jest wymieniony jako dana wymagana w eksporcie — do potwierdzenia przez `backend`, czy dodać go dla kompletności, niski priorytet). |

## 11. Ryzyka wprowadzone przez ten projekt

| Ryzyko | Mitigacja |
|---|---|
| Unikalny indeks `(userId, operationId)` z wartościami `NULL` dla starych wierszy — zachowanie `NULL` w unikalnym indeksie różni się między silnikami; do zweryfikowania na libSQL/Turso przed merge. | `backend` uruchamia migrację na branchu deweloperskim Turso i testuje wstawienie dwóch wierszy z `operation_id = NULL` przed merge. |
| Stan `WorkoutFinishFlowState` w globalnym store zwiększa powierzchnię store aktywnego treningu — ryzyko regresji w nietypowych kombinacjach (np. dialog otwarty + nawigacja). | `tester` pokrywa trzy ścieżki wejścia (ekran, pasek, menu) tym samym zestawem testów (DRY w testach — jeden zestaw funkcji testowych parametryzowany wejściem). |
| Przeliczanie `planCompare` przy wykrytym duplikacie dodaje zapytania (`SELECT recent`) nawet gdy nic nie trzeba zapisywać. | Akceptowalne — ten sam koszt co normalny zapis, duplikat jest rzadkim przypadkiem (błąd sieci/retry), nie ścieżką główną. `tester-wydajnosci` mierzy p95 tylko dla ścieżki głównej (NFR-2). |

## Werdykt

**ZATWIERDZONE Z UWAGAMI.**

Projekt rozstrzyga oba wymogi blokujące merge (LR-3, LR-4) oraz wszystkie punkty 1-8 polecenia. Uwagi, które nie blokują etapu 4 (ux)/5 (implementacja), ale wymagają decyzji przed Promote:
1. Potwierdzenie przez `backend`, czy Android wywołuje `/api/workouts/complete` bezpośrednio — jeśli tak, pole `operationId` wymagane w schemacie wymaga wersjonowania API przed Promote (p. 9).
2. Zachowanie unikalnego indeksu z `NULL` na libSQL/Turso do zweryfikowania empirycznie przed merge (p. 11).
3. Parytet Java jest świadomie ograniczony (p. 9) — wymaga wpisu w backlogu, nie bloku tego zadania, bo ścieżka produkcyjna dziś biegnie przez TypeScript.
