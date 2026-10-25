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
| LR-5 (Ghost) | Rozstrzygnięte decyzją właściciela (p.8) — kod filtra Ghost (`lib/ghost-training/timeline.ts`) pozostaje bez zmian, ALE ponieważ korzysta ze współdzielonej `isCompletedWorkoutSet`, zmiana reguły bodyweight (p.6) zmienia jego FAKTYCZNY wynik: rywale widzą teraz więcej serii (w tym w treningach historycznych, wstecz). To nie jest „brak zmiany" w sensie widocznego zachowania — tylko brak zmiany kodu tego pliku. Bramka wyjściowa prawnika (etap 10) oceniła to jako niewymagające nowej zgody (ta sama kategoria danych i odbiorcy), ale wymaga: aktualizacji `docs/prawo/004-ekran-aktywnego-treningu-wyjscie.md` (zrobione, sekcja 11) i wpisu w changelogu informującego o tej zmianie zakresu (`components/changelog/changelog-data.ts`). |
| LR-6 (logi) | `withApiErrors`/nowy endpoint nie logują body — do weryfikacji przez `tester-bezpieczenstwa` przy przeglądzie kodu. |
| LR-7 (grafika PR) | Bez zmian w tym ADR — `lib/pr-achievement-image.ts` nie jest dotykany; zmiana seeda/promptu to osobna decyzja, poza zakresem tego zadania (nie wymagana przez P1-P10). |
| LR-8 (retencja/eksport) | Bez zmian — nowa kolumna `operationId` i endpoint PATCH nie zmieniają ścieżki eksportu/usuwania (kaskada po `userId` nadal działa; `lib/user-data-export.ts` nie wymaga zmian, bo `operationId` nie jest wymieniony jako dana wymagana w eksporcie — do potwierdzenia przez `backend`, czy dodać go dla kompletności, niski priorytet). |

## 11. Ryzyka wprowadzone przez ten projekt

| Ryzyko | Mitigacja |
|---|---|
| Unikalny indeks `(userId, operationId)` z wartościami `NULL` dla starych wierszy — zachowanie `NULL` w unikalnym indeksie różni się między silnikami; do zweryfikowania na libSQL/Turso przed merge. | `backend` uruchamia migrację na branchu deweloperskim Turso i testuje wstawienie dwóch wierszy z `operation_id = NULL` przed merge. |
| Stan `WorkoutFinishFlowState` w globalnym store zwiększa powierzchnię store aktywnego treningu — ryzyko regresji w nietypowych kombinacjach (np. dialog otwarty + nawigacja). | `tester` pokrywa trzy ścieżki wejścia (ekran, pasek, menu) tym samym zestawem testów (DRY w testach — jeden zestaw funkcji testowych parametryzowany wejściem). |
| Przeliczanie `planCompare` przy wykrytym duplikacie dodaje zapytania (`SELECT recent`) nawet gdy nic nie trzeba zapisywać. | Akceptowalne — ten sam koszt co normalny zapis, duplikat jest rzadkim przypadkiem (błąd sieci/retry), nie ścieżką główną. `tester-wydajnosci` mierzy p95 tylko dla ścieżki głównej (NFR-2). |

## 12. Naprawa B-1b — monotoniczność rewizji po DELETE (dodatek, etap 7b → 3)

- Status dodatku: zaproponowany
- Data: 2026-10-25
- Wejście: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 9 (ustalenia powtórki, werdykt tester etapu 7b: ODRZUCONE, defekt B-1b), ten ADR p. 1 (kontekst `operationId`)

### Kontekst

`activeWorkoutSessions` (`db/schema.ts:554-564`) ma `userId` jako **klucz główny** — jest co najwyżej jeden wiersz na użytkownika. `handleDELETE` (`app/api/active-workout-session/route.ts:198-225`) dziś fizycznie usuwa ten wiersz (`db.delete(...)`), a klient (`deleteCloud()`, `components/active-workout/active-workout-cloud-sync.tsx:141-151`) po sukcesie **zakłada lokalnie rewizję 0** (`writeRevision(0)`), niezależnie od tego, jaka rewizja była na serwerze w momencie usunięcia. `handlePUT` (`route.ts:142-165`) traktuje brak wiersza jako `serverRevision = 0` i akceptuje każdy `clientRevision >= serverRevision`.

Skutek (sonda testera, sekcja 9.2 raportu): urządzenie B ma zalegający, nieaktualny stan sesji 1 z rewizją klienta 5 (np. z kolejki retry/debounce). Urządzenie A kończy sesję 1 → `DELETE` → wiersz zniknął, serwer "zapomina" rewizję 5. A startuje sesję 2 z nowym `operationId` → `PUT` z `clientRevision = 0` → serwer tworzy wiersz z `revision = 1`. Zanim B zdąży zsynchronizować się z chmurą (pull), B wysyła swój zaległy `PUT` z `clientRevision = 5` → `5 >= 1` → serwer **akceptuje i nadpisuje** sesję 2 danymi sesji 1. A w końcu dostaje konflikt 409, przejmuje `operationId` sesji 1 i przy zakończeniu treningu serwer (`/api/workouts/complete`) zgłasza `duplicate: true` dla sesji 1 — sesja 2 (prawdziwy trening) nigdy nie trafia do `workouts`. Cicha utrata danych.

Źródło błędu to **nie** `operationId` (p. 1 działa poprawnie — propagacja klucza jest kompletna), a zerowanie rewizji przy DELETE, które otwiera okno, w którym zaległy, wyżej-rewizjonowany klient wygląda jak "nowszy" niż faktycznie nowa, świeżo utworzona sesja.

### Decyzja

**Wariant 1 (rewizja monotoniczna po DELETE) jako naprawa główna, wariant 3 (walidacja w `/api/workouts/complete` przy duplikacie) jako niezależna, tania druga warstwa (defense in depth).** Wariant 2 (klient przejmuje rewizję z odpowiedzi serwera) jest **częścią realizacji wariantu 1** — serwer musi zwrócić nową rewizję, a klient musi ją zapisać, zamiast zakładać 0 lokalnie; nie jest samodzielną alternatywą, bo bez zmiany po stronie serwera (rewizja wciąż liczona od 0 po realnym usunięciu wiersza) klient nie ma skąd wziąć wyższej wartości.

Odrzucony wariant: wiersz-"nagrobek" w osobnej tabeli/kolumnie `tombstoneRevision` niezależnej od `activeWorkoutSessions`. Odrzucony, bo `userId` już jest kluczem głównym tej tabeli — **nie trzeba drugiego miejsca pamiętającego rewizję**; wystarczy nigdy nie usuwać wiersza fizycznie, tylko nadpisywać go "wygaszonym" payloadem z rewizją `+1`. Mniej kodu, mniej stanu, ten sam efekt.

### Projekt

**1. `lib/active-workout-cloud.ts` — nowa, współdzielona stała (backend + istniejące testy):**
```ts
/**
 * Payload „wygaszonej” sesji — zapisywany w miejsce fizycznego DELETE (005, B-1b),
 * żeby rewizja w `activeWorkoutSessions` nigdy nie wracała do zera. `hasActiveLocalSession`
 * dla tego payloadu zawsze zwraca false, więc GET nigdy go nie wznowi jako aktywną sesję.
 */
export const ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD: ActiveWorkoutCloudPayload = {
  startedAt: null,
  pausedElapsedSeconds: 0,
  workoutStartedAtMs: null,
  operationId: null,
  title: "",
  workoutPlanId: null,
  cardioMinutes: 0,
  exercises: [],
  selectedExerciseId: null,
};
```
Eksportowana z `lib/`, bez `"use client"` — używana tylko po stronie serwera (route handler), zgodnie z istniejącym podziałem plików tego modułu (typy + czyste funkcje, zero zależności od DOM/store).

**2. `app/api/active-workout-session/route.ts` — `handleDELETE` nie usuwa wiersza, tylko go "wygasza" z rewizją o +1:**
```ts
async function handleDELETE(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(/* bez zmian */);
  if (!rl.ok) { /* bez zmian */ }

  await ready();
  const db = getDb();
  const userId = session.user.id;

  const [existing] = await db
    .select({ revision: activeWorkoutSessions.revision })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  // Brak wiersza — nic do wygaszenia; kolejny PUT i tak zacznie od rewizji 1 (brak historii do chronienia).
  if (!existing) {
    return NextResponse.json({ ok: true, revision: 0 });
  }

  // Rewizja NIGDY nie wraca do zera po usunięciu (005, B-1b) — inkrementacja, nie reset,
  // żeby żaden zaległy klient z niższą-lub-równą rewizją nie mógł już nadpisać nowej sesji.
  const nextRevision = existing.revision + 1;
  await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD),
      revision: nextRevision,
      updatedAt: new Date(),
    })
    .where(eq(activeWorkoutSessions.userId, userId));

  return NextResponse.json({ ok: true, revision: nextRevision });
}
```
Wiersz `activeWorkoutSessions` dla danego użytkownika **nigdy nie jest fizycznie usuwany** przez ten endpoint — tylko nadpisywany wygaszonym payloadem. To jest bezpieczne, bo `userId` jest kluczem głównym (nie rośnie liczba wierszy w tabeli), a `GET` (p. 3 niżej) już i tak traktuje wygaszony/pusty payload jak `session: null`.

**3. `handleGET` — ta sama zasada przy czyszczeniu "ducha" po przeterminowaniu (`route.ts:67-77`):** dziś ta gałąź robi `db.delete(...)` dla nieświeżego/niepoprawnego wiersza. Dla pełnej konsekwencji (ten sam mechanizm obrony co DELETE, nie dwa różne), zamienić na tę samą operację "wygaszenia z inkrementacją rewizji" zamiast fizycznego usunięcia:
```ts
if (!payload || !hasActiveLocalSession(payload) || !isActiveWorkoutCloudFresh(updatedAt)) {
  await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD),
      revision: row.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(activeWorkoutSessions.userId, session.user.id));
  return NextResponse.json({ ok: true, session: null });
}
```
Bez tej zmiany dodatkowej, naprawa w p. 2 byłaby obchodzona po 24 h (`ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS`): zaległy klient z wysoką rewizją, który odczeka ponad dobę nieaktywności, nadal trafiłby na fizycznie usunięty wiersz i rewizję od zera. Koszt zmiany: zero nowych zapytań (już jest `UPDATE`/`DELETE` w tym miejscu), tylko inny rodzaj operacji.

**4. `components/active-workout/active-workout-cloud-sync.tsx` — `deleteCloud()` przejmuje rewizję z odpowiedzi serwera, nie zakłada 0:**
```ts
async function deleteCloud(): Promise<boolean> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "DELETE",
    credentials: "include",
    headers: { ...getXsrfHeaders() },
  });
  if (!res.ok) return false;
  let json: { ok?: boolean; revision?: number } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* empty body na edge-case'ach keepalive — rewizja zostaje bez zmian, kolejny push/pull naprawi */
  }
  if (typeof json.revision === "number" && json.revision >= 0) {
    writeRevision(json.revision);
  }
  return true;
}
```
To usuwa `writeRevision(0)` całkowicie z tej funkcji — lokalna rewizja po DELETE jest teraz tym, co faktycznie zwrócił serwer (`existing.revision + 1`), nigdy sztywnym zerem. Reszta `active-workout-cloud-sync.tsx` (wywołania `deleteCloud()` w `push()`) nie zmienia się — kontrakt zwracanego `boolean` jest zachowany.

**5. Defense in depth — `app/api/workouts/complete/route.ts`, walidacja przy znalezionym "duplikacie" (wariant 3, niezależna warstwa):**

Dzisiejsze `respondWithExistingWorkout` (`route.ts:302-339`) zakłada, że znaleziony wiersz po `operationId` to zawsze prawdziwy retry tego samego zapisu. Po naprawie B-1b to założenie jest *w zasadzie* bezpieczne (scenariusz, który je łamał, jest zamknięty w p. 2-4), ale kolizja identyfikatora operacji innym mechanizmem (błąd klienta, przyszła regresja, inny bug w cloud-sync) nie jest niemożliwa do wyobrażenia — a koszt sprawdzenia jest jednym porównaniem liczb, które serwer już liczy. Dodać porównanie `startedAt` żądania z `startedAt` zapisanego wiersza:
```ts
async function respondWithExistingWorkout(
  db: ReturnType<typeof getDb>,
  userId: string,
  existingRow: { id: string; exercises: string; date: string; workoutPlanId: string | null },
  requestedStartedAtMs: number, // NOWY parametr — startedAt z bieżącego żądania POST
) {
  const existingParsed = parseCompletedWorkout(existingRow.exercises);
  const title = /* bez zmian */;
  const startedAtMs = /* bez zmian — startedAt zapisanego wiersza */;

  // Defense in depth (005, B-1b): operationId identyczny, ale startedAt różny o więcej niż
  // tolerancję zegara/zaokrąglenia -> to nie jest retry TEGO SAMEGO zapisu, to kolizja
  // identyfikatora między dwiema różnymi sesjami. Nie udawaj sukcesu — zwróć konflikt.
  if (Math.abs(startedAtMs - requestedStartedAtMs) > 2000) {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutOperationConflict, conflict: true },
      { status: 409 },
    );
  }

  const currentVol = /* bez zmian */;
  /* ... reszta bez zmian ... */
}
```
Wywołania `respondWithExistingWorkout` (dwa miejsca w `handlePOST`, `route.ts:447` i `:500`) dostają dodatkowy argument `currentStartedAtMs` (już policzony wcześniej w funkcji, `route.ts:452`, albo — dla wywołania przy wyścigu `INSERT`, które dziś jest przed obliczeniem `currentStartedAtMs` w kodzie — przenieść liczenie `startedAt.getTime()` na początek `handlePOST`, od razu po walidacji Zod, żeby było dostępne w obu miejscach wywołania bez duplikacji).

Tolerancja 2000 ms (nie dokładne `===`) dla zegara klienta/zaokrągleń przy serializacji JSON — `startedAt` jest liczbą ms z `Date.now()` po stronie klienta w momencie startu sesji, nie powinna się zmienić między próbami tego samego zapisu (store trzyma `workoutStartedAtMs` niezmienny po starcie), ale drobny margines jest bezpieczniejszy niż równość bitowa.

Nowy komunikat w `lib/user-facing-errors.ts`:
```ts
workoutOperationConflict:
  "Ten zapis nie zgadza się z wcześniejszą sesją o tym samym identyfikatorze. Odśwież stronę — jeśli trening nie jest w historii, zapisz go ponownie.",
```

### Pliki do zmiany — podział backend/frontend

**Backend**
- `lib/active-workout-cloud.ts` — nowa stała `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD` (eksport).
- `app/api/active-workout-session/route.ts` — `handleDELETE` (wygaszenie z inkrementacją rewizji zamiast `db.delete`), `handleGET` (ta sama zamiana w gałęzi "ghost/przeterminowana"), odpowiedź `DELETE` zwraca `revision`.
- `app/api/workouts/complete/route.ts` — `respondWithExistingWorkout` przyjmuje `requestedStartedAtMs`, porównanie z tolerancją 2000 ms, nowa odpowiedź 409 przy niezgodności; przekazanie argumentu w obu miejscach wywołania (`:447`, `:500`); ewentualne przeniesienie wyliczenia `startedAt.getTime()` wyżej w funkcji, jeśli potrzebne przed drugim wywołaniem.
- `lib/user-facing-errors.ts` — nowy komunikat `workoutOperationConflict`.

**Frontend**
- `components/active-workout/active-workout-cloud-sync.tsx` — `deleteCloud()` czyta `revision` z odpowiedzi i woła `writeRevision(json.revision)` zamiast `writeRevision(0)`.
- `components/active-workout/use-workout-finish-flow.ts` (lub `lib/workout-complete-submit.ts`, tam gdzie dziś obsługiwany jest `SubmitWorkoutResult`) — obsłużyć nową odpowiedź `{ ok: false, conflict: true }` z `/api/workouts/complete` jako stan `"error"` z komunikatem `workoutOperationConflict` (dziś kod już ma gałąź `"error"` dla `!ok`, więc to rozszerzenie istniejącego mapowania błędu, nie nowa gałąź stanu — do potwierdzenia przez `frontend`, czy `submitCompletedWorkout` już przekazuje `error` z body 409 do UI, czy trzeba dopisać rozpoznanie statusu 409 vs 4xx ogólne).

### Test regresji (wymagany, pokrywa dokładnie scenariusz testera)

**Nowy plik `app/api/active-workout-session/route.test.ts` (backend, harness `createMemoryDb` + mock `auth`/CSRF, już używany w tym repo dla innych route handlerów)** — minimalny zestaw:
1. `PUT` (A, rewizja 0) → `201`-ekwiwalent/`ok:true, revision:1`. `DELETE` (A) → `ok:true, revision:2` (nie `revision:0`). Kolejny `PUT` z `clientRevision: 0` (symulacja klienta, który nie zdążył zaktualizować lokalnej rewizji) → `409 conflict` (bo `0 < 2`), **nie** nadpisuje.
2. **Odtworzenie dokładnego scenariusza z sondy testera**: `PUT` sesja 1 pięć razy jako B (`clientRevision` rośnie do 5, serwer odpowiada rewizjami 1..5) → `DELETE` jako A (sesja 1 zakończona) → asercja: odpowiedź `DELETE` ma `revision: 6` (nie 0) → `PUT` jako A, sesja 2, `clientRevision: 0` → serwer **musi odpowiedzieć 409 conflict** (bo `0 < 6`), nie zapisać. A (po konflikcie) pociąga `GET`, dostaje aktualną rewizję (6) i payload wygaszony, i wysyła kolejny `PUT` sesji 2 z `clientRevision: 6` → `200 ok, revision:7`. Następnie zaległy `PUT` B z `clientRevision: 5` → **musi dostać 409 conflict** (bo `5 < 7`), sesja 2 **nie jest nadpisana**. To jest asercja, której brak pozwolił defektowi przejść sondę w sekcji 9.2 — test musi explicite sprawdzić `payload` zwrócony w ciele `409` i potwierdzić, że to wciąż sesja 2, nie sesja B.
3. `GET` wywołany dla przeterminowanego/niepoprawnego wiersza (`updatedAt` starsze niż `ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS`) zwraca `session: null`, a kolejny odczyt bezpośrednio z bazy (pomocniczy `select` w teście) pokazuje, że wiersz **wciąż istnieje** z rewizją wyższą niż przed wywołaniem (nie został fizycznie usunięty).

**Frontend — `lib/active-workout-cloud.test.ts` (rozszerzenie istniejącego pliku z p. 1)**: test `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD` — `hasActiveLocalSession(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD) === false`.

**Frontend — test `deleteCloud()`**: dziś ta funkcja jest prywatna w komponencie `"use client"`, bez eksportu (ta sama luka co `applyCloudPayload`, odnotowana w sekcji 9.2 raportu testera jako "B-1 (test)"). Zalecenie dla `frontend`: wyciągnąć `deleteCloud`, `putCloud`, `applyCloudPayload` do nieklienckiego modułu `lib/active-workout-cloud-client.ts` (czysta logika fetch + mapowanie odpowiedzi, bez `"use client"` na poziomie funkcji — plik może zostać importowany przez komponent kliencki bez problemu, Next 16 nie wymaga, by funkcje pomocnicze używane WYŁĄCZNIE po stronie klienta nosiły same znacznik `"use client"`, ten znacznik jest potrzebny tylko w pliku komponentu). To zamyka równocześnie uwagę "B-1 (test)" z backlogu testera (sekcja 9.8) — jedna zmiana, dwie pozycje zamknięte. Test: mock `fetch` zwracający `{ ok:true, revision: 6 }` → asercja `writeRevision`-odpowiadającego efektu (eksportować też `readRevision`/`writeRevision` z tego samego modułu, żeby test mógł zweryfikować zapisany `localStorage`).

### Konsekwencje i kompromisy

- Wiersz `activeWorkoutSessions` nigdy nie jest fizycznie usuwany przez te dwa handlery — to jest zamierzone i bezpieczne (PK = `userId`, brak przyrostu liczby wierszy), ale oznacza, że "pusta" sesja w bazie wygląda teraz jak każda inna poza `hasActiveLocalSession`. Czytelność: komentarz w kodzie (p. 2-3 wyżej) i w schemacie (`db/schema.ts`, dopisać przy `activeWorkoutSessions`, że wiersz żyje permanentnie na użytkownika, `DELETE` z `route.ts` nie usuwa go fizycznie) — do dodania przez `backend`.
- Rewizja rośnie bez końca (whole-number counter), nigdy się nie resetuje — brak ryzyka przelewu w praktyce (`integer`, SQLite `INTEGER` to 64-bit, dziesiątki tysięcy cykli start/koniec na użytkownika rocznie są nieszkodliwe).
- Wariant 3 (walidacja `startedAt` przy duplikacie) jest tanią siecią bezpieczeństwa, nie naprawą głową — jeśli kiedyś powstanie inny bug, który doprowadzi do kolizji `operationId` między dwiema realnymi sesjami o niemal identycznym `startedAt` (teoretycznie możliwe, choć mało prawdopodobne — dwie różne sesje tego samego użytkownika z tym samym UUID `operationId` i startem w oknie 2 s), walidacja nie wykryje problemu i zwróci fałszywy sukces tak jak dziś. To jest zaakceptowane ograniczenie — główna naprawa (p. 2-4) usuwa realny wektor; p. 5 jest dodatkiem, nie substytutem.
- Odrzucona alternatywa dla p. 5: porównanie całego JSON `exercises`/tonażu zamiast tylko `startedAt`. Odrzucona jako nadmiarowa — `startedAt` jest unikalnym, tanim w porównaniu polem, które już istnieje w obu strukturach (żądanie i zapisany wiersz), bez potrzeby parsowania/porównywania głębokich struktur ćwiczeń.

### Werdykt dodatku

**ZATWIERDZONE** — gotowe do implementacji. Warunek zamknięcia B-1b u `tester`: nowy test regresji z p. "Test regresji" wyżej (w szczególności krok 2, odtwarzający sondę) musi przejść, a `npm test`/`npx tsc --noEmit`/`npm run lint` bez nowych regresji. Przegląd architekta po implementacji **nie jest wymagany automatycznie** (zmiana jest wąska, zgodna z tym dodatkiem) — wywołać go tylko, jeśli `backend`/`frontend` zgłosi niepewność przy implementacji (np. co do przeniesienia `deleteCloud`/`applyCloudPayload` do `lib/`) albo `tester` znajdzie w teście regresji wynik niezgodny z projektem wyżej.

---

## Werdykt

**ZATWIERDZONE Z UWAGAMI.**

Projekt rozstrzyga oba wymogi blokujące merge (LR-3, LR-4) oraz wszystkie punkty 1-8 polecenia. Uwagi, które nie blokują etapu 4 (ux)/5 (implementacja), ale wymagają decyzji przed Promote:
1. Potwierdzenie przez `backend`, czy Android wywołuje `/api/workouts/complete` bezpośrednio — jeśli tak, pole `operationId` wymagane w schemacie wymaga wersjonowania API przed Promote (p. 9).
2. Zachowanie unikalnego indeksu z `NULL` na libSQL/Turso do zweryfikowania empirycznie przed merge (p. 11).
3. Parytet Java jest świadomie ograniczony (p. 9) — wymaga wpisu w backlogu, nie bloku tego zadania, bo ścieżka produkcyjna dziś biegnie przez TypeScript.

**Dodatek p. 12 (B-1b, 2026-10-25): ZATWIERDZONE**, gotowy do implementacji przez `backend`/`frontend` (etap 5), bez powtórnego przeglądu architekta poza wyjątkiem opisanym w werdykcie dodatku.

**Status p. 12 po finalnej weryfikacji (etap 7c, 2026-10-25): naprawa serwerowa zamknięta (sekcja test. 10.2), ale wprowadziła B-1c i B-1d (blokujące) po stronie klienta/GET-ghost. Patrz p. 13 — p. 12 jest tam częściowo skorygowany (GET-ghost), a warstwa `operationId` w payloadzie chmury, którą p. 12 miał chronić, jest w p. 13 usunięta jako niepotrzebna.**

---

## 13. Pivot — deterministyczny `operationId`, korekta p.12 po trzecim odrzuceniu (etap 7c → 3)

- Status: zaproponowany
- Data: 2026-10-25
- Wejście: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 10 (B-1c, B-1d, sondy), ten ADR p. 1 i p. 12, polecenie koordynatora po trzecim odrzuceniu etapu 7
- Werdykt skrócony: **ZATWIERDZONE Z UWAGAMI — nie w kształcie zaproponowanym w poleceniu.** Deterministyczny `operationId` jest solidny i wart przyjęcia, ale **pełny rewers p.12 (fizyczny `DELETE`, `writeRevision(0)`) jest wadą dyskwalifikującą** — patrz p. 13.1. Zamiast tego: przyjąć deterministyczny `operationId` (usuwa warstwę, która faktycznie była krucha) **i naprawić B-1c/B-1d wąskimi korektami logiki w mechanizmie rewizji z p.12, który zostaje** (nie jest to „kolejna łatka na tym samym fundamencie” w sensie dodania nowej warstwy — to poprawka błędu nadmiernego wyzwalania wprowadzonego przez p.12, w mechanizmie, który chroni inny, odrębny problem niż `operationId`).

### 13.1 Weryfikacja podejścia — gdzie polecenie się myli

**Stabilność `startedAtMs` (zweryfikowane, podejście solidne pod tym względem):**
- `lib/stores/active-workout.ts`, `start()`: `workoutStartedAtMs: s.workoutStartedAtMs ?? Date.now()` — ustawiane raz, przy pierwszym `Start`; `stopTimer()`/kolejne `start()` (Wznów) nie nadpisują niezerowej wartości. Reset tylko przez `applyPlan()`/`reset()` (nowa sesja).
- `lib/active-workout-cloud-client.ts`, `applyCloudPayload()`: kopiuje `workoutStartedAtMs` wprost z payloadu chmury, nie generuje nic lokalnie. Czyli urządzenie B, które wznawia sesję z chmury, dostaje TĘ SAMĄ wartość co urządzenie A — determinizm trzyma się na warstwie, która już działa poprawnie (nie jest to nowe ryzyko).
- Kolejność w `lib/start-workout-session.ts` (`beginWorkoutFromPlanRow`) i `active-workout-view.tsx` (`beginWorkoutFromPlan`): `applyPlan()` zawsze bezpośrednio przed `start()` — żadna ścieżka nie ustawia `exercises`/`sets` bez wcześniejszego `start()`. `workoutStartedAtMs` jest więc niezerowe w każdym punkcie, w którym użytkownik mógłby zapisać trening, poza jednym udokumentowanym już wyjątkiem migracji (`migrate()` w store — sesje z wersji store sprzed tego pola; dotyczy tylko bardzo starych, zawieszonych sesji, nie nowego kodu).
- Fallback w `use-workout-finish-flow.ts:75` (`store.workoutStartedAtMs ?? store.startedAt ?? endedAt`) istnieje dla pola `startedAt` **wysyłanego w żądaniu** (data treningu / „vs ostatnio”), nie jest to coś nowego wprowadzanego tym pivotem — ale **funkcja wyliczająca `operationId` powinna czytać `workoutStartedAtMs` z tego samego łańcucha fallbacków** (nie samego pola store), żeby nie rozjeżdżać się z wartością `startedAt` wysyłaną w payloadzie przy rzadkiej, zdegradowanej sesji (patrz p.13.3, uwaga przy implementacji).
- Kolizja ms między dwiema RÓŻNYMI sesjami: niemożliwa w normalnym użyciu (jedna karta: `Date.now()` przy kolejnym `start()` zawsze później niż poprzedni `reset()`; dwa urządzenia: dwie niezależnie wystartowane sesje tego samego planu w tej samej milisekundzie zegara to teoretyczne zero w praktyce — a nawet gdyby się zdarzyło, to są to faktycznie dwie próby zapisania „tego samego zdarzenia” w granicach tolerancji 2000 ms z p.12.5, więc degraduje się do istniejącej, zaakceptowanej warstwy defense-in-depth, nie do nowego ryzyka).
- Przewidywalność/enumeracja: `operationId` nie jest nigdzie używany jako sekret/token autoryzacji (zweryfikowane grep — jedyne użycia to klucz dedup w `workouts` i pole żądania/odpowiedzi API); unikalność i tak jest wymuszana razem z `userId` przez indeks `(userId, operationId)` (p.1) — **`userId` nie musi wchodzić do funkcji skracającej** (patrz p.13.3, uprasza implementację po stronie klienta, zero potrzeby przekazywania `session.user.id` do czystej funkcji w `lib/`).

**Wada dyskwalifikująca pełny rewers p.12 (polecenie, krok 2) — zweryfikowana czytaniem kodu:**

B-1c i B-1d **nie są objawem kruchości warstwy `operationId`** — są regresją w mechanizmie synchronizacji **całego payloadu** sesji aktywnej (`activeWorkoutSessions`: `exercises`, `startedAt`, `workoutStartedAtMs`, `cardioMinutes` itd.), który chroni **inny, odrębny problem**: żeby zaległy klient z wyższą rewizją nie nadpisał świeżo utworzonej sesji innego urządzenia/karty. To jest problem p.12 sekcja 9.2 ("Scenariusz B") — i był **obecny w `HEAD`, przed samym p.12** (potwierdzone w sekcji 9.2 raportu testera: „Serwer... nie zmieniły się względem `5aa8209`, więc defekt jest pre-istniejący"). Mechanizm `operationId` nie bierze w tym udziału — żadna z dwóch analiz B-1c/B-1d (sekcja 10.3 raportu testera) nie wymienia `operationId` jako przyczyny; obie są wyłącznie o `revision`/`DELETE`/`GET`-ghost.

**Co by się stało przy pełnym rewersie (polecenie, krok 2) — czytając kod krok po kroku:**
Przywrócenie `writeRevision(0)` po `DELETE` i fizycznego `db.delete(...)` w `handleDELETE`/`handleGET`-ghost odtwarza **dokładnie** scenariusz z sekcji 9.2 ADR p.12 (opisany tam jako pierwotna przyczyna B-1b): zaległe urządzenie B z rewizją 5 nadpisuje świeżo utworzoną sesję 2 urządzenia A całym payloadem (nie tylko `operationId` — **całym stanem**: `exercises`, `cardioMinutes`, `workoutStartedAtMs`). Dalej: `push()` w `active-workout-cloud-sync.tsx` przy odpowiedzi `409 conflict` **bezwarunkowo** woła `applyCloudPayload(result.conflict.payload)` — czyli nadpisuje **żywy, lokalny stan store'a** urządzenia A (nie tylko wiersz w chmurze) payloadem z sesji B. Niezależnie od tego, czy `operationId` jest losowy czy deterministyczny, w tym momencie urządzenie A **traci realne, zapisane przez użytkownika serie** sesji 2 — bo cały obiekt `exercises` w jego własnym store zostaje zastąpiony pustym/starym stanem z sesji 1. To jest **poważniejsza utrata danych niż dzisiejsze B-1c/B-1d** (te dotyczą sesji dopiero zaczynanej/bezczynnej karty; rewers p.12 reotwiera utratę sesji **w trakcie wykonywania, z zapisanymi seriami**).

**Wniosek**: krok 2 polecenia („REWERS zmian z ADR p.12 z powrotem do stanu SPRZED B-1b") jest niebezpieczny i **odrzucony**. Deterministyczny `operationId` elegancko zamyka **oryginalny, wąski problem B-1** (rozjazd klucza idempotencji między urządzeniami przy wznowieniu — p.1/p.12 sekcja 9.2 w części dotyczącej `operationId`), ale nie zastępuje potrzeby chronienia **ogólnego payloadu** sesji aktywnej przed nadpisaniem przez zaległego klienta — to jest wymóg niezależny od tego, jak liczony jest `operationId`.

### 13.2 Co faktycznie powoduje B-1c i B-1d (odrębna diagnoza, nie „kolejna warstwa na tym samym fundamencie")

Obie regresje są **nadmiernym wyzwalaniem** operacji wprowadzonych przez p.12, nie dowodem, że sam mechanizm (nigdy nie resetuj rewizji do zera) jest błędny:

- **B-1c**: `active-workout-cloud-sync.tsx:152`, `if (readRevision() > 0)` jako warunek wysłania `DELETE`. Przed p.12 ten warunek miał sens („rewizja > 0 = jest coś do usunięcia po stronie serwera"), bo po `DELETE` rewizja lokalna wracała do 0. Po p.12 rewizja po `DELETE` jest zawsze ≥ 1 (bo serwer ją inkrementuje i klient to przejmuje) — więc warunek jest **zawsze prawdziwy** po pierwszym zakończonym treningu, na zawsze, i każdy tick interwału (8 s) na bezczynnej karcie wysyła kolejny `DELETE`. To nie jest wada mechanizmu rewizji — to jest warunek klienta, który **stracił sens** po tym, jak zmieniła się semantyka rewizji po `DELETE`, i nikt go nie zaktualizował.
- **B-1d**: `handleGET` w `app/api/active-workout-session/route.ts`, gałąź „ghost" — bumpuje rewizję i zapisuje wygaszony payload **przy każdym odczycie**, niezależnie od tego, czy wiersz był już wygaszony (bo poprzedni `DELETE`/GET już to zrobił) czy był aktywny-ale-przeterminowany (prawdziwy ghost po nieudanym `DELETE`, oryginalny cel tej gałęzi). To są dwa różne przypadki potraktowane jedną gałęzią kodu — poprawka to rozróżnienie ich, nie usunięcie ochrony.

Żadna z tych poprawek nie dodaje nowej warstwy na mechanizmie rewizji — obie **zwężają** warunek wyzwalający operację, która i tak już istnieje, do przypadków, w których jest faktycznie potrzebna. To odróżnia tę korektę od „kolejnej łatki": nie dodajemy nowego stanu, nowego pola, nowej heurystyki; naprawiamy warunek brzegowy w istniejącej logice.

### 13.3 Projekt — pliki do zmiany

**A. Usunięcie `operationId` jako stanu synchronizowanego przez chmurę (realizacja pivotu)**

1. **Nowy plik `lib/workout-operation-id.ts`** (czysta funkcja, bez `"use client"`, działa w Node ≥20 i w przeglądarce — `crypto.subtle` jest globalne w obu; `package.json` wymaga `node >= 20"`):
   ```ts
   /**
    * Klucz idempotencji zapisu treningu (ADR 0004 p.13, pivot po B-1c/B-1d).
    * Wyliczany deterministycznie z (workoutPlanId, startedAtMs) — NIE generowany
    * losowo i NIE synchronizowany jako stan przez chmurę. Dwa urządzenia wznawiające
    * tę samą logiczną sesję mają już ten sam `workoutStartedAtMs` (kopiowany wprost
    * przez `applyCloudPayload`, bez udziału tej funkcji) — więc wyliczają ten sam klucz
    * NIEZALEŻNIE, bez żadnej komunikacji. Nowa sesja (`start()`) dostaje nowy
    * `workoutStartedAtMs`, więc automatycznie nowy klucz — bez osobnej logiki
    * "regeneruj tylko przy nowym starcie" (ta logika, `ensureOperationId` w store,
    * jest usuwana razem z polem `operationId` ze store).
    *
    * `userId` NIE wchodzi do klucza: unikalność jest wymuszana razem z `userId`
    * przez indeks `(userId, operationId)` w `workouts` (ADR p.1) — dodanie go tu
    * tylko skomplikowałoby wywołanie z klienta (trzeba by przekazywać
    * `session.user.id` do czystej funkcji w `lib/`) bez żadnej korzyści.
    *
    * Format: UUID v5 (RFC 4122, SHA-1, stała przestrzeń nazw) — zgodny bez zmian
    * z `z.string().uuid()` w `/api/workouts/complete` i z kontraktem Androida.
    */
   const NAMESPACE_HEX = "a1f1a0a0-6f2e-5f0a-9c1b-0b7b7c2b9b11"; // stała aplikacji, bez znaczenia bezpieczeństwa

   export async function deriveWorkoutOperationId(
     workoutPlanId: string | null,
     startedAtMs: number,
   ): Promise<string> {
     const name = `${workoutPlanId ?? "none"}:${Math.round(startedAtMs)}`;
     const namespaceBytes = hexToBytes(NAMESPACE_HEX.replace(/-/g, ""));
     const nameBytes = new TextEncoder().encode(name);
     const data = new Uint8Array(namespaceBytes.length + nameBytes.length);
     data.set(namespaceBytes, 0);
     data.set(nameBytes, namespaceBytes.length);
     const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data));
     const bytes = digest.slice(0, 16);
     bytes[6] = (bytes[6] & 0x0f) | 0x50; // wersja 5
     bytes[8] = (bytes[8] & 0x3f) | 0x80; // wariant RFC 4122
     const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
     return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
   }

   function hexToBytes(hex: string): Uint8Array {
     const out = new Uint8Array(hex.length / 2);
     for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
     return out;
   }
   ```
   Alternatywa odrzucona: `z.string().min(16).max(128)` zamiast formatu UUID (propozycja z polecenia). Odrzucona — format UUID v5 trzyma kontrakt `/api/workouts/complete`, Android i Javę **bez żadnej zmiany schematu**, kosztem ~15 linii czystej funkcji. Słabszy, niekryptograficzny hasz (np. prosty FNV) był też rozważony i odrzucony — `crypto.subtle.digest` jest globalne, darmowe do użycia, a SHA-1 w UUID v5 jest ustandaryzowanym, czytelnym dla każdego, kto znajdzie ten kod, wzorcem (nie wynajdujemy własnego formatu).

2. **`lib/stores/active-workout.ts`** — usunąć: pole `operationId`, akcję `ensureOperationId()`, generowanie w `start()` (linia `operationId: s.operationId ?? crypto.randomUUID()`), czyszczenie w `applyPlan()`/`reset()`, wpis w `partialize`, specjalny przypadek w `migrate()` (`typeof p.operationId !== "string"`). Podbić `version` z 3 na 4 (zmiana kształtu persystowanego stanu — zgodnie z istniejącym wzorcem `migrate()` w tym pliku); nowy `migrate()` dla v3→v4 może po prostu zostawić ewentualny stary klucz `operationId` w obiekcie nietypowanym (zustand/persist i tak go zignoruje, bo nie jest w typie `ActiveWorkoutState`) — bez specjalnej obsługi.
3. **`lib/active-workout-cloud.ts`** — usunąć pole `operationId` z `ActiveWorkoutCloudPayload`, z walidatora `isActiveWorkoutCloudPayload`, z `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD`.
4. **`lib/active-workout-cloud-client.ts`** — usunąć linię `operationId: payload.operationId ?? null` z `applyCloudPayload()`.
5. **`lib/active-workout-persist.ts`** — usunąć `operationId: s.operationId` z `snapshotActiveWorkoutPayload()`.
6. **`components/active-workout/use-workout-finish-flow.ts`** — zamienić `const operationId = store.ensureOperationId();` na:
   ```ts
   const operationId = await deriveWorkoutOperationId(
     store.workoutPlanId,
     store.workoutStartedAtMs ?? store.startedAt ?? endedAt,
   );
   ```
   (ten sam łańcuch fallback co już istnieje dla pola `startedAt` wysyłanego w żądaniu, linia obok — żeby `operationId` i `startedAt` w jednym żądaniu zawsze odpowiadały tej samej wartości czasu, nawet w zdegradowanym przypadku). Import `deriveWorkoutOperationId` z nowego modułu. Diagnostyczny `console.warn` przy `duplicate: true` na pierwszej próbie (linia ok. 103) **zostaje** — nadal ma sens jako sygnał nieoczekiwanej kolizji (teraz: albo bug gdzie indziej, albo rzadka kolizja ms między dwiema różnymi sesjami, p.13.1).
   **Bez zmian**: `app/api/workouts/complete/route.ts` (schemat `operationId: z.string().uuid()`), Java (`CompleteWorkoutRequest.operationId`), `lib/workout-outbox-db.ts` (`PendingWorkoutPayload.operationId: string` — kształt pola się nie zmienia, zmienia się tylko to, jak jest wyliczane przed wysłaniem/zakolejkowaniem).

**B. Korekta p.12 (B-1c, B-1d) — zwężenie warunków, mechanizm rewizji zostaje**

7. **`app/api/active-workout-session/route.ts`, `handleGET`** — rozróżnić „już wygaszony" od „aktywny, ale przeterminowany" (B-1d):
   ```ts
   if (!payload) {
     // Wiersz uszkodzony/nieparsowalny — wygaś i zgłoś jako brak sesji.
     await clearRow(db, session.user.id, row.revision);
     return NextResponse.json({ ok: true, session: null });
   }
   if (!hasActiveLocalSession(payload)) {
     // Już wygaszony (DELETE/poprzedni GET) — czysty odczyt, bez mutacji, bez bumpa
     // rewizji (005, B-1d: odczyt NIE MOŻE być operacją z efektem ubocznym).
     return NextResponse.json({ ok: true, session: null });
   }
   if (!isActiveWorkoutCloudFresh(updatedAt)) {
     // Prawdziwy ghost: aktywny payload, ale przeterminowany (nieudany DELETE
     // w przeszłości) — to jest jedyny przypadek, w którym GET ma prawo mutować
     // (oryginalny cel tej gałęzi, zachowany z p.12).
     await clearRow(db, session.user.id, row.revision);
     return NextResponse.json({ ok: true, session: null });
   }
   return NextResponse.json({ ok: true, session: { payload, revision: row.revision, deviceId: row.deviceId, updatedAt } });
   ```
   (`clearRow` — mała pomocnicza funkcja wydzielona z dzisiejszego ciała `if`, używana też w `handleDELETE`, żeby nie duplikować `UPDATE ... SET payloadJson = CLEARED, revision = revision + 1`.)
8. **`components/active-workout/active-workout-cloud-sync.tsx`** — B-1c: zamienić wartownik `readRevision() > 0` na jednorazowy ref, niezależny od wartości rewizji:
   ```ts
   const clearedPushedRef = useRef(false);
   // w push():
   if (!hasActiveLocalSession(payload)) {
     if (clearedPushedRef.current) return; // już wysłane raz dla tego przejścia aktywna→pusta
     clearedPushedRef.current = true;
     pushingRef.current = true;
     try {
       const ok = await deleteCloud();
       if (!ok) clearedPushedRef.current = false; // spróbuj ponownie przy następnym ticku
     } finally { pushingRef.current = false; }
     return;
   }
   clearedPushedRef.current = false; // sesja znów aktywna — jedno DELETE przy następnym opróżnieniu
   ```
   B-1d (warstwa klienta, defense in depth obok poprawki #7 serwera — na wypadek starego klienta wobec nowego serwera podczas wdrożenia, albo odwrotnie): w obsłudze `result.conflict` w `push()`, nie stosować payloadu konfliktu, jeśli lokalna sesja jest aktywna, a payload konfliktu nie jest:
   ```ts
   if (result.conflict) {
     if (!hasActiveLocalSession(result.conflict.payload)) {
       // Pusty/wygaszony stan w chmurze nie wygrywa z aktywną sesją lokalną (005, B-1d) —
       // przejmij tylko rewizję i wypchnij ponownie lokalny stan.
       writeRevision(result.conflict.revision);
       pendingPushRef.current = true;
     } else {
       applyCloudPayload(result.conflict.payload);
       writeRevision(result.conflict.revision);
       setBanner(t("session.cloudUpdated"));
       window.setTimeout(() => setBanner(null), 4000);
     }
   }
   ```
9. **Bez zmian**: `handleDELETE` (mechanizm „wygaszenia z inkrementacją" zostaje identyczny jak w p.12 — to jest poprawny, potrzebny mechanizm, problem był tylko w kliencie, który źle interpretował jego efekt, i w `GET`, które go nadużywało).
10. **Bez zmian**: `app/api/workouts/complete/route.ts`, `respondWithExistingWorkout` — tolerancja `startedAt` ±2000 ms zostaje jako tania druga warstwa (polecenie p.3, potwierdzone — teraz jeszcze mniej prawdopodobna do trafienia, bo kolizja `operationId` wymaga identycznego `(workoutPlanId, startedAtMs)`, a nie tylko przypadkowego UUID).

### 13.4 Testy regresji wymagane

**Nowy `lib/workout-operation-id.test.ts`:**
- Determinizm: dwa wywołania z tym samym `(workoutPlanId, startedAtMs)` → identyczny wynik.
- Różny `startedAtMs` lub różny `workoutPlanId` (w tym `null`) → różny wynik.
- Format wyjścia przechodzi `z.string().uuid()` (import schematu z `zod` w teście, albo regex UUID).
- **Test wymagany przez polecenie koordynatora** — dwa „urządzenia" symulowane bez żadnej komunikacji: 
  ```ts
  it("dwa urządzenia liczą ten sam operationId bez komunikacji między sobą", async () => {
    const planId = "plan-1";
    const startedAtMs = 1_700_000_000_000;
    const deviceA = await deriveWorkoutOperationId(planId, startedAtMs);
    const deviceB = await deriveWorkoutOperationId(planId, startedAtMs); // osobne wywołanie, zero stanu współdzielonego
    expect(deviceA).toBe(deviceB);
  });
  ```

**Aktualizacja istniejących testów (usunięcie asercji o `operationId` jako stanie synchronizowanym):**
- `lib/active-workout-cloud.test.ts` — usunąć asercje o polu `operationId` w payloadzie/walidatorze/`ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD`.
- `lib/active-workout-cloud-client.test.ts` — usunąć testy „zachowuje operationId" / „payload wygaszony czyści operationId" (p. 50-85 obecnego pliku); **dodać** test B-1d: `push`-podobna logika konfliktu (wydzielić decyzję do małej czystej funkcji, np. `shouldApplyConflictPayload(local, conflictPayload): boolean`, testowalnej bez DOM) — `false`, gdy lokalny payload jest aktywny i payload konfliktu nie jest; `true` w przeciwnym razie.
- `lib/active-workout-persist.test.ts` — usunąć asercje o `operationId` w snapshotcie.
- `components/active-workout/use-workout-finish-flow.test.ts` — zamienić asercje o `store.operationId` na asercje o wartości zwróconej przez `deriveWorkoutOperationId` (ten sam wynik przy `retry()`, bo funkcja jest deterministyczna — test „Spróbuj ponownie wysyła ten sam `operationId`" zostaje, ale bez odwołania do pola store, które już nie istnieje).
- `app/api/active-workout-session/route.test.ts` — **dodać**: GET na już wygaszonym wierszu nie zmienia `revision`/`updatedAt` w bazie (żadnego `UPDATE`) — asercja przez bezpośredni odczyt po dwóch kolejnych GET; GET na aktywnym, ale przeterminowanym (`updatedAt` > 24h) wiersza wciąż bumpuje i wygasza (zachowanie z p.12 nienaruszone).
- `lib/stores/active-workout.test.ts` (jeśli istnieje — do potwierdzenia przez `frontend`) — usunąć testy `ensureOperationId`/generowania w `start()`.

### 13.5 Ryzyka resztkowe i kompromisy

- Logika B-1c (jednorazowy `clearedPushedRef`) żyje w komponencie `"use client"` (`active-workout-cloud-sync.tsx`) — ten sam ograniczenie testowe jak reszta tego komponentu (brak `jsdom`/`@testing-library/react` w repo, patrz raporty testera etap 7/7b/7c). Pokrycie: sonda jednorazowa (jak w poprzednich rundach testera, plik usuwany po przebiegu) + E2E (D-07, już w backlogu). To jest zaakceptowane ograniczenie testowe tego repo, nie nowe dla tej zmiany.
- Fallback `store.workoutStartedAtMs ?? store.startedAt ?? endedAt` przy wyliczaniu `operationId` (p.13.3 krok 6) dziedziczy istniejące, już zaakceptowane ryzyko tego łańcucha (opisane w store `migrate()`) — dotyczy tylko sesji wznowionych z wersji store sprzed tego pola; nie jest nowym ryzykiem wprowadzonym tym pivotem.
- Usunięcie `operationId` z payloadu chmury jest zmianą kompatybilną do przodu i do tyłu bez migracji danych: istniejące wiersze `activeWorkoutSessions` w bazie mają w `payloadJson` zapisane stare payloady z polem `operationId` — `isActiveWorkoutCloudPayload` (nowa wersja, bez wymogu tego pola) je nadal poprawnie parsuje (pole dodatkowe w JSON jest po prostu ignorowane przy odczycie przez nowy typ TS); nie jest wymagana migracja bazy.
- Rozjazd wdrożeniowy (stary klient / nowy serwer lub odwrotnie) podczas Preview→Promote: stary klient nadal wysyła `operationId` w payloadzie PUT — nowy serwer go po prostu zapisze i zignoruje (nie czyta go z payloadu nigdzie w logice serwera dla `/api/active-workout-session`); nowy klient nie wysyła `operationId` — stary serwer (jeśli oba żyją chwilowo, co w modelu Vercel nie powinno się zdarzyć dla jednego route handlera, ale dla pewności) też nie ma z tym problemu, bo `operationId` był tam zawsze opcjonalny (`operationId?: string | null`). Brak okna niezgodności.

### 13.6 Werdykt p.13

**ZATWIERDZONE Z UWAGAMI** w zakresie: (a) deterministyczny `operationId` wg projektu p.13.3.A — gotowy do implementacji; (b) korekta B-1c/B-1d wg projektu p.13.3.B — gotowa do implementacji. **ODRZUCONE**: pełny rewers mechanizmu rewizji z p.12 (polecenie, krok 2, w części „fizyczny `DELETE`, `writeRevision(0)`") — zastąpiony korektą p.13.3.B, która zachowuje ochronę ogólnego payloadu sesji.

Warunek zamknięcia u `tester`: wszystkie testy z p.13.4 przechodzą, w tym explicite test „dwa urządzenia bez komunikacji" i test „GET na już wygaszonym wierszu nie mutuje bazy"; `npm test`, `npx tsc --noEmit`, `npm run lint` bez nowych regresji; sonda na scenariusz z sekcji 9.2/10.3 (B-1b/B-1c/B-1d) powtórzona i czysta. Przegląd architekta po implementacji **nie jest wymagany automatycznie** — tylko w wyjątku z `przeplyw.md` (niepewność backend/frontend, albo `tester` znajdzie defekt wskazujący na problem strukturalny inny niż te już opisane tutaj).

---

## 14. Naprawa N-P13-1 — tożsamość tombstone (etap 7d → 3)

- Status: zaproponowany
- Data: 2026-10-25
- Wejście: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 11.6, 11.8 (defekt N-P13-1, sonda P4, werdykt tester etapu 7d: ODRZUCONE), ten ADR p.12-13 (mechanizm wygaszania/rewizji, który zostaje)

### 14.1 Problem (powtórzenie diagnozy testera, zweryfikowane czytaniem kodu)

`shouldApplyConflictPayload` (`lib/active-workout-cloud-client.ts:61-69`) i wywołanie w `push()` (`components/active-workout/active-workout-cloud-sync.tsx:188-199`) rozstrzygają konflikt 409 wyłącznie na podstawie `hasActiveLocalSession()`: lokalna sesja aktywna + payload konfliktu pusty/wygaszony → **zawsze** „lokalna wygrywa" (zachowuje lokalny stan, wypycha go ponownie, `pendingPushRef = true`). To jest poprawne dla naprawy B-1d (świeżo startowana sesja na jednym urządzeniu nie może zostać skasowana przez wygaszony wiersz, który zostawiło inne/to samo urządzenie po zakończeniu *innego* treningu), ale błędne, gdy lokalna „aktywna" sesja na tym urządzeniu jest **tą samą** sesją, która została właśnie wygaszona gdzie indziej (np. zakończona na urządzeniu A, zanim urządzenie B zdążyło się zsynchronizować). W tym drugim przypadku „lokalna wygrywa" wskrzesza martwą sesję na B, B ją przejmuje, a jeśli użytkownik dopisze serie i zakończy trening, `respondWithExistingWorkout` (`app/api/workouts/complete/route.ts:446-457`, tolerancja ±2000 ms wokół `startedAt`, p.12 pkt 5) scala to po cichu z istniejącym zapisem **bez `UPDATE`** — nowe serie giną bez sygnału błędu w UI (sonda P4, sekcja 11.6 raportu testera).

Przyczyna: wygaszony payload (`ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD`, p.12) nie niesie **żadnej tożsamości** tego, co wygasił — jest identyczny niezależnie od tego, która sesja została zakończona. `shouldApplyConflictPayload` nie ma więc jak odróżnić „to tombstone mojej własnej, już zakończonej sesji" od „to tombstone jakiejś zupełnie innej, nieistotnej sesji".

### 14.2 Decyzja

Wygaszony payload niesie tożsamość sesji, którą wygasił: nowe pole `clearedSessionStartedAtMs: number | null` — `workoutStartedAtMs` sesji aktywnej w momencie wygaszenia; `null`, gdy wygaszano wiersz pusty/nieparsowalny (nie ma czyjej tożsamości do zapisania). `shouldApplyConflictPayload` porównuje lokalne `workoutStartedAtMs` z `clearedSessionStartedAtMs` payloadu konfliktu:

- **Zgadzają się** (ten sam `startedAtMs`, oba nie-`null`) → to dokładnie ta sama sesja, wygaszona gdzie indziej → **zaakceptuj wygaszenie**: zastosuj payload lokalnie (`applyCloudPayload`), **nie publikuj ponownie**. Lokalna sesja jest martwa; użytkownik ma zobaczyć, że trening już się zakończył, nie wznawiać go.
- **Nie zgadzają się** (różne `startedAtMs`, albo `clearedSessionStartedAtMs == null`) → zachowanie B-1d bez zmian: lokalna wygrywa, publikuj ponownie.

To nie jest nowy mechanizm synchronizacji — jest to rozszerzenie istniejącego payloadu `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD` o jedno pole tożsamości i jeden dodatkowy warunek w funkcji, która już istnieje i jest już testowana bez DOM (`lib/active-workout-cloud-client.ts`).

Odrzucona alternatywa: osobna tabela/kolumna "historia wygaszeń" (log tombstonów z TTL). Odrzucona — `activeWorkoutSessions` ma `userId` jako PK (co najwyżej jeden wygaszony wiersz na użytkownika na raz), więc nie trzeba pamiętać historii wielu wygaszeń; wystarczy, że *aktualny* tombstone niesie tożsamość ostatniej wygaszonej sesji — to jest jedyny tombstone, z którym jakikolwiek klient może się zderzyć w 409, bo kolejne wygaszenie nadpisuje poprzednie w tym samym wierszu.

Odrzucona alternatywa: porównywać `operationId` zamiast `workoutStartedAtMs`. Odrzucona — po pivocie p.13 `operationId` nie jest już polem synchronizowanym przez chmurę (usunięte z `ActiveWorkoutCloudPayload`, p.13.3.A); re-wprowadzenie go tylko dla tombstone cofnęłoby część pivotu i zdublowało tożsamość sesji dwoma polami (`workoutStartedAtMs` i `operationId` są deterministycznie związane 1:1 przez `deriveWorkoutOperationId`, więc drugie pole nie dodaje informacji, tylko kod).

### 14.3 Projekt — pliki do zmiany

**1. `lib/active-workout-cloud.ts`**

Nowe pole w typie (opcjonalne — obecne tylko na payloadach wygaszonych; nieobecne/`null` na prawdziwej aktywnej sesji, więc nie wpływa na `hasActiveLocalSession` ani na istniejące payloady w bazie zapisane przed tą zmianą):
```ts
export type ActiveWorkoutCloudPayload = {
  startedAt: number | null;
  pausedElapsedSeconds: number;
  workoutStartedAtMs: number | null;
  title: string;
  workoutPlanId: string | null;
  cardioMinutes: number;
  cardioExtras?: ActiveCardioExtras;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  /**
   * Tylko na payloadzie WYGASZONYM (005, N-P13-1): `workoutStartedAtMs` sesji, która była
   * aktywna w momencie wygaszenia (DELETE/ghost-GET, p.12-13). `null`, gdy wygaszano wiersz
   * pusty/nieparsowalny — nie ma czyjej tożsamości do zapisania. Nieobecne na prawdziwym
   * payloadzie aktywnej sesji (`hasActiveLocalSession` go nie czyta).
   */
  clearedSessionStartedAtMs?: number | null;
};
```

`isActiveWorkoutCloudPayload` — dopisać walidację opcjonalnego pola (nie wymagane, ale jeśli obecne, musi być `number | null`):
```ts
(o.clearedSessionStartedAtMs === undefined ||
  o.clearedSessionStartedAtMs === null ||
  typeof o.clearedSessionStartedAtMs === "number")
```

`ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD` (stała) → **fabryka**, bo wartość zależy od tego, co było wygaszane (dokładnie uwaga z polecenia koordynatora):
```ts
/**
 * Payload „wygaszonej” sesji (005, B-1b/p.12) — budowany przy każdym wygaszeniu z
 * tożsamością sesji, którą wygaszono (N-P13-1, p.14). `hasActiveLocalSession` dla tego
 * payloadu zawsze zwraca false, więc GET nigdy go nie wznowi jako aktywną sesję.
 */
export function buildActiveWorkoutClearedPayload(
  clearedSessionStartedAtMs: number | null,
): ActiveWorkoutCloudPayload {
  return {
    startedAt: null,
    pausedElapsedSeconds: 0,
    workoutStartedAtMs: null,
    title: "",
    workoutPlanId: null,
    cardioMinutes: 0,
    exercises: [],
    selectedExerciseId: null,
    clearedSessionStartedAtMs,
  };
}
```
Usunięcie eksportu stałej `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD` — wszystkie dzisiejsze miejsca użycia (`route.ts`, `lib/active-workout-cloud.test.ts`) przechodzą na wywołanie fabryki.

**2. `app/api/active-workout-session/route.ts`**

`clearRow` musi znać `startedAtMs` payloadu, który nadpisuje — przyjmuje go jako parametr (woła go caller, PRZED nadpisaniem, z wiersza, który jeszcze nie został zmutowany):
```ts
async function clearRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  currentRevision: number,
  clearedSessionStartedAtMs: number | null,
): Promise<number> {
  const nextRevision = currentRevision + 1;
  await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(buildActiveWorkoutClearedPayload(clearedSessionStartedAtMs)),
      revision: nextRevision,
      updatedAt: new Date(),
    })
    .where(eq(activeWorkoutSessions.userId, userId));
  return nextRevision;
}
```

`handleDELETE` — dziś `SELECT` pobiera tylko `revision`; musi też pobrać `payloadJson`, żeby wyciągnąć tożsamość PRZED nadpisaniem:
```ts
const [existing] = await db
  .select({ revision: activeWorkoutSessions.revision, payloadJson: activeWorkoutSessions.payloadJson })
  .from(activeWorkoutSessions)
  .where(eq(activeWorkoutSessions.userId, userId))
  .limit(1);

if (!existing) {
  return NextResponse.json({ ok: true, revision: 0 });
}

const existingPayload = parsePayloadJson(existing.payloadJson);
const clearedSessionStartedAtMs = existingPayload?.workoutStartedAtMs ?? null;
const nextRevision = await clearRow(db, userId, existing.revision, clearedSessionStartedAtMs);

return NextResponse.json({ ok: true, revision: nextRevision });
```
(Jeśli wiersz jest już wygaszony w momencie DELETE — rzadkie, ale możliwe, np. drugi DELETE z tej samej karty po network retry — `existingPayload.workoutStartedAtMs` jest już `null`, więc nowy tombstone też dostaje `null`; to jest poprawne, bo nie ma już żywej sesji, której tożsamość trzeba przenieść.)

`handleGET` — dwa wywołania `clearRow` dostają trzeci argument z już dostępnego `payload`:
```ts
if (!payload) {
  // Wiersz uszkodzony/nieparsowalny — nie ma tożsamości do zapisania.
  await clearRow(db, session.user.id, row.revision, null);
  return NextResponse.json({ ok: true, session: null });
}

if (!hasActiveLocalSession(payload)) {
  return NextResponse.json({ ok: true, session: null }); // bez zmian — już wygaszony, bez mutacji
}

if (!isActiveWorkoutCloudFresh(updatedAt)) {
  // Prawdziwy ghost: payload jest aktywny, więc ma tożsamość do przeniesienia na tombstone.
  await clearRow(db, session.user.id, row.revision, payload.workoutStartedAtMs ?? null);
  return NextResponse.json({ ok: true, session: null });
}
```

**3. `lib/active-workout-cloud-client.ts`**

`shouldApplyConflictPayload` — nowa logika (sygnatura wejścia bez zmian, oba argumenty to pełne payloady, które już niosą potrzebne pola):
```ts
/**
 * Decyzja przy konflikcie 409 na PUT (005, N-P13-1, poprawka B-1d z p.13): pusty/wygaszony
 * payload z chmury wygrywa z aktywną sesją lokalną TYLKO, gdy to dokładnie ta sama sesja,
 * którą wygaszono (identyczny `workoutStartedAtMs` jak `clearedSessionStartedAtMs` tombstone'u)
 * — wtedy lokalna sesja jest martwa i użytkownik ma zobaczyć zakończony trening, nie go
 * wznawiać. W przeciwnym razie (różny `startedAtMs`, albo tombstone bez tożsamości) lokalna
 * sesja jest inna/nowsza i wygrywa — zachowanie B-1d bez zmian.
 */
export function shouldApplyConflictPayload(
  localPayload: ActiveWorkoutCloudPayload,
  conflictPayload: ActiveWorkoutCloudPayload,
): boolean {
  if (hasActiveLocalSession(localPayload) && !hasActiveLocalSession(conflictPayload)) {
    const clearedId = conflictPayload.clearedSessionStartedAtMs ?? null;
    const localId = localPayload.workoutStartedAtMs ?? null;
    return clearedId != null && localId != null && clearedId === localId;
  }
  return true;
}
```

**4. `components/active-workout/active-workout-cloud-sync.tsx` — bez zmian kodu.**

Weryfikacja: gałąź `push()` (linie 188-199) już rozdziela oba wyniki `shouldApplyConflictPayload` poprawnie dla nowej semantyki — `true` → `applyCloudPayload(result.conflict.payload)` + `writeRevision` + baner, **bez** ustawienia `pendingPushRef` (czyli bez republikacji) — to jest dokładnie wymagane zachowanie dla przypadku „zaakceptuj wygaszenie" (p.14.2, pierwsza gałąź). `false` → zachowuje lokalny stan i wypycha ponownie (`pendingPushRef = true`) — bez zmian, to B-1d. Innymi słowy: ta funkcja była już zbudowana tak, by przyjmowała wynik `boolean` o dwóch znaczeniach („cloud ma prawdziwie nowszy aktywny stan" **albo** „cloud ma tombstone tej samej, martwej sesji") — oba kończą się identyczną akcją klienta (zastosuj payload, nie republikuj), więc nie trzeba rozróżniać ich w komponencie. Jedyna zmiana jest w `shouldApplyConflictPayload` (plik 3).

Mikro-uwaga UX (nie blokuje, do rozważenia przez `frontend`/`ux` przy implementacji, poza zakresem tej naprawy): baner `t("session.cloudUpdated")` ("Sesja zaktualizowana na innym urządzeniu") wyświetla się też w nowej gałęzi "zaakceptuj wygaszenie" — treść jest technicznie prawdziwa (stan rzeczywiście zmieniony przez chmurę), ale nie mówi wprost „trening już zakończony". Rozróżnienie tekstu wymagałoby przekazania przyczyny do komponentu — zostawione jako niska pozycja backlogu (nie jest to utrata danych, tylko mikrokopia).

### 14.4 Testy regresji wymagane

**`lib/active-workout-cloud-client.test.ts` (rozszerzenie istniejącego bloku `shouldApplyConflictPayload`):**
1. **Scenariusz z polecenia — A kończy sesję 1, B ma lokalnie aktywną sesję 1 (ten sam `startedAtMs`):** lokalny payload aktywny z `workoutStartedAtMs: S1`; payload konfliktu wygaszony z `clearedSessionStartedAtMs: S1` → `shouldApplyConflictPayload(...)` **`true`** (B przyjmuje wygaszenie).
2. **B ma lokalnie aktywną sesję 2 (inny `startedAtMs`):** lokalny payload aktywny z `workoutStartedAtMs: S2`; payload konfliktu wygaszony z `clearedSessionStartedAtMs: S1` (`S1 !== S2`) → **`false`** (B zachowuje lokalną, publikuje ponownie — bez regresji do stanu sprzed B-1d).
3. Tombstone bez tożsamości (`clearedSessionStartedAtMs: null`, np. wygaszenie wiersza uszkodzonego) + lokalna aktywna sesja → **`false`** (zachowanie B-1d niezmienione — to jest dokładnie dzisiejsze zachowanie dla wszystkich tombstone'ów, teraz zwężone do przypadku „nie ta sama sesja").
4. Istniejące trzy testy w tym bloku (`true` gdy obie puste, `true` gdy konflikt też aktywny, `true` gdy lokalna pusta) — bez zmian, muszą przejść niezmienione (budowa `payload(...)` w teście musi dodać `clearedSessionStartedAtMs: undefined` domyślnie albo nie ustawiać go wcale — opcjonalne pole).

**`lib/active-workout-cloud.test.ts`:**
- `isActiveWorkoutCloudPayload` akceptuje payload z `clearedSessionStartedAtMs` jako `number`, jako `null` i bez pola wcale; odrzuca, gdy pole jest np. `string`.
- `buildActiveWorkoutClearedPayload(12345).clearedSessionStartedAtMs === 12345`; `buildActiveWorkoutClearedPayload(null).clearedSessionStartedAtMs === null`; `hasActiveLocalSession(buildActiveWorkoutClearedPayload(12345)) === false` (potwierdza, że dodanie pola nie zepsuło istniejącej reguły).

**`app/api/active-workout-session/route.test.ts` (integracja na prawdziwym handlerze, harness `createMemoryDb`):**
1. **Odtworzenie dokładnie scenariusza testera**: `PUT` jako A, sesja 1, `workoutStartedAtMs: S1`, rewizja 0 → `200`. `DELETE` jako A → `200`, rewizja N+1. Odczyt wiersza bezpośrednio z bazy w teście: `payloadJson` parsuje się do `clearedSessionStartedAtMs === S1`.
2. `GET` na wierszu aktywnym-ale-przeterminowanym (ghost) z `workoutStartedAtMs: S1` → po wywołaniu, odczyt wiersza: `clearedSessionStartedAtMs === S1` (nie `null`) — pokrywa gałąź ghost z `handleGET`, odrębną od DELETE.
3. `GET`/`DELETE` na wierszu z nieparsowalnym `payloadJson` (zapisać ręcznie zepsuty JSON w teście) → wygaszony wiersz ma `clearedSessionStartedAtMs === null`.
4. `PUT` jako B z `revision: 5`, `workoutStartedAtMs: S1` (ta sama sesja, zaległy klient) PO tym jak A już wygasił sesję 1 (krok 1) i odpowiedź jest `409` z `conflict.session.payload.clearedSessionStartedAtMs === S1` — czysto kontraktowa asercja (nie testuje `shouldApplyConflictPayload`, to po stronie klienta), potwierdza, że serwer przekazuje pole dalej bez utraty przy serializacji przez `parsePayloadJson`/odpowiedź JSON.

**Test end-to-end logiki (nie wymagany, ale zalecany jeśli `tester` ma czas) — symulacja w `active-workout-cloud-client.test.ts` łącząca 1+4:** zbudować payload konfliktu przez `buildActiveWorkoutClearedPayload(S1)` (import z `lib/active-workout-cloud`), potwierdzić że to jest to samo, co handler zwróciłby, przez porównanie pól (bez wywoływania handlera — czysto jednostkowe, zero sieci).

### 14.5 Konsekwencje i kompromisy

- Zmiana jest w pełni kompatybilna wstecz bez migracji: `clearedSessionStartedAtMs` jest opcjonalne w typie i walidatorze; wygaszone wiersze zapisane PRZED tą zmianą parsują się nadal poprawnie (pole `undefined` → `shouldApplyConflictPayload` liczy `conflictPayload.clearedSessionStartedAtMs ?? null` → `null` → gałąź „nie zgadzają się" → stare zachowanie B-1d, lokalna wygrywa). Żaden istniejący wiersz w bazie nie staje się nagle błędnie zinterpretowanym tombstone'em — brak tożsamości zawsze domyślnie oznacza „to nie ta sama sesja", nigdy „to ta sama".
- `clearRow` wymaga teraz, by każdy wołający znał `workoutStartedAtMs` wygaszanego payloadu PRZED nadpisaniem — to jest jeden dodatkowy odczyt pola w `handleDELETE` (dziś selekcjonuje tylko `revision`, teraz też `payloadJson`; ten wiersz i tak jest już czytany w całości przez `handleGET` w analogicznej sytuacji, więc koszt jest symetryczny, nie nowy wzorzec w tym pliku). Brak dodatkowego zapytania do bazy — to ten sam `SELECT`, tylko więcej kolumn.
- Pole nazwane `clearedSessionStartedAtMs` (nie `operationId`) świadomie, żeby nie reintrodukować zależności od `operationId` po pivocie p.13 (p.14.2, odrzucona alternatywa) — `workoutStartedAtMs` jest polem, które już było i jest synchronizowane przez chmurę niezależnie od tej naprawy (p.13.1), więc nie dodaje nowego wymiaru stanu, tylko kopiuje istniejące pole do tombstone'u.
- Scenariusz z sekcji 10.3/N-B1d-1 (okno ~1 s wyścigu dwóch urządzeń wokół DELETE/PUT) zyskuje dodatkową ochronę: jeśli wyścig trafi w to samo `workoutStartedAtMs` (bo to dosłownie ta sama sesja kończona w locie z dwóch miejsc), nowa reguła poprawnie każe przyjąć wygaszenie, zamiast je odrzucać — N-B1d-1 nie jest w pełni zamknięte tą naprawą (dotyczy innej kombinacji czasowej), ale ryzyko się nie powiększa.
- Nie rozwiązuje N-P13-2..5 (niskie/średnie, pre-istniejące lub drobne, sekcja 11.8 raportu testera) — te zostają w backlogu zgodnie z ustaleniami etapu 7d, nie są w zakresie tej naprawy.

### 14.6 Werdykt p.14

**ZATWIERDZONE — gotowe do implementacji.** Zakres jest wąski (jedno pole w typie payloadu, jedna fabryka zamiast stałej, jeden dodatkowy parametr w `clearRow` i jego trzech wywołaniach, jeden warunek w `shouldApplyConflictPayload`), nie zmienia schematu bazy (kolumna `payload_json` jest już JSON-em, weryfikacja p.14.1/`db/schema.ts:560-570`), nie zmienia kontraktu HTTP (pole jest wewnątrz istniejącego, nieparzonego ściśle pola `payload`/`session.payload`, nie nowym polem odpowiedzi), nie dotyka Androida/Javy (ten mechanizm synchronizacji aktywnej sesji nie jest używany przez `/api/workouts/complete` ani proxowany do Javy — potwierdzone w p.9, p.12, p.13, bez zmian tutaj). Przegląd architekta po implementacji **nie jest wymagany automatycznie** — wywołać go tylko, jeśli `backend`/`frontend` zgłosi niepewność, albo `tester` znajdzie w teście regresji z p.14.4 wynik niezgodny z projektem wyżej (w szczególności: scenariusz 1 musi dać `true`, scenariusz 2 musi dać `false` — każdy inny wynik jest defektem implementacji, nie luką projektu).

Warunek zamknięcia u `tester`: wszystkie testy z p.14.4 przechodzą (w szczególności oba scenariusze z polecenia koordynatora — 1 i 2); powtórzenie sondy P4 z sekcji 11.6 raportu testera musi dać inny wynik niż wcześniej — konkretnie w kroku „tik B" (B ma nadal otwartą kartę z lokalnie aktywną sesją S1 i dostaje 409 z tombstone `clearedSessionStartedAtMs = S1`): `shouldApplyConflictPayload` zwraca teraz `true` (zamiast dawniejszego `false`), więc B **przyjmuje wygaszenie i nie republikuje** — w chmurze sesja 1 **zostaje wygaszona** (nie wraca jako aktywna), więc przeładowanie A po zakończeniu sesji 1 nie wznawia jej (`decideCloudHydrateAction` nie trafia już na aktywny wiersz innego urządzenia). To zamyka ścieżkę utraty danych opisaną w N-P13-1 bez zmiany zachowania dla scenariusza 2 (inna sesja na B, lokalna wygrywa, publikuje ponownie — bez regresji do stanu sprzed B-1d); `npm test`, `npx tsc --noEmit`, `npm run lint` bez nowych regresji.

---

## 15. Naprawa N-P13-6 — zachowanie tożsamości tombstone przy idempotentnym wygaszeniu (etap 7e → 3)

- **Wejście**: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 12.3 (defekt N-P13-6, sonda P4b, werdykt tester etapu 7e: ODRZUCONE), ten ADR p.14 (naprawa N-P13-1, mechanizm tombstone `clearedSessionStartedAtMs`, który zostaje — problem jest w JEDNYM miejscu, które go nadpisuje za szeroko, nie w samym mechanizmie).

### 15.1 Problem (powtórzenie diagnozy testera, zweryfikowane czytaniem kodu)

`handleDELETE` (`app/api/active-workout-session/route.ts:281-282`) liczy tożsamość do zapisania w nowym tombstonie tak:

```ts
const existingPayload = parsePayloadJson(existing.payloadJson);
const clearedSessionStartedAtMs = existingPayload?.workoutStartedAtMs ?? null;
```

To jest poprawne, gdy `existingPayload` jest AKTYWNĄ sesją (`workoutStartedAtMs` niesie prawdziwą tożsamość tej sesji). Jest błędne, gdy `existingPayload` jest JUŻ tombstone'em: `buildActiveWorkoutClearedPayload` (p.14.3) zawsze ustawia `workoutStartedAtMs: null` na wygaszonym payloadzie (tożsamość tombstone'u żyje w POLU `clearedSessionStartedAtMs`, nie w `workoutStartedAtMs`). Odczytanie `workoutStartedAtMs` z już-wygaszonego payloadu więc zawsze daje `null`, i ten `null` zostaje zapisany jako tożsamość NOWEGO tombstone'u — nadpisując (gubiąc) tożsamość, która tam już była.

Każdy kolejny `DELETE` na wierszu, który jest już tombstone'em — idempotentny `DELETE` tego samego urządzenia, `DELETE` innego urządzenia po przyjęciu wygaszenia (p.14, scenariusz z sekcji 12.1: „B tik: ... B wysyła DELETE"), albo zwykłe otwarcie świeżej karty (N-P13-2, wartownik `clearedPushedRef` startuje od `false`) — więc kasuje tożsamość tombstone'u do `null`. Trzecie, zaległe urządzenie z nadal otwartą starą sesją dostaje potem `409` z tombstone'em `clearedSessionStartedAtMs: null`; `shouldApplyConflictPayload` (p.14.3, plik 3) wymaga `clearedId != null && localId != null && clearedId === localId`, więc `null` nigdy nie „zgadza się" z żadną realną sesją — zaległe urządzenie **republikuje** zakończony trening jako aktywny. To jest dokładnie ta sama klasa utraty danych, którą naprawiało p.14 (N-P13-1), tylko wyzwolona jednym krokiem później w czasie.

Ten sam błąd występuje też w `handleGET`-ghost (`route.ts:115`, `payload.workoutStartedAtMs ?? null`), ale tam jest NIEOSIĄGALNY w praktyce: linia 102 (`if (!hasActiveLocalSession(payload)) return ...` bez mutacji) gwarantuje, że do linii 115 dochodzi tylko payload z `hasActiveLocalSession(payload) === true`, czyli zawsze aktywna sesja z prawdziwym `workoutStartedAtMs`, nigdy tombstone. Naprawa poniżej jest więc formalnie wspólna (jedna funkcja, jedno miejsce prawdy), ale realny błąd dziś istnieje tylko w `handleDELETE`.

### 15.2 Decyzja

Wydzielić decyzję „jaką tożsamość zapisać przy wygaszaniu" do jednej, czystej funkcji w `lib/active-workout-cloud.ts` (obok `hasActiveLocalSession`, `buildActiveWorkoutClearedPayload`, z którymi współpracuje) i użyć jej we WSZYSTKICH trzech miejscach `route.ts`, które dziś liczą `clearedSessionStartedAtMs` przed wywołaniem `clearRow` (linie 98, 115, 281-282) — zamiast każde z nich liczyło to osobno (dwa już liczą poprawnie przez przypadek, bo ich wejście jest ograniczone; trzecie nie). Jedna funkcja w `lib/` (nie w `route.ts`) jest zgodna z dotychczasowym wzorcem tego pliku (`hasActiveLocalSession`, `isActiveWorkoutCloudFresh`, `decideCloudHydrateAction`, `resolveSessionRevisionConflict` już tam są) i daje testowalność bez handlera HTTP.

**Tabela decyzyjna** (kompletna, cztery przypadki z polecenia):

| Co jest w wierszu | `clearedSessionStartedAtMs` nowego tombstone'u |
|---|---|
| Wiersz nie istnieje | N/A — `clearRow` nie jest wołane; `handleDELETE` zwraca `{ ok: true, revision: 0 }` bez zapisu (bez zmian, `route.ts:272-274`) |
| Payload nieparsowalny (`null`) | `null` — nie ma z czego odzyskać tożsamości |
| Payload aktywnej sesji (`hasActiveLocalSession(payload) === true`) | `payload.workoutStartedAtMs ?? null` — to WŁAŚNIE wygaszana sesja |
| Payload JUŻ jest tombstone'em (`hasActiveLocalSession(payload) === false`, payload sparsowany) | **`payload.clearedSessionStartedAtMs ?? null`** — zachowaj istniejącą tożsamość, nie ma nowej sesji do wygaszenia |

### 15.3 Projekt — pliki do zmiany

**1. `lib/active-workout-cloud.ts` — nowa funkcja `resolveClearedSessionIdentity`:**

```ts
/**
 * Tożsamość do zapisania w NOWYM tombstonie przy wygaszaniu wiersza — zależnie od tego,
 * co jest w wierszu AKTUALNIE (005, naprawa N-P13-6, ADR 0004 p.15). Jedno miejsce prawdy
 * dla `handleDELETE` i `handleGET`-ghost w `app/api/active-workout-session/route.ts`, żeby
 * nie liczyć tej decyzji w dwóch miejscach z dwoma różnymi (jedną błędną) interpretacjami.
 *
 * Kluczowe: gdy `payload` jest JUŻ tombstone'em (`hasActiveLocalSession` false), jego
 * `workoutStartedAtMs` jest zawsze `null` (`buildActiveWorkoutClearedPayload`) — tożsamość
 * żyje w `clearedSessionStartedAtMs`, nie w `workoutStartedAtMs`. Odczytanie `workoutStartedAtMs`
 * z tombstone'u i zapisanie go jako tożsamość NOWEGO tombstone'u (poprzedni błąd) kasuje
 * tożsamość przy każdym idempotentnym wygaszeniu tego samego, już-pustego wiersza — to
 * otwierało okno na wskrzeszenie zakończonej sesji przez zaległe, trzecie urządzenie.
 */
export function resolveClearedSessionIdentity(
  payload: ActiveWorkoutCloudPayload | null,
): number | null {
  if (!payload) return null;
  if (hasActiveLocalSession(payload)) return payload.workoutStartedAtMs ?? null;
  return payload.clearedSessionStartedAtMs ?? null;
}
```

**2. `app/api/active-workout-session/route.ts` — trzy wywołania zamienione na wspólną funkcję:**

- Linia 98 (`handleGET`, payload nieparsowalny): `await clearRow(db, session.user.id, row.revision, resolveClearedSessionIdentity(null));` (albo zostawić literalny `null` — funkcja i tak da `null`; zmiana kosmetyczna, do decyzji `backend`, nie wpływa na zachowanie).
- Linia 115 (`handleGET`, ghost przeterminowany, payload zawsze aktywny — patrz 15.1): `await clearRow(db, session.user.id, row.revision, resolveClearedSessionIdentity(payload));` (dziś `payload.workoutStartedAtMs ?? null` — wynik identyczny, bo `hasActiveLocalSession(payload)` jest tu zawsze `true`).
- Linie 281-282 (`handleDELETE`, TO JEST NAPRAWA): zamienić

  ```ts
  const existingPayload = parsePayloadJson(existing.payloadJson);
  const clearedSessionStartedAtMs = existingPayload?.workoutStartedAtMs ?? null;
  ```

  na

  ```ts
  const existingPayload = parsePayloadJson(existing.payloadJson);
  const clearedSessionStartedAtMs = resolveClearedSessionIdentity(existingPayload);
  ```

  Import `resolveClearedSessionIdentity` dodać do istniejącego importu z `@/lib/active-workout-cloud` (linia 9-15).

**3. `clearRow` (funkcja współdzielona, `route.ts:44-60`) — bez zmian sygnatury.** Przyjmuje już `clearedSessionStartedAtMs: number | null` jako parametr; poprawka jest wyłącznie w tym, co wołający (teraz zgodnie `resolveClearedSessionIdentity`) do niej przekazuje. To odpowiada na pytanie koordynatora „napraw raz, w jednym miejscu, wołane i z `handleDELETE`, i z gałęzi ghost" — jedno miejsce to `resolveClearedSessionIdentity` w `lib/`, nie `clearRow` samo (które jest już poprawnie współdzielone od p.12/p.14 i nie ma w sobie błędnej logiki — błąd był w argumencie, który do niego docierał).

### 15.4 Drugie pytanie — czy `clearedPushedRef` startujący od `true` (N-P13-2) jest nadal konieczny

**Ocena: po naprawie 15.3 zmiana `clearedPushedRef` (domyślnie `true` zamiast `false`) PRZESTAJE być wymagana dla poprawności i staje się czystą optymalizacją ruchu sieciowego — niski priorytet, backlog.** Uzasadnienie (nie zgadywanie):

1. **Przed naprawą 15.3** powtórny/zbędny `DELETE` (w tym ten, który N-P13-2 opisuje — świeża karta z pustym stanem, pierwszy tik) był szkodliwy, bo każdy taki `DELETE` na już-wygaszonym wierszu nadpisywał tożsamość tombstone'u na `null` (błąd 15.1). To był realny, zidentyfikowany wyzwalacz N-P13-6 w praktyce (sekcja 12.3 raportu testera: „nie tylko B po akceptacji... sam otwarcie aplikacji po zakończeniu treningu kasuje tożsamość").
2. **Po naprawie 15.3** `clearRow` (przez `resolveClearedSessionIdentity`) na wierszu, który jest już tombstone'em, ZAWSZE zachowuje istniejącą `clearedSessionStartedAtMs` — niezależnie od tego, które urządzenie wywołało `DELETE`, ile razy, i czy wywołanie było „potrzebne" czy zbędne. Zapis jest idempotentny w sensie tożsamości: treść tombstone'u (poza rewizją, która rośnie — zamierzone, p.12) się nie zmienia. Dowód po przypadkach z tabeli 15.2: jedyna droga do zmiany tożsamości to przejście przez gałąź „payload aktywnej sesji" (bo tylko ta gałąź czyta `workoutStartedAtMs` jako NOWĄ tożsamość) — a wygaszony wiersz z definicji nie jest już w tej gałęzi.
3. Pozostałe skutki zbędnego `DELETE` ze świeżej karty (pierwszy tik na pustym stanie) to: (a) jeden dodatkowy zapis do bazy i inkrementacja rewizji bez zmiany treści — koszt zapytania, nie koszt poprawności; (b) ewentualny, krótkotrwały tombstone z `409` do innego urządzenia z aktywną sesją (sonda P2, sekcja 11.4 raportu testera) — ale to urządzenie **samo-naprawia się** przez `shouldApplyConflictPayload` (p.14), bo jego lokalna sesja jest aktywna, a tombstone, który dostaje, ma (po tej naprawie) albo tożsamość innej/starej sesji (nie zgadza się → `false` → republikuje, bez utraty), albo `null` tylko wtedy, gdy NAPRAWDĘ nigdy nie było żadnej realnej sesji do wygaszenia (wiersz od początku pusty/nieparsowalny) — w tym przypadku nie ma czego chronić.
4. Nie ma więc już scenariusza, w którym zbędny `DELETE` ze świeżej karty prowadzi do utraty tożsamości tombstone'u lub wskrzeszenia zakończonej sesji. Pozostaje tylko to, co tester już ocenił jako NISKI priorytet przy pierwszym zgłoszeniu N-P13-2 (sekcja 11.8: „Skutek: zbędna rewizja... Nie blokuje") — ocena się nie zmienia, zyskuje tylko dodatkowe, mocniejsze uzasadnienie (brak ryzyka tożsamości, nie tylko brak ryzyka pętli).

**Rekomendacja**: NIE wiązać N-P13-2 z tą naprawą jako warunku zamknięcia. Zostaje w backlogu jako samodzielna, niska pozycja (ograniczenie zbędnego ruchu sieciowego przy starcie świeżej karty), do zaplanowania niezależnie, bez wpływu na werdykt tej naprawy.

### 15.5 Testy regresji wymagane — macierz pokrywająca wszystkie scenariusze dotychczasowych rund naraz

Cel: jeden kompletny przebieg `tester`, zamiast znajdowania kolejnego rogu przypadku rundami. Wszystkie poniższe na prawdziwym handlerze `app/api/active-workout-session/route.ts` (harness `createMemoryDb`, jak w dotychczasowych rundach) i/lub `lib/active-workout-cloud.test.ts` dla czystej funkcji.

| # | Scenariusz | Krok | Oczekiwany wynik |
|---|---|---|---|
| (a) | Pojedynczy `DELETE` na aktywnej sesji | `PUT` S1 (`workoutStartedAtMs = 1000`) rev 0 → 200; `DELETE` → 200 | Wiersz po `DELETE`: `clearedSessionStartedAtMs === 1000` |
| (b) | Podwójny/potrójny `DELETE` pod rząd na już pustym wierszu | Kontynuacja (a): `DELETE` ×2 kolejne razy (rev N+1, N+2) | Po każdym `DELETE`: `clearedSessionStartedAtMs === 1000` (NIE `null`) — **to jest bezpośredni test regresji N-P13-6/sonda P4b** |
| (c) | `GET`-ghost po `DELETE` nie gubi tożsamości | Kontynuacja (a): `updatedAt` wiersza przesunięty > 24h w teście (symulacja ghost), `GET` × 1 | `session: null`; wiersz: `clearedSessionStartedAtMs === 1000` nienaruszone (gałąź ghost operuje tylko na aktywnych payloadach — patrz 15.1 — ten test potwierdza, że NIE wchodzi w gałąź nadpisującą tombstone na nowo, bo `hasActiveLocalSession` na tombstonie jest `false` i linia 102 zwraca wcześniej) |
| (d) | Trzy urządzenia: A kończy S1 → B (miał S1) akceptuje i sam wysyła `DELETE` → C (nadal ma S1) dostaje konflikt | `PUT` A S1 rev 0→1; `PUT` B S1 rev 1→2 (B synchronizuje); `DELETE` A → rev 3, tombstone `1000`; (symulacja „B akceptuje i publikuje pusty stan") `DELETE` B → rev 4, tombstone musi zostać `1000`; `PUT` C z `revision: 2`, payload S1 → `409` | `409` z `conflict.session.payload.clearedSessionStartedAtMs === 1000`; w teście klienta (`active-workout-cloud-client.test.ts`) osobno: `shouldApplyConflictPayload(localPayloadS1, conflictPayload)` z tym tombstone'em → `true` (C przyjmuje wygaszenie, NIE republikuje — to jest warunek „musi zaakceptować, nie wskrzesić") |
| (e) | B-1d bez regresji (inna sesja lokalna → republikacja, nic nie ginie) | Po (a)-(b): `PUT` z payloadem S2 (`workoutStartedAtMs = 2000`), `revision` z ostatniego `DELETE` → `409` z tombstone `clearedSessionStartedAtMs === 1000` | `shouldApplyConflictPayload(payloadS2, conflictTombstone1000)` → `false` (S2 ≠ 1000); klient zachowuje S2 i republikuje; kontynuacja w teście serwera: `PUT` S2 z `revision` z konfliktu → `200`, wiersz ma aktywną S2 |
| (f) | Nowa, genuinie inna sesja wygaszana poprawnie nadpisuje tożsamość na swoją | Kontynuacja (e): S2 kończy się normalnie, `DELETE` | Wiersz: `clearedSessionStartedAtMs === 2000` (nie `1000` — nadpisanie jest poprawne, bo tym razem źródłem jest payload AKTYWNEJ sesji S2, gałąź 1 tabeli 15.2, nie gałąź 2) |

Dodatkowo (jednostkowe, bez handlera, `lib/active-workout-cloud.test.ts`):
- `resolveClearedSessionIdentity(null) === null`.
- `resolveClearedSessionIdentity(aktywny payload z workoutStartedAtMs: 500) === 500`.
- `resolveClearedSessionIdentity(tombstone z clearedSessionStartedAtMs: 777) === 777`.
- `resolveClearedSessionIdentity(tombstone z clearedSessionStartedAtMs: null) === null` (wygaszenie wiersza, który od początku nie miał tożsamości — nie jest to regresja, to poprawne zachowanie dla łańcucha, który nigdy nie miał realnej sesji).

Scenariusz (b) jest bezpośrednią, minimalną sondą P4b testera — musi przejść jako pierwszy, bo to on wykrył defekt. Scenariusz (d) jest tym, który poprzednie rundy (dwa urządzenia, sekcja 12.1) NIE wykryły, bo wymaga trzeciego, zaległego urządzenia — stąd rekomendacja, by `tester` uruchomił dokładnie tę sekwencję, a nie tylko wariant dwuurządzeniowy.

### 15.6 Konsekwencje i kompromisy

- Zmiana jest w pełni kompatybilna wstecz, bez migracji: `resolveClearedSessionIdentity` operuje na już istniejącym, opcjonalnym polu `clearedSessionStartedAtMs` (p.14) — wiersze zapisane między p.14 i tą naprawą, które już mają skasowaną tożsamość (`null` przez błąd 15.1), po tej naprawie po prostu przestają tracić ją DALEJ (zostają przy `null`, co jest bezpieczne — `null` nigdy błędnie nie „zgadza się" z realną sesją), ale nie odzyskują retroaktywnie tożsamości utraconej PRZED wdrożeniem tej poprawki. To jest znana, jednorazowa luka przejściowa (wiersze dotknięte błędem między wdrożeniem p.14 i p.15), nie wymaga backfillu — ryzyko dotyczy tylko okna, w którym p.14 było już na produkcji a p.15 jeszcze nie, i tylko kont z zaległym, trzecim urządzeniem w tym oknie. Brak akcji dla `backend` poza samą poprawką (odnotować w backlogu jako ryzyko akceptowane, nie do naprawy).
- Brak zmiany kontraktu HTTP, brak zmiany schematu bazy, brak wpływu na Android/Javę (ten mechanizm nie jest proxowany do Javy — potwierdzone w p.9/p.12/p.13/p.14, bez zmian tutaj).
- `resolveClearedSessionIdentity` jest czystą funkcją w `lib/`, więc koszt tej naprawy to w praktyce tylko przekierowanie istniejącego, dostępnego już `existingPayload` przez jedną dodatkową funkcję — zero nowych zapytań do bazy, zero nowych zależności.
- Nie rozwiązuje N-P13-2 (decyzja 15.4: zostaje w backlogu jako optymalizacja, nie poprawka poprawności), N-P13-3, N-P13-4, N-P13-5 (bez zmian, poza zakresem tej naprawy, sekcja 11.8 raportu testera).

### 15.7 Czy klasa błędów „wyścigi w synchronizacji aktywnej sesji między urządzeniami” jest teraz kompletna

**Ocena architekta: TAK, po tej naprawie logika jest kompletna dla modelu „jeden aktywny wiersz na użytkownika + tombstone z tożsamością”, pod warunkiem przejścia macierzy 15.5 (w szczególności scenariusza (d), trzy urządzenia).** Uzasadnienie, nie tylko zapewnienie:

1. **Wyczerpanie przestrzeni stanów wiersza.** Wiersz `activeWorkoutSessions` ma w tym modelu dokładnie cztery możliwe treści payloadu: (i) nie istnieje, (ii) nieparsowalny, (iii) aktywna sesja, (iv) tombstone. Tabela 15.2 pokrywa wszystkie cztery wyczerpująco dla operacji wygaszania — nie ma piątego przypadku do odkrycia w TEJ funkcji, bo `ActiveWorkoutCloudPayload`/`isActiveWorkoutCloudPayload` nie dopuszczają żadnego innego kształtu (zod/typ-guard na wejściu `PUT`, `parsePayloadJson` na odczycie).
2. **Wyczerpanie przestrzeni decyzji klienta.** `shouldApplyConflictPayload` (p.14.3) ma dokładnie dwie gałęzie (`hasActiveLocalSession(local) && !hasActiveLocalSession(conflict)` → porównanie tożsamości; wpp. → `true`) i są one łącznie wyczerpujące dla czterech kombinacji (lokalna aktywna/pusta × konflikt aktywny/pusty) — potwierdzone już w teście (p.14.4, 11.5: „Cztery kombinacje... potwierdzone”). Ta naprawa nie zmienia liczby gałęzi, tylko poprawia DANE wejściowe do jednej z nich (tożsamość tombstone'u musi być prawdziwa, nie `null` przez pomyłkę).
3. **Argument „dlaczego nie będzie N-P13-7”.** Poprzednie trzy rundy (N-P13-1, potem N-P13-6) powstały, bo każda naprawa testowała dokładnie DWA urządzenia i w tym zakresie przechodziła, a błąd ujawniał się przy TRZECIM, zaległym uczestniku albo przy powtórzeniu tej samej operacji (idempotencja). Macierz 15.5 jest pierwszą, która explicite testuje: (i) powtórzenie operacji wygaszania (b) — kryterium idempotencji, (ii) trzech niezależnych aktorów (d) — kryterium liczby uczestników, (iii) obie kolejności wygrywania (e, f) — kryterium symetrii „nowa sesja nadpisuje, stara nie nadpisuje”. To są trzy osie, które wcześniej ujawniały błędy pojedynczo; po przejściu macierzy nie zostaje czwarta znana, nieprzetestowana oś.
4. **Co NIE jest objęte i jest świadomym ryzykiem resztkowym (nie nowym wariantem tej samej klasy):** (i) N-P13-3 — gorąca pętla ponowień przy błędach HTTP (5xx/429) jest problemem odporności/rate-limitu, nie tożsamości synchronizacji; (ii) rzeczywiste zachowanie `pagehide`/offline w przeglądarce (nigdy nie przetestowane end-to-end w tym zadaniu, tylko sondami na atrapie `fetch`) — ryzyko środowiskowe, nie logiczne; (iii) dwie karty na TYM SAMYM urządzeniu z tym samym `deviceId` i `localStorage` współdzielonym (odnotowane w sekcji 9.11 raportu testera jako nieprzetestowane) — to inny wektor (współdzielony stan klienta, nie wyścig serwerowy) i wymaga odrębnej analizy, jeśli ma się nim zajmować; nie jest to brakujący przypadek w TEJ tabeli decyzyjnej. Żadne z tych trzech nie jest „jeszcze jednym rogiem tabeli 15.2” — są to inne kategorie ryzyka, poza zakresem modelu „jeden wiersz + tombstone z tożsamością”.
5. Zastrzeżenie uczciwe: „kompletność” jest tu względna wobec PRZYJĘTEGO modelu (jeden wiersz na użytkownika, jedna tożsamość w tombstonie, revision monotoniczna). Gdyby produkt rozszerzył się na wielosesyjność (więcej niż jedna aktywna sesja per użytkownik jednocześnie) albo offline-first z wieloma niezależnymi kolejkami, model wymagałby nowego ADR, nie łatki. W obrębie dzisiejszego modelu — kompletne.

### 15.8 Werdykt p.15

**ZATWIERDZONE — gotowe do implementacji.** Zakres jest węższy niż p.14: jedna nowa, czysta funkcja w `lib/active-workout-cloud.ts`, jedna linia zamieniona w `handleDELETE`, opcjonalnie (kosmetyka, bez zmiany zachowania) też w `handleGET`-ghost i w gałęzi nieparsowalnej dla jednorodności. Bez zmiany schematu, bez zmiany kontraktu HTTP, bez wpływu na Android/Javę. Przegląd architekta po implementacji nie jest wymagany automatycznie (reguła z `docs/zespol/przeplyw.md`) — wywołać go tylko, jeśli `tester` znajdzie w macierzy 15.5 wynik niezgodny z tabelą 15.2, w szczególności jeśli scenariusz (d) (trzy urządzenia) nie da `shouldApplyConflictPayload = true` dla C.

Odpowiedź na drugie pytanie koordynatora (N-P13-2, `clearedPushedRef`): **zdegradowane do optymalizacji, backlog, niski priorytet, NIE jest warunkiem zamknięcia tej naprawy** (uzasadnienie: 15.4).

Warunek zamknięcia u `tester`: cała macierz 15.5 przechodzi (w szczególności (b) i (d)), `npm test`, `npx tsc --noEmit`, `npm run lint` bez nowych regresji względem baseline. Jeśli macierz przechodzi w całości, zalecenie architekta: to jest ostatnia runda tej klasy defektu (15.7) — kolejne odrzucenie w tym samym obszarze powinno wrócić do analizy modelu (nowy ADR), nie do kolejnej łatki p.16.

---

## 16. Naprawa źródłowa N-P13-7 — rewizja na DELETE (etap 7f → 3, szósty defekt tej rodziny)

- Status: zaproponowany
- Data: 2026-10-25
- Wejście: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 13 (defekt N-P13-7, sonda 13.4, werdykt tester etapu 7f: ODRZUCONE), ten ADR p.12-15 (cała historia mechanizmu wygaszania/tombstone/rewizji, która zostaje — ten dodatek NIE jest jej rewersem)
- Werdykt skrócony: **ZATWIERDZONE.** Hipoteza koordynatora jest poprawna i zweryfikowana czytaniem kodu: `handleDELETE` jest jedyną mutującą operacją w `app/api/active-workout-session/route.ts` bez kontroli optymistycznej współbieżności. Naprawa: `DELETE` wymaga rewizji, którą klient uważa za aktualną, i odpowiada `409` (bez mutacji) przy niezgodności — identyczny mechanizm jak `handlePUT`. To zamyka N-P13-7 i, w ocenie architekta, całą rodzinę błędów B-1b/B-1c/B-1d/N-P13-1/N-P13-6/N-P13-7 jednym, fundamentalnym mechanizmem — patrz 16.6.

### 16.1 Weryfikacja hipotezy — czytanie kodu, nie zakładanie

**Serwer (`app/api/active-workout-session/route.ts`, HEAD tej sesji):**
- `handlePUT` (linie 137-237): wymaga `revision: z.number().int().min(0)` w body (`putSchema`), porównuje `clientRevision < serverRevision` i **odrzuca `409` bez mutacji**, jeśli klient jest za starym. To jest kontrola optymistycznej współbieżności w pełnym sensie.
- `handleDELETE` (linie 239-287): **nie przyjmuje żadnego ciała żądania, żadnej rewizji, żadnego pola tożsamości.** Czyta istniejący wiersz (`SELECT revision, payloadJson`), liczy `clearedSessionStartedAtMs` przez `resolveClearedSessionIdentity` (p.15 — poprawne, ale operuje na tym, co JEST w wierszu, nie na tym, co WYWOŁUJĄCY sądzi, że tam jest) i **zawsze** wygasza wiersz, niezależnie od tego, kto wywołuje i co wywołujący wie o aktualnym stanie. Potwierdzone czytaniem — nie ma żadnej gałęzi warunkowej odrzucającej żądanie na podstawie wiedzy klienta.
- `handleGET`-ghost (linie 111-118): mutuje też bez wejścia od klienta, ale **to jest bezpieczne inaczej** — operuje na WŁASNYM, właśnie odczytanym wierszu tego samego żądania (nie na czyimś zewnętrznym twierdzeniu o rewizji), więc nie ma tu możliwości pomyłki tożsamości — serwer czyści to, co faktycznie zastał, nie to, co ktoś twierdzi, że zastał. Zgodnie z notatką z polecenia: `clearRow`/`resolveClearedSessionIdentity` **nie wymagają zmiany** — błąd był na WEJŚCIU do `handleDELETE` (brak warunku), nie w funkcjach, które są wołane po wejściu.

**Klient (`lib/active-workout-cloud-client.ts`, `components/active-workout/active-workout-cloud-sync.tsx`):**
- `deleteCloud()` (linie 131-149 `active-workout-cloud-client.ts`): dziś **nie przyjmuje żadnego argumentu** — samo wysyła `DELETE` bez ciała. Dowód, że serwer nigdy nie mógłby odrzucić tego żądania na podstawie rewizji, nawet jeśli by chciał — klient dziś nie ma jak jej przekazać.
- **Dwa, i tylko dwa, wywołania `deleteCloud()` w całym repo** (zweryfikowane grep, `components/active-workout/active-workout-cloud-sync.tsx`):
  1. Linia 119, w `hydrate()`, gałąź `action === "delete-cloud"` (`decideCloudHydrateAction` zwraca to dla: (a) wiersz w chmurze jest przeterminowany/duch, (b) lokal pusty i to samo urządzenie co wiersz w chmurze). W obu przypadkach `cloud` (zmienna z `fetchCloud()`, linia 105) jest **świeżo odczytanym** rekordem z TEGO SAMEGO wywołania — `cloud.revision` jest więc dokładnie aktualną rewizją serwera w tym momencie, dostępną bez dodatkowego zapytania.
  2. Linia 163, w `push()`, gałąź `!hasActiveLocalSession(payload)` (lokalna sesja właśnie się skończyła na TYM urządzeniu). `readRevision()` (wołane kilka linii niżej dla `putCloud`, linia 184 — dostępne identycznie tutaj) jest ostatnią rewizją, którą TO urządzenie zsynchronizowało dla wiersza tego użytkownika — poprawna wartość do porównania, dokładnie ten sam wzorzec, co `putCloud` już używa.
- **Wniosek**: w obu istniejących, legalnych miejscach wywołania `deleteCloud()` klient JUŻ ma dostęp do wartości, która powinna być przekazana jako rewizja — nie trzeba dodawać żadnego nowego stanu, tylko przekazać coś, co już istnieje w zmiennej lokalnej tej samej funkcji. To jest silny sygnał, że naprawa jest wąska i nie psuje żadnego istniejącego, poprawnego przypadku użycia.

**Scenariusz bystandera C (N-P13-7) pod naprawą — przeliczone krok po kroku:**
C nigdy nie zrobił `writeRevision()` (bo `hydrate()` nie woła `writeRevision` w gałęzi `cloudActive === false` → `decideCloudHydrateAction` zwraca `"noop"` natychmiast, linia 135 `lib/active-workout-cloud.ts`: `if (!input.cloudActive) return "noop";`) — `readRevision()` na C zwraca `0` (domyślna wartość przy braku wpisu w `localStorage`, `active-workout-cloud-client.ts:21-28`). Gdy C wysyła `DELETE` z `revision: 0`, a serwer ma aktualnie wiersz z S2 (rewizja ≥ 2, bo A już zrobił `PUT` S1→tombstone→`PUT` S2), porównanie `0 < 2` jest prawdziwe → serwer odpowiada `409`, **nie mutuje wiersza**. S2 przetrwa nietknięta. To jest dokładnie żądany efekt.

### 16.2 Czy to zamyka problem, czy tylko przesuwa okno (ocena prawdopodobieństwa, nie tylko możliwości)

Pytanie z polecenia: czy złośliwy/przypadkowy klient może "trafić" akurat we właściwą rewizję przez wyścig czasowy?

- **Dziś** (bez naprawy): DELETE mutuje **zawsze**, niezależnie od rewizji — prawdopodobieństwo trafienia w utratę danych nie jest kwestią "trafienia w okno", bo **nie ma okna, które trzeba trafić** — każde wywołanie DELETE od kogokolwiek, w każdej chwili, mutuje. To jest deterministyczna podatność, nie wyścig.
- **Po naprawie**: DELETE mutuje **tylko**, gdy `clientRevision >= serverRevision`. Dla bystandera C (nigdy nie synchronizował się z wierszem tego użytkownika) `readRevision()` jest `0` na starcie przeglądarki/urządzenia. Jedyny sposób, by C miał rewizję ≥ aktualnej rewizji serwera, to gdyby C **wcześniej faktycznie zsynchronizował się** z tym samym wierszem (czyli byłby prawdziwym uczestnikiem, nie bystanderem) — a to przestaje być "bystander" w sensie tego defektu, to staje się dokładnie przypadek "zaległe, ale wcześniej uczestniczące urządzenie", który macierz 15.5 (scenariusze (d)-(f)) już pokrywa przez mechanizm tombstone/identity. Innymi słowy: po naprawie, żeby DELETE komukolwiek coś skasował, trzeba było wcześniej **widzieć** ten wiersz (choćby raz, przez GET lub PUT) — co jest definicją "nie być bystanderem". Prawdopodobieństwo trafienia przez czysty bystander-przypadek wymagałoby, by `0 >= serverRevision`, czyli **serverRevision musiałby być `0` lub ujemne** — a serwer nigdy nie zwraca rewizji `0` dla wiersza, który faktycznie istnieje i jest aktywny (pierwszy `PUT` zapisuje `revision: 1`, p.1/handlePUT linia 208: `Math.max(serverRevision, clientRevision) + 1`). Jedyny przypadek `serverRevision === 0` to **wiersz nie istnieje** — a wtedy `handleDELETE` już dziś (i po naprawie, bez zmiany) zwraca `{ ok: true, revision: 0 }` bez żadnej mutacji do wygaszenia (nie ma czego kasować). Więc nie ma realnej ścieżki, w której nieinformowany bystander "trafia" we właściwą rewizję przez przypadek czasowy — to nie jest wyścig, to jest wymóg wcześniejszej, faktycznej wiedzy o wierszu, co z definicji wyklucza przypadkowego bystandera.
- **Wniosek**: to zamyka problem, nie przesuwa okna. Różnica między "DELETE działa zawsze" i "DELETE działa tylko dla kogoś, kto wcześniej widział ten wiersz" jest różnicą kategorii, nie tylko stopnia.

### 16.3 Decyzja

`handleDELETE` przyjmuje ciało żądania `{ revision: number }` (dokładnie ten sam kształt pola, co `handlePUT`) i stosuje **identyczną** kontrolę optymistycznej współbieżności: `clientRevision < serverRevision` → `409` z konfliktowym payloadem, bez mutacji. `deleteCloud()` w kliencie przyjmuje `revision: number` jako parametr i przekazuje go dalej. Oba istniejące wywołania `deleteCloud()` przekazują wartość, którą już mają w zmiennej lokalnej (`cloud.revision` przy hydracji, `readRevision()` przy push).

Odrzucona alternatywa: rewizja jako parametr zapytania (`?revision=`) zamiast ciała JSON. Odrzucona — `fetch` z metodą `DELETE` i ciałem JSON jest już używanym wzorcem w tym repo (dokładnie to, co `PUT` robi), a `Request#json()` w Next.js route handlerze czyta ciało niezależnie od metody HTTP (nie jest to niestandardowe użycie protokołu — RFC 7231/9110 nie zakazuje ciała w DELETE, tylko nie definiuje dla niego znaczenia; tutaj znaczenie definiujemy sami, konsekwentnie z PUT). Parametr zapytania wymagałby osobnej ścieżki walidacji (inny schemat niż body) bez żadnej korzyści.

Odrzucona alternatywa: zamiast wymagać rewizji, przenieść warunek do wartownika klienckiego (np. `clearedPushedRef` startujący od `true`, odrzucone już w p.15.4 jako niewystarczające — nie chroni przed nowym, świeżym urządzeniem C, które nigdy nie miało żadnego wartownika klienckiego do ustawienia). Klient nie może samodzielnie decydować, czy jego DELETE jest bezpieczny — tylko serwer, posiadający aktualny stan wiersza, może to ocenić. To jest ten sam argument, który uzasadnia kontrolę rewizji na `PUT` od samego początku (p.1) — tu było po prostu przeoczone dla `DELETE`.

### 16.4 Projekt — pliki do zmiany

**1. `app/api/active-workout-session/route.ts` — wspólny helper konfliktu (DRY, PUT i DELETE budują identyczny kształt odpowiedzi 409):**

```ts
/**
 * Odpowiedź 409 przy niezgodności rewizji (PUT i, od tej naprawy, DELETE) — jeden
 * kształt, jedno miejsce budowy, żeby nie duplikować mapowania wiersza na payload
 * odpowiedzi (005, N-P13-7, ADR p.16). `existing` to wiersz PRZED jakąkolwiek mutacją.
 */
function buildRevisionConflictResponse(existing: {
  revision: number;
  payloadJson: string;
  deviceId: string;
  updatedAt: Date | number;
}) {
  const payload = parsePayloadJson(existing.payloadJson);
  return NextResponse.json(
    {
      ok: false,
      conflict: true,
      session: payload
        ? {
            payload,
            revision: existing.revision,
            deviceId: existing.deviceId,
            updatedAt:
              existing.updatedAt instanceof Date
                ? existing.updatedAt.getTime()
                : Number(existing.updatedAt),
          }
        : null,
    },
    { status: 409 },
  );
}
```

`handlePUT` (linie 186-206 dzisiejsze) zamienia swój inline blok na `if (existing && clientRevision < serverRevision) return buildRevisionConflictResponse(existing);` — czysty refaktor, zero zmiany zachowania (potwierdzić testem regresji PUT bez zmian wyniku).

**2. `app/api/active-workout-session/route.ts` — `handleDELETE` z walidacją i kontrolą rewizji:**

```ts
const deleteSchema = z.object({ revision: z.number().int().min(0) });

async function handleDELETE(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(/* bez zmian */);
  if (!rl.ok) { /* bez zmian */ }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy payload." }, { status: 400 });
  }

  await ready();
  const db = getDb();
  const userId = session.user.id;

  const [existing] = await db
    .select({
      revision: activeWorkoutSessions.revision,
      payloadJson: activeWorkoutSessions.payloadJson,
      deviceId: activeWorkoutSessions.deviceId,
      updatedAt: activeWorkoutSessions.updatedAt,
    })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  // Brak wiersza — nic do wygaszenia i nic do chronienia; rewizja klienta jest
  // nieistotna (ten sam wyjątek jak dotąd, p.12 — zero historii = zero ryzyka).
  if (!existing) {
    return NextResponse.json({ ok: true, revision: 0 });
  }

  // NOWE (005, N-P13-7): DELETE wymaga TEJ SAMEJ kontroli optymistycznej
  // współbieżności co PUT — klient, który nie widział aktualnej rewizji wiersza,
  // nie ma prawa go wygasić. Bez tego warunku dowolne, nieinformowane urządzenie
  // (świeża/pusta karta, zero wcześniejszego kontaktu z tym wierszem) mogło
  // skasować AKTYWNY trening innego urządzenia — patrz ADR p.16.1-16.2.
  if (parsed.data.revision < existing.revision) {
    return buildRevisionConflictResponse(existing);
  }

  const existingPayload = parsePayloadJson(existing.payloadJson);
  const clearedSessionStartedAtMs = resolveClearedSessionIdentity(existingPayload);
  const nextRevision = await clearRow(db, userId, existing.revision, clearedSessionStartedAtMs);

  return NextResponse.json({ ok: true, revision: nextRevision });
}
```

Reszta `handleDELETE` (CSRF, auth, rate limit, `clearRow`, `resolveClearedSessionIdentity`) **bez zmian** — potwierdza notatkę z polecenia: naprawa jest na WEJŚCIU (walidacja + warunek), nie w funkcjach wołanych po przejściu warunku.

**3. `lib/active-workout-cloud-client.ts` — `deleteCloud(revision)`:**

```ts
/**
 * Serwer "wygasza" wiersz (nigdy go fizycznie nie usuwa) TYLKO, gdy `revision`
 * przekazana przez klienta jest >= aktualnej rewizji serwera — ta sama kontrola
 * optymistycznej współbieżności co `putCloud` (005, N-P13-7, ADR p.16). Wywołujący
 * MUSI przekazać rewizję, którą faktycznie zna (świeżo odczytaną z chmury albo
 * ostatnią zsynchronizowaną lokalnie) — nigdy stałą/zgadywaną wartość.
 */
export async function deleteCloud(
  revision: number,
): Promise<{ ok: boolean; revision?: number; conflict?: ActiveWorkoutCloudRecord | null }> {
  await ensureCsrfCookie();
  const res = await fetch("/api/active-workout-session", {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getXsrfHeaders(),
    },
    body: JSON.stringify({ revision }),
  });
  let json: {
    ok?: boolean;
    revision?: number;
    conflict?: boolean;
    session?: ActiveWorkoutCloudRecord | null;
  } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    /* empty body na edge-case'ach keepalive — rewizja zostaje bez zmian, kolejny push/pull naprawi */
  }
  if (res.status === 409 && json.session !== undefined) {
    return { ok: false, conflict: json.session };
  }
  if (!res.ok || !json.ok) return { ok: false };
  return { ok: true, revision: json.revision };
}
```

Kształt odpowiedzi **identyczny** z `putCloud` (ten sam wzorzec `{ ok, revision?, conflict? }`) — żeby wywołujący w `active-workout-cloud-sync.tsx` mógł obsłużyć konflikt DELETE tym samym wzorcem co konflikt PUT, nie wymyślając drugiego kształtu.

**4. `components/active-workout/active-workout-cloud-sync.tsx` — dwa wywołania `deleteCloud()`:**

a) **Hydracja (linia 119, `action === "delete-cloud"`)** — przekazać rewizję świeżo odczytaną w tym samym `hydrate()`:
```ts
if (action === "delete-cloud") {
  const result = await deleteCloud(cloud?.revision ?? 0);
  // Konflikt tutaj jest praktycznie nieosiągalny (rewizja jest odczytana
  // mikrosekundy wcześniej, w tym samym wywołaniu) — jeśli mimo to wystąpi,
  // nie robimy nic: lokal jest pusty z definicji tej gałęzi, kolejny
  // hydrate/push cykl zreconciluje stan bez utraty danych.
  if (!result.ok && result.conflict) {
    // brak akcji — zaakceptowane, patrz komentarz wyżej
  }
}
```

b) **Push, lokal pusty (linia 163, gałąź `!hasActiveLocalSession(payload)`)** — przekazać `readRevision()`, obsłużyć konflikt analogicznie do konfliktu `putCloud`, ale **bez `applyCloudPayload`** (lokalny stan jest pusty z definicji tej gałęzi — nie ma nic do scalenia, a zastosowanie payloadu konfliktu wskrzesiłoby na tym urządzeniu sesję, której nigdy nie było lokalnie — to jest dokładnie błąd, którego ta naprawa unika, tylko w drugą stronę):
```ts
if (!hasActiveLocalSession(payload)) {
  if (clearedPushedRef.current) return;
  clearedPushedRef.current = true;
  pushingRef.current = true;
  try {
    const result = await deleteCloud(readRevision());
    if (!result.ok && !result.conflict) {
      clearedPushedRef.current = false; // błąd sieci/serwera — spróbuj ponownie przy następnym ticku
      pendingPushRef.current = true;
    } else if (result.conflict) {
      // 409 (005, N-P13-7): ktoś inny ma teraz nowszą, aktywną sesję w tym
      // wierszu, o której to urządzenie nic nie wie — NIE stosuj jej lokalnie
      // (lokal jest pusty, ma tak zostać), tylko zapamiętaj aktualną rewizję,
      // żeby kolejne odczyty/zapisy nie zderzały się z tą samą, przestarzałą
      // wartością. `clearedPushedRef` zostaje `true` — nie ma nic do
      // "oczekującego" usunięcia, ponawianie identycznego DELETE dałoby
      // identyczny konflikt (chyba że lokalna sesja znów stanie się aktywna,
      // co i tak resetuje wartownik niżej).
      if (result.conflict) writeRevision(result.conflict.revision);
    } else if (result.ok && result.revision != null) {
      writeRevision(result.revision);
    }
  } finally {
    pushingRef.current = false;
    if (pendingPushRef.current) {
      pendingPushRef.current = false;
      void push();
    }
  }
  return;
}
clearedPushedRef.current = false;
```

Konsekwencja uboczna, pozytywna: ta sama zmiana **zamyka też N-P13-2** (backlog, p.15.4) jako efekt dodatkowy, nie tylko jako optymalizację — świeża karta z `readRevision() === 0` próbująca zbędnego DELETE na niepustym, cudzym wierszu teraz dostaje `409` i **nie mutuje** serwera wcale (dziś: mutuje zawsze, tylko bezpiecznie dla tożsamości po p.15). N-P13-2 przechodzi z "optymalizacja ruchu" do "zamknięte jako efekt tej naprawy" — zero dodatkowego kodu ponad to, co już jest w tym punkcie.

**5. Bez zmian**: `handleGET`, `clearRow`, `resolveClearedSessionIdentity`, `shouldApplyConflictPayload`, cały mechanizm tombstone/identity z p.12-15. Potwierdzone w 16.1 — te funkcje są poprawne, operują na danych, które same odczytały, nie na twierdzeniach wywołującego.

### 16.5 Testy regresji wymagane

**`app/api/active-workout-session/route.test.ts`:**
1. **Dokładny scenariusz testera (13.4), wymagany explicite**: `PUT` A, S1 (`workoutStartedAtMs: 1000`), `revision: 0` → `200, revision: 1`. `DELETE` A z `revision: 1` → `200, revision: 2` (tombstone 1000). `PUT` A, S2 (`workoutStartedAtMs: 2000`), `revision: 2` → `200, revision: 3`. **C wysyła `DELETE` z `revision: 0`** (fresh, nigdy nie synchronizował) → **`409`, `conflict: true`**; odczyt wiersza bezpośrednio z bazy PO tym wywołaniu: payload wciąż aktywny, `workoutStartedAtMs === 2000`, `revision === 3` (**niezmieniona** przez próbę C). Kontynuacja: `PUT` A z `revision: 3` (kolejna seria) → `200` bez żadnej interferencji od C.
2. Istniejące testy `DELETE` w pliku (macierz 15.5 (a)-(f), sonda 9.2, testy B-1b) — zaktualizować wywołania `DELETE`, by wysyłały ciało `{ revision }` z poprawną, zsynchronizowaną wartością (ten sam `revision`, jaki test już śledzi z poprzednich odpowiedzi) — wszystkie muszą przejść **niezmienione w wyniku**, tylko z dodanym ciałem żądania.
3. `DELETE` bez ciała / z nieprawidłowym JSON / z `revision` ujemną lub nie-liczbą → `400`, bez mutacji wiersza.
4. `DELETE` z `revision` wyższą niż serwerowa (klient "z przyszłości" — nie powinno się zdarzyć w normalnym użyciu, ale `clientRevision >= serverRevision` akceptuje, tak jak `PUT`) → `200`, zachowanie niezmienione (symetria z `PUT`, gdzie klient z wyższą rewizją też jest akceptowany, nie tylko z równą).
5. `DELETE` na wierszu, który nie istnieje, z jakąkolwiek `revision` w ciele → `200, revision: 0` bez zmian (potwierdza, że wyjątek "brak wiersza" z p.12 nie wymaga już żadnej konkretnej wartości rewizji od klienta).

**`lib/active-workout-cloud-client.test.ts`:**
- `deleteCloud(revision)` wysyła `revision` w ciele żądania (asercja na `fetch` mocku — `JSON.parse(callArgs[1].body).revision === revision`).
- `deleteCloud` na odpowiedzi `409` z `session` → zwraca `{ ok: false, conflict: session }` (nowy kształt, analogiczny do `putCloud`).
- `deleteCloud` na odpowiedzi `200` → `{ ok: true, revision }` (bez zmiany zachowania widzianego przez wywołującego, poza nowym argumentem wejściowym).

**Sonda (poza repozytorium, jak w poprzednich rundach testera) — powtórka EXACT scenariusza 13.4 na prawdziwych handlerach + funkcjach klienckich (nie przez komponent React, zgodnie z ograniczeniem testowym tego repo, p.13.5):** C z pustą kartą i `readRevision() === 0` wywołuje `deleteCloud(0)` na prawdziwym `handleDELETE` (harness `createMemoryDb`) z wcześniej ustawionym stanem A→S1→tombstone→S2 — musi dać `{ ok: false, conflict: {...} }`, a bezpośredni odczyt bazy musi pokazać S2 nienaruszone.

### 16.6 Czy to zamyka CAŁĄ rodzinę błędów (ocena explicite, nie tylko ten jeden przypadek)

**Ocena architekta: TAK — ta naprawa zamyka ostatnią, fundamentalną asymetrię, która była wspólną przyczyną źródłową wszystkich sześciu rund tej rodziny, i robi to w sposób, który p.15.7 jeszcze nie rozważył.**

Rekonstrukcja łańcucha przyczynowego sześciu rund, z tej perspektywy:
- **B-1b** (p.12): `DELETE` zerował rewizję do 0, otwierając okno na nadpisanie przez zaległego klienta z `PUT`. Naprawa: rewizja monotoniczna. Ale `DELETE` samo wciąż nie miało kontroli wejścia.
- **B-1c/B-1d** (p.13): efekty uboczne naprawy p.12 (wartownik klienta, GET-ghost) nadpisywały *cały payload* bez względu na tożsamość. Naprawa: zwężenie warunków wyzwalających. Ale `DELETE` samo wciąż mutowało bez kontroli wejścia — te naprawy dotyczyły efektów PO wygaszeniu (co robi GET, co robi klient z konfliktem), nie samego wejścia do `DELETE`.
- **N-P13-1/N-P13-6** (p.14-15): tombstone nie niósł/gubił tożsamość, więc zaległe-ale-prawdziwe urządzenia błędnie rozstrzygały konflikt. Naprawa: `clearedSessionStartedAtMs` + `resolveClearedSessionIdentity`. To są poprawki DANYCH wyjściowych z `DELETE` (co jest zapisywane w tombstonie), nie WARUNKU WEJŚCIA (kto ma prawo wygasić wiersz).
- **N-P13-7** (p.16, ta naprawa): pierwszy defekt, który dotyczy samego **wejścia** do `handleDELETE` — czy wywołujący ma jakiekolwiek prawo (w sensie wiedzy o aktualnym stanie) wygasić wiersz. Wszystkie pięć poprzednich rund **zakładały**, że to wejście jest bezpieczne (albo nie zauważyły, że nie jest) i naprawiały wyłącznie to, co się dzieje PO nim — coraz dokładniejsza księgowość (monotoniczna rewizja, tożsamość tombstone, zachowanie tożsamości przy idempotencji) na fundamencie, który sam był nieszczelny. To jest dokładnie wzorzec z pięciu rund "łatka na łatkę" — i dokładnie to, co uzasadnia, że tym razem właściwą odpowiedzią jest naprawić FUNDAMENT (symetria z `PUT`), nie dodać siódmą warstwę księgowości.

**Argument wyczerpania (analogiczny do p.15.7, ale na poziomie wyżej):** `PUT` od p.1 miał kontrolę rewizji na WEJŚCIU — to jest powód, dla którego `PUT` nigdy nie było źródłem żadnej z sześciu rund tej rodziny (żaden z defektów B-1b..N-P13-7 nie był błędem w logice `handlePUT` samej; wszystkie znalezione defekty żyły w `DELETE`, `GET`-ghost, albo w interpretacji odpowiedzi klienta). Po tej naprawie `DELETE` ma tę samą właściwość. Oba mutujące endpointy tego zasobu (`PUT`, `DELETE`) teraz wymagają od wywołującego dowodu wiedzy o aktualnym stanie, zanim go zmienią — `GET` nigdy nie mutuje na podstawie zewnętrznego wejścia (tylko na podstawie własnego odczytu, co jest z definicji bezpieczne). Nie ma już żadnej mutującej operacji w tym zasobie, która przyjmuje żądanie bez weryfikacji względem aktualnego stanu serwera.

**Czy to mogłoby ujawnić SIÓDMY wariant?** Jedyna kategoria pozostawiona poza tym mechanizmem to te już explicite nazwane w p.15.7 pkt 4 jako inne kategorie ryzyka (pętla ponowień/rate-limit — N-P13-3; `pagehide`/offline w realnym środowisku; dwie karty na TYM SAMYM urządzeniu/`localStorage`) — żadna z nich nie jest kwestią "DELETE bez kontroli rewizji", bo ta naprawa usuwa tę kategorię z istnienia (nie zwęża ją, usuwa ją — nie ma już ścieżki `DELETE`→mutacja bez porównania rewizji, pełny stop). Dwie karty na tym samym urządzeniu to odrębny wektor (współdzielony `localStorage`, nie wyścig serwerowy między urządzeniami) — nieobjęty tą naprawą, ale też nieobjęty ŻADNĄ z poprzednich pięciu, i jawnie odnotowany w p.15.7 jako wymagający odrębnej analizy, nie łatki. Nie jest to nowy, nieujawniony dotąd róg tej samej tabeli.

**Uczciwe zastrzeżenie**: "kompletność" jest, jak w p.15.7, względna wobec PRZYJĘTEGO modelu (jeden wiersz na użytkownika, jedna rewizja, kontrola optymistycznej współbieżności na obu operacjach mutujących). To jest teraz model SYMETRYCZNY (PUT i DELETE identyczne co do kontroli wejścia) — a to jest silniejsza własność niż "kompletność w obrębie znanych scenariuszy testowych" z p.15.7, bo nie zależy od wyczerpania przestrzeni scenariuszy testerem, tylko od strukturalnej właściwości kodu (każda mutacja wymaga dowodu aktualności). Rekomendacja: to **jest** moment, żeby zakończyć szukanie kolejnych wariantów tej rodziny i przyjąć ten mechanizm jako zamknięcie całej klasy — kolejne odrzucenie w tym obszarze powinno wrócić do analizy modelu (siódmy ADR), tylko jeśli dotyczy kategorii SPOZA "mutacja bez dowodu aktualnej rewizji" (np. wielosesyjność, współdzielony `localStorage` między kartami) — nie jeśli jest kolejnym wariantem tej samej, teraz zamkniętej kategorii.

### 16.7 Konsekwencje i kompromisy

- Zmiana kontraktu `DELETE /api/active-workout-session`: wymaga teraz ciała `{ revision: number }` — **to jest zmiana łamiąca** dla jakiegokolwiek klienta, który wysyłał `DELETE` bez ciała. Zweryfikowane (grep całego repo): jedyny klient tego endpointu to `deleteCloud()` w `lib/active-workout-cloud-client.ts`, aktualizowany w tej samej naprawie. Android/Java nie używają tego mechanizmu synchronizacji aktywnej sesji (potwierdzone w p.9, p.12, p.13, p.14, p.15, bez zmian tutaj) — brak wpływu na wersjonowanie Androida, brak wpływu na Javę.
- `withApiErrors` (wrapper na eksportowanych handlerach) nie zmienia się — walidacja 400 dla brakującego/niepoprawnego ciała jest analogiczna do istniejącej w `handlePUT`, ten sam wzorzec kodu błędu.
- Rozjazd wdrożeniowy (stary klient / nowy serwer) w oknie Preview→Promote: stary `deleteCloud()` (bez ciała) trafiający na nowy serwer dostałby `400` (zod `safeParse` na `undefined`/`{}` nie przejdzie) — w modelu Vercel (atomowe wdrożenie jednego route handlera) to nie powinno się zdarzyć (ten sam argument jak w p.13.5), ale w razie rozjazdu efekt jest **bezpieczny** (żądanie odrzucone, nie ślepa mutacja) — różni się to pozytywnie od ryzyk odnotowanych w poprzednich punktach ADR, gdzie rozjazd był neutralny; tutaj rozjazd jest przy najgorszym razie "DELETE nie działa chwilowo", nigdy "DELETE kasuje coś błędnie".
- Koszt: zero nowych zapytań do bazy (ten sam `SELECT`, który już istnieje w `handleDELETE`, teraz czytany też dla `deviceId`/`updatedAt` potrzebnych w `buildRevisionConflictResponse` — te dwie kolumny już są w tabeli, tylko nie były dotąd selekcjonowane przez `handleDELETE`; drobny narzut SELECT, nie nowe zapytanie).
- Odrzucona alternatywa dla całości (polecenie, krok 2 implicite): "szukać siódmego wariantu tej samej łatkowej ścieżki". Odrzucona na rzecz naprawy fundamentu — uzasadnienie w 16.6.

### 16.8 Werdykt p.16

**ZATWIERDZONE — gotowe do implementacji.** Zakres: jeden nowy helper (`buildRevisionConflictResponse`, refaktor bez zmiany zachowania `PUT`), jeden nowy schemat Zod i jeden warunek w `handleDELETE`, zmiana sygnatury i kształtu odpowiedzi `deleteCloud()`, aktualizacja dwóch (jedynych) wywołań w `active-workout-cloud-sync.tsx`. Bez zmiany schematu bazy, bez wpływu na Android/Javę (potwierdzone, mechanizm nieużywany przez te ścieżki). **Jest to zmiana łamiąca kontrakt HTTP endpointu** (DELETE teraz wymaga ciała) — jedyny klient jest aktualizowany w tej samej naprawie, zero zewnętrznych konsumentów do skoordynowania.

Ocena kompletności rodziny błędów (16.6): **TAK, ta naprawa zamyka całą rodzinę B-1b/B-1c/B-1d/N-P13-1/N-P13-6/N-P13-7** w obrębie przyjętego modelu (jeden wiersz, jedna rewizja, kontrola optymistycznej współbieżności symetryczna na `PUT` i `DELETE`) — nie tylko ten jeden przypadek. Pozostałe, nieobjęte kategorie (N-P13-2 zamknięte jako efekt dodatkowy — patrz 16.4 punkt 4; N-P13-3 rate-limit/backoff, offline/`pagehide` w realnym środowisku, dwie karty na tym samym urządzeniu) są odrębnymi kategoriami ryzyka, już wcześniej nazwanymi w p.15.7 jako wymagające osobnej analizy, nie wariantami tej rodziny.

Przegląd architekta po implementacji **nie jest wymagany automatycznie** — wywołać go tylko, jeśli `backend`/`frontend` zgłosi niepewność (w szczególności: obsługa konfliktu `DELETE` w `push()`, krok 4b wyżej, jest nowym kodem, nie czystym refaktorem — jeśli `frontend` ma wątpliwość co do zachowania `clearedPushedRef` po konflikcie, to jest właściwy moment na konsultację), albo `tester` znajdzie w teście regresji z 16.5 wynik niezgodny z projektem (w szczególności: scenariusz 16.5.1, dokładna replika sondy testera, musi dać `409` i **zero mutacji** wiersza S2).

Warunek zamknięcia u `tester`: scenariusz 16.5.1 (dokładna replika sondy 13.4) przechodzi z wynikiem `409`/brak mutacji; cała macierz 15.5 (a)-(f) powtórzona i wciąż zielona (regresja na mechanizm tombstone, teraz z wymaganą rewizją w ciele DELETE); `npm test`, `npx tsc --noEmit`, `npm run lint` bez nowych regresji względem baseline. Jeśli to przechodzi: zgodnie z 16.6, kolejne odrzucenie w tym obszarze powinno celować w analizę modelu dla kategorii SPOZA "mutacja bez dowodu rewizji" (wielosesyjność, współdzielony `localStorage` między kartami), nie w kolejną łatkę tej samej kategorii.

**Werdykt p.16.6 unieważniony przez tester etapu 7g (`docs/testy/005-...` sekcja 14): obalony sondami P3/P4/P5 — sprawdzenie i zapis nie są atomowe. Patrz p.17.**

---

## 17. Naprawa źródłowa N-P13-8 — atomowy zapis przez CAS (etap 7g → 3, siódmy defekt, PRAWDZIWA przyczyna źródłowa)

- Status: zaproponowany
- Data: 2026-10-25
- Wejście: `docs/testy/005-koniec-treningu-przeplyw.md` sekcja 14 (defekt N-P13-8, sondy P2-P5, werdykt tester etapu 7g: ODRZUCONE, argument kompletności p.16.6 **obalony**), ten ADR p.1 (mechanizm rewizji oryginalny — PUT), p.16 (naprawa DELETE, zostaje bez odwrócenia — błąd leżał gdzie indziej)

### 17.0 Przyznanie błędu architekta w p.16.6

p.16.6 twierdził: "nie ma już żadnej mutującej operacji w tym zasobie, która przyjmuje żądanie bez weryfikacji względem aktualnego stanu serwera". To jest **prawdziwe w sensie składniowym** (każda mutacja ma warunek `if (clientRevision < serverRevision) return 409`) i **fałszywe w sensie operacyjnym**: warunek jest sprawdzany na wyniku `SELECT`, a `UPDATE`, który następuje kilka linii (i jedną rundę do bazy) później, nie jest w żaden sposób związany z tym samym momentem w czasie. "Weryfikacja względem aktualnego stanu serwera" była cichym założeniem "aktualny stan w chwili SELECT = aktualny stan w chwili UPDATE" — założenie, które jest fałszywe pod współbieżnością z definicji (to jest właśnie definicja TOCTOU). p.16.1-16.2 poprawnie przeanalizowały **kto ma prawo wygasić wiersz** (dowód wiedzy o rewizji), ale nigdy nie zadały pytania **czy dowód jest jeszcze prawdziwy w chwili, gdy jest używany do zapisu**. To jest różnica między "kontrolą dostępu" (kogo wpuszczamy) i "atomowością" (czy to, co robimy po wpuszczeniu, jest niepodzielne) — p.16 naprawiło pierwsze, zakładając bez dowodu drugie.

### 17.1 Decyzja

Trzy mutujące operacje na `activeWorkoutSessions` (`handlePUT` ścieżka UPDATE, `handlePUT` ścieżka INSERT, `clearRow` używany przez `handleDELETE` i `handleGET`-ghost) przechodzą z wzorca **SELECT-then-UPDATE** (sprawdź, potem zapisz — dwa kroki, okno między nimi) na **CAS (compare-and-swap) w jednym zapytaniu**: `UPDATE ... WHERE user_id = ? AND revision = ?`, gdzie druga wartość to rewizja, którą ten sam handler WŁAŚNIE odczytał (nie deklaracja klienta — `clientRevision`/`parsed.data.revision` nigdy nie trafia do warunku `WHERE`, tylko do wcześniejszego porównania "czy klient ma prawo w ogóle próbować"). Jeśli `UPDATE` nie trafi w żaden wiersz (bo rewizja zmieniła się między SELECT a UPDATE — ktoś inny wygrał wyścig), handler **nie zgłasza błędu 500 i nie udaje sukcesu**: odczytuje wiersz PONOWNIE (świeży stan, autorytatywny w chwili odpowiedzi) i na jego podstawie odpowiada — `409` dla `PUT`/`DELETE` (zgodnie z istniejącym kontraktem konfliktu z p.1/p.16), bez 409 dla `GET` (które nigdy nie zwracało konfliktu — zamiast tego zwraca stan na podstawie świeżego wiersza, bez próby drugiego zapisu).

Ścieżka `INSERT` w `handlePUT` (brak `existing` przy pierwszym SELECT) ma analogiczną, dotąd nienazwaną lukę: dwa równoczesne pierwsze zapisy tego samego użytkownika (teoretycznie niemożliwe dla jednego człowieka na dwóch urządzeniach bez wcześniejszej synchronizacji, ale realne jako klasa błędu, nie tylko w tym jednym przypadku) oba widzą `existing === undefined` i oba próbują `INSERT`. Ponieważ `userId` jest kluczem głównym (`db/schema.ts:562`), drugi `INSERT` nie "wygrywa cicho" — rzuca błąd unikalności. Dotąd ten błąd nie był przechwytywany (uciekłby jako 500 przez `withApiErrors`). Naprawa ujednolica to z resztą mechanizmu: przechwycić, odczytać świeży wiersz, odpowiedzieć `409` jak przy każdym innym przegranym wyścigu — nie jest to nowy mechanizm, tylko rozszerzenie tej samej zasady ("przegrana w wyścigu o zapis = świeży odczyt + konflikt, nigdy 500 i nigdy cicha fikcja sukcesu") na trzeci, dotąd przeoczony punkt wejścia.

### 17.2 Wybór mechanizmu CAS: `RETURNING`, nie `rowsAffected`

Dwa warianty sprawdzenia "czy mój `UPDATE` faktycznie trafił":
1. `result.rowsAffected` (pole `ResultSet` z `@libsql/client`, potwierdzone w repo przez `lib/account-takeover.ts:213` — ale tylko w kontekście `db.batch(...)`, nie potwierdzone dla pojedynczego `await db.update(...).where(...)` poza `batch`).
2. `.returning({ revision: activeWorkoutSessions.revision })` + sprawdzenie `.length > 0` — klauzula `RETURNING` (SQLite/libSQL wspiera ją naturalnie), już używana w tym repozytorium w analogicznej roli: `app/api/payments/hotpay/notify/route.ts:78-92` (`UPDATE ... WHERE status = 'pending' ... RETURNING id`, `changed.length > 0` jako dowód, że TO wywołanie wygrało przejście stanu `pending → paid`, nie inne, równoczesne).

**Decyzja: wariant 2 (`.returning()`)** — nie dlatego, że wariant 1 jest błędny (prawdopodobnie też działa, drizzle-orm/libsql przekazuje `ResultSet` z `rowsAffected` również poza `batch`), ale dlatego, że wariant 2 ma **już sprawdzony w produkcji precedens w tym repo dla identycznej roli** (CAS na warunkowym `UPDATE`, dokładnie ten sam wzorzec: zapytanie, które zapisuje TYLKO jeśli stan jest wciąż taki, jak wywołujący sądzi, i rozpoznaje przegraną przez puste `RETURNING`), więc nie wprowadza nowej, nigdzie wcześniej nieprzetestowanej ścieżki przez sterownik libSQL/Turso. Zasada "preferuj sprawdzone, nudne technologie i obecny stos" (instrukcja architekta) wskazuje na powtórzenie wzorca `hotpay/notify`, nie na wprowadzenie `rowsAffected` jako drugiego, równoległego sposobu robienia tego samego w tym samym pliku co jutro ktoś pomyli.

### 17.3 Projekt — `clearRow` (używany przez `handleDELETE` i `handleGET`-ghost)

```ts
/**
 * Wygasza wiersz CAS-owo (005, N-P13-8, ADR p.17): `UPDATE` jest warunkowany
 * `revision = currentRevision` — rewizją, którą WYWOŁUJĄCY WŁAŚNIE odczytał w tym
 * samym żądaniu, nigdy deklaracją klienta. Jeśli między tamtym SELECT a tym UPDATE
 * ktoś inny zapisał wiersz (rewizja już inna), `RETURNING` nie zwraca wiersza —
 * funkcja zwraca `null` (PRZEGRANA wyścigu), zamiast fałszywie zwracać
 * `nextRevision`, którego wiersz NIE przyjął (to był dokładnie błąd N-P13-8:
 * dotąd ta funkcja zawsze "wygrywała", bo `WHERE` nie zawierał rewizji).
 */
async function clearRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  currentRevision: number,
  clearedSessionStartedAtMs: number | null,
): Promise<number | null> {
  const nextRevision = currentRevision + 1;
  const updated = await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(buildActiveWorkoutClearedPayload(clearedSessionStartedAtMs)),
      revision: nextRevision,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(activeWorkoutSessions.userId, userId),
        eq(activeWorkoutSessions.revision, currentRevision),
      ),
    )
    .returning({ revision: activeWorkoutSessions.revision });
  return updated.length > 0 ? nextRevision : null;
}
```

Sygnatura zwraca teraz `number | null` (dotąd: `number`, zawsze "sukces"). **Wszyscy dwaj wywołujący muszą obsłużyć `null`** — to jest zmiana kontraktu wewnętrznego, wymuszona przez TypeScript (`npx tsc --noEmit` nie przejdzie, jeśli ktoś to przeoczy — strażnik kompilatora, nie tylko przegląd).

### 17.4 Projekt — `handleDELETE`

```ts
const existingPayload = parsePayloadJson(existing.payloadJson);
const clearedSessionStartedAtMs = resolveClearedSessionIdentity(existingPayload);
const nextRevision = await clearRow(db, userId, existing.revision, clearedSessionStartedAtMs);

if (nextRevision === null) {
  // PRZEGRANA wyścigu (005, N-P13-8): między naszym SELECT i tym UPDATE ktoś inny
  // (inne urządzenie, PUT albo DELETE równoległy) zapisał ten wiersz. `existing`,
  // które mieliśmy, jest NIEAKTUALNE — nie wolno budować odpowiedzi z niego (to był
  // dokładnie ten błąd, który testerzy złapali sondą P3: 409 na podstawie
  // przestarzałego stanu wyglądałby na poprawny, ale ukrywałby, że wiersz już
  // wygląda inaczej). Odczyt PONOWNY, świeży, autorytatywny w chwili odpowiedzi.
  const [fresh] = await db
    .select({
      revision: activeWorkoutSessions.revision,
      payloadJson: activeWorkoutSessions.payloadJson,
      deviceId: activeWorkoutSessions.deviceId,
      updatedAt: activeWorkoutSessions.updatedAt,
    })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);
  // Wiersz nigdy nie jest fizycznie usuwany (p.12) — skoro właśnie przegraliśmy
  // wyścig o UPDATE, wiersz musi istnieć (ktoś go właśnie zapisał). `!fresh` jest
  // teoretycznie nieosiągalne; zachowujemy fallback zamiast zakładać to w typach,
  // żeby nie rzucić 500 w nieprzewidzianym przypadku.
  if (!fresh) return NextResponse.json({ ok: true, revision: 0 });
  return buildRevisionConflictResponse(fresh);
}

return NextResponse.json({ ok: true, revision: nextRevision });
```

To jest **jedyna zmiana** w `handleDELETE` poza wywołaniem `clearRow` (CSRF, auth, rate limit, walidacja, warunek `clientRevision < existing.revision` z p.16 — bez zmian).

### 17.5 Projekt — `handleGET`-ghost (dwie gałęzie, bez 409 — GET nigdy nie zwracał konfliktu)

`GET` jest inny niż `PUT`/`DELETE`: nie ma "klienta, który deklaruje rewizję i zasługuje na 409". Ma tylko obowiązek zwrócić **prawdziwy, aktualny stan**. Gdy `clearRow` przegra wyścig w trakcie opportunistycznego czyszczenia ducha, właściwa odpowiedź nie jest błędem — jest odczytaniem tego, co faktycznie jest teraz w wierszu, i zbudowaniem z tego normalnej odpowiedzi `GET` (ewentualnie: sesja aktywna i świeża, jeśli to ona wygrała wyścig — scenariusz P4 dokładnie to testuje).

Refaktor `handleGET` na wspólną funkcję oceny wiersza, wywoływaną raz na odczyt i (co najwyżej) raz na odczyt-po-przegranym-CAS (głębokość rekursji ograniczona do 1 — `allowClear: false` przy drugim wywołaniu, żeby nie można było zapętlić się w nieskończoność; druga przegrana w tym samym żądaniu w ciągu mikrosekund jest na tyle mało prawdopodobna i na tyle nieszkodliwa — brak mutacji przy odrzuceniu drugiej próby, tylko odczyt tego, co jest — że nie wymaga pętli `while`):

```ts
async function evaluateActiveRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  row: {
    revision: number;
    payloadJson: string;
    deviceId: string;
    updatedAt: Date | number;
  },
  allowClear: boolean,
): Promise<Response> {
  const payload = parsePayloadJson(row.payloadJson);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.getTime() : Number(row.updatedAt);

  if (!payload) {
    if (allowClear) {
      const next = await clearRow(db, userId, row.revision, resolveClearedSessionIdentity(null));
      if (next === null) return retryFreshRead(db, userId);
    }
    return NextResponse.json({ ok: true, session: null });
  }

  if (!hasActiveLocalSession(payload)) {
    return NextResponse.json({ ok: true, session: null });
  }

  if (!isActiveWorkoutCloudFresh(updatedAt)) {
    if (allowClear) {
      // NOWE (005, N-P13-8): dotąd `clearRow` tutaj "wygrywał" zawsze, nawet gdy
      // między SELECT w `handleGET` i tym UPDATE ktoś (np. A z sondy P4) zapisał
      // FRESH, AKTYWNĄ sesję — ta świeża sesja była wygaszana po cichu (utrata
      // danych). Teraz: przegrana CAS → odczyt świeży → ocena od nowa, bez
      // kolejnej próby czyszczenia (`allowClear: false`).
      const next = await clearRow(
        db,
        userId,
        row.revision,
        resolveClearedSessionIdentity(payload),
      );
      if (next === null) return retryFreshRead(db, userId);
    }
    return NextResponse.json({ ok: true, session: null });
  }

  return NextResponse.json({
    ok: true,
    session: { payload, revision: row.revision, deviceId: row.deviceId, updatedAt },
  });
}

async function retryFreshRead(db: ReturnType<typeof getDb>, userId: string): Promise<Response> {
  const [fresh] = await db
    .select()
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);
  if (!fresh) return NextResponse.json({ ok: true, session: null });
  return evaluateActiveRow(db, userId, fresh, false);
}
```

`handleGET` samo staje się cienkie: `SELECT` początkowy, `if (!row) return { session: null }`, inaczej `return evaluateActiveRow(db, session.user.id, row, true)`.

Przebieg P4 pod tą naprawą: `GET` czyta wiersz przeterminowany (rev 1, aktywny payload S-old). `isActiveWorkoutCloudFresh` = false → próba `clearRow(rev 1)`. Współbieżnie A robi `PUT {revision:1}` z S-new → serwer zapisuje rev 2 (CAS A trafia, bo A był pierwszy do `UPDATE`... **UWAGA**: w P4 to GET traci wyścig, czyli `clearRow` GET-a wykonuje się PO `PUT` A — `clearRow`'s `WHERE revision = 1` nie trafia (serwer ma już rev 2) → `null` → `retryFreshRead` → świeży wiersz: rev 2, payload S-new, `updatedAt` = teraz (A właśnie zapisał) → `evaluateActiveRow(fresh, allowClear=false)`: payload aktywny, świeży → zwraca `session: S-new`. **S-new przetrwa**, zgodnie z oczekiwaniem testera.

### 17.6 Projekt — `handlePUT` (ścieżka UPDATE i ścieżka INSERT)

```ts
if (existing) {
  const updated = await db
    .update(activeWorkoutSessions)
    .set({ payloadJson, revision: nextRevision, deviceId: parsed.data.deviceId, updatedAt: now })
    .where(
      and(
        eq(activeWorkoutSessions.userId, userId),
        eq(activeWorkoutSessions.revision, serverRevision),
      ),
    )
    .returning({ revision: activeWorkoutSessions.revision });

  if (updated.length === 0) {
    // PRZEGRANA wyścigu (005, N-P13-8, sonda P5): między naszym SELECT i tym UPDATE
    // ktoś inny zapisał ten wiersz. Dotąd ten UPDATE nie miał `revision` w `WHERE`,
    // więc zawsze trafiał — nadpisując cudzy, nowszy zapis, mimo że `clientRevision
    // < serverRevision` już było false w chwili SELECT (fałszywe bezpieczeństwo).
    const [fresh] = await db
      .select()
      .from(activeWorkoutSessions)
      .where(eq(activeWorkoutSessions.userId, userId))
      .limit(1);
    if (!fresh) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowy payload." }, { status: 400 });
    }
    return buildRevisionConflictResponse(fresh);
  }
} else {
  try {
    await db.insert(activeWorkoutSessions).values({
      userId,
      payloadJson,
      revision: nextRevision,
      deviceId: parsed.data.deviceId,
      updatedAt: now,
    });
  } catch (err) {
    // NOWE (005, N-P13-8, dotąd nienazwana trzecia luka): dwa równoczesne PIERWSZE
    // zapisy (oba widzą `existing === undefined`) — `userId` jest kluczem głównym
    // (`db/schema.ts:562`), więc drugi `INSERT` rzuca naruszenie unikalności, nie
    // "wygrywa cicho". Przechwytujemy i odpowiadamy jak przy każdej innej przegranej
    // wyścigu — NIGDY 500 za czyjś wyścig, który przegraliśmy.
    if (!isUniqueViolation(err)) throw err;
    const [fresh] = await db
      .select()
      .from(activeWorkoutSessions)
      .where(eq(activeWorkoutSessions.userId, userId))
      .limit(1);
    if (!fresh) throw err; // naruszenie unikalności implikuje istnienie wiersza — nieosiągalne
    return buildRevisionConflictResponse(fresh);
  }
}

return NextResponse.json({ ok: true, revision: nextRevision, updatedAt: now.getTime() });
```

`isUniqueViolation` importowany z **istniejącego** `db/errors.ts` (nie duplikat lokalnej `isUniqueConstraintError` z `app/api/workouts/complete/route.ts` — ten plik ma już własną, osobną definicję tej samej logiki; to jest preistniejący dług, nie wprowadzany tu, odnotowany w p.17.9 jako kandydat do scalenia, poza zakresem tej naprawy, bo dotyka pliku, którego ta naprawa w ogóle nie zmienia).

### 17.7 Czy potrzebna jest pętla retry po stronie serwera?

**Nie, dla `PUT`/`DELETE` — zwrócenie `409` jest wystarczające i spójne z resztą mechanizmu.** Uzasadnienie:
- `PUT`/`DELETE` mają już ustalony, symetryczny kontrakt "przegrana w porównaniu rewizji = 409, klient decyduje, czy i jak ponowić" (p.1, p.16). CAS tylko przesuwa MOMENT tego porównania z "przed zapisem" na "w trakcie zapisu" (atomowo) — nie zmienia FILOZOFII odpowiedzi na przegraną. Serwer odpowiadający 409 od razu po przegranej CAS jest więc kontynuacją istniejącego wzorca, nie nowym zachowaniem do zaprojektowania od zera.
- Klient (`active-workout-cloud-sync.tsx`) **już ma** logikę reagowania na 409 (`shouldApplyConflictPayload`, `writeRevision(result.conflict.revision)`, ponowny `push()` w niektórych gałęziach) — pętla retry na serwerze byłaby drugim mechanizmem obsługi tego samego zdarzenia, zbędnym kosztem (opóźnienie żądania o kolejne rundy do bazy) bez korzyści, bo klient i tak dostaje świeży stan w treści 409 i może zdecydować sam.
- Retry server-side miałby sens, gdyby odpowiedzią na przegraną MIAŁO BYĆ ponowienie TEJ SAMEJ intencji zapisu z nowymi danymi obliczonymi na nowo (np. "dodaj 1 do licznika" — idempotentna operacja arytmetyczna, gdzie przegrana i ponowienie z nowym stanem bazowym ma sens). Tu intencja zapisu to "zapisz TEN KONKRETNY payload z urządzenia X" — po przegranej, "ponowienie" nie miałoby żadnego nowego stanu bazowego do uwzględnienia (payload klienta się nie zmienia), więc automatyczne ponowienie serwera dałoby identyczny wynik: albo wygrałoby (bo w międzyczasie nikt inny nie pisze) — co i tak się zdarzy przy następnym żądaniu klienta po 409 — albo przegrałoby znowu identycznie. Pętla nie zwiększa szansy sukcesu wobec **tej samej** przyczyny przegranej (trwająca kolizja dwóch aktywnych urządzeń), tylko opóźnia odpowiedź.

**`GET`-ghost jest inny i NIE dostaje 409 (p.17.5) — to już jest wariant "jeden retry, bez pętli", nie "409 i koniec".** Uzasadnienie głębokości 1 (nie więcej, nie pętla `while(true)`): GET nie ma kontraktu błędu do zwrócenia klientowi (zawsze `{ ok: true, session: ... }`), więc jedyna alternatywa dla "jeden retry" byłaby "pętla retry aż się uda" — zbędna, bo po PIERWSZYM przegranym CAS i odczycie świeżego wiersza, odpowiedź JEST już poprawna niezależnie od tego, czy wiersz w międzyczasie (po tym odczycie, przed wysłaniem odpowiedzi) zmieni się znowu — to jest nieodłączna właściwość KAŻDEGO `GET` w systemie współbieżnym (odpowiedź jest zawsze stanem "w przeszłości względem momentu odebrania jej przez klienta"), nie defekt tej naprawy. Próba "domknięcia" tego przez pętlę retry w GET gonił(aby) cel nieosiągalny z definicji.

### 17.8 Testy regresji wymagane (dokładna replika sond P2-P5 testera)

**`app/api/active-workout-session/route.test.ts`** — nowy blok "CAS / wyścig między SELECT i UPDATE (005, N-P13-8, ADR p.17)", wstrzykujący współbieżny zapis między odczytem handlera a jego zapisem (ten sam mechanizm sondy testera z 14.1: opakowanie `client.execute`/`db.update` tak, by PRZED wykonaniem `UPDATE`/`INSERT` danego wywołania uruchomić drugie, "wygrywające" żądanie na tym samym wierszu):

1. **Replika P3 (TOCTOU DELETE)**: `PUT` A S1 (rev 0→1); `DELETE` A `{revision:1}` wstrzyknięty tak, że TUŻ PRZED jego `UPDATE` w `clearRow` wykonuje się `PUT` B `{revision:1}` z S3 (→ rev 2). Oczekiwane: `DELETE` A dostaje `409` z `conflict.session` = S3 (rev 2, `deviceId` B); bezpośredni `SELECT` po teście potwierdza wiersz = S3 aktywne, rev 2, **nietknięte** przez `DELETE` A.
2. **Replika P4 (TOCTOU GET-ghost)**: wiersz z aktywnym payloadem S-old, `updatedAt` 24h temu (przeterminowany), rev 1. `GET` wstrzyknięty tak, że TUŻ PRZED `UPDATE` w `clearRow` wykonuje się `PUT` A `{revision:1}` z S-new (→ rev 2). Oczekiwane: `GET` zwraca `session` aktywną z payloadem S-new, rev 2 (NIE `session: null`); `SELECT` po teście potwierdza rev 2, payload S-new, **brak tombstone'u**.
3. **Replika P5 (TOCTOU PUT-vs-PUT)**: wiersz rev 1 (A-initial). `PUT` A `{revision:1}` z A-edit wstrzyknięty tak, że TUŻ PRZED jego `UPDATE` wykonuje się `PUT` B `{revision:1}` z B-edit (→ rev 2, pierwszy). Oczekiwane: `PUT` A dostaje `409` z `conflict.session.payload` = B-edit, rev 2; `SELECT` po teście potwierdza B-edit **nietknięty** (A nigdy nie napisał A-edit nad nim).
4. **Replika P2 (kontrola — jednostronność `>=` ZOSTAJE, nie jest błędem)**: `DELETE {revision: 1000000}` na wierszu rev 2 (bez wstrzykniętego wyścigu, sekwencyjnie) → `200`, wiersz wygaszony. Explicite test komentarzem: **to jest zamierzone** — klient z rewizją ≥ serwerowej ma prawo zapisać/wygasić (p.1, p.16.2); naprawa CAS nie zmienia tej semantyki, zmienia tylko ATOMOWOŚĆ sprawdzenia-i-zapisu, nie SAM warunek porównania (`>=` zostaje `>=`, nie staje się `===`). Test istnieje, żeby ktoś w przyszłości nie "naprawił" tego przez przypadek przy kolejnej rundzie.
5. **Przegrana `INSERT` (nowa, trzecia luka z p.17.1, bez odpowiednika w sondach testera — nienazwana dotąd)**: wiersz nie istnieje. Dwa równoczesne `PUT` (oba widzą `existing === undefined`) wstrzyknięte tak, że `INSERT` B wykonuje się PRZED `INSERT` A. Oczekiwane: `INSERT` B → `200, revision: 1`. `INSERT` A łapie naruszenie unikalności → `409` z `conflict.session` = payload B, rev 1; **brak 500**; `SELECT` po teście potwierdza jeden wiersz (payload B).
6. Pełna macierz 15.5 (a)-(f) i scenariusz 16.5.1 (replika 13.4) — **sekwencyjne, bez wstrzykniętego wyścigu** — powtórzone, muszą przejść **niezmienione w wyniku** (to jest czysto wewnętrzna zmiana atomowości zapisu, zero zmiany zachowania dla żądań sekwencyjnych, bo CAS z rewizją właśnie odczytaną zawsze trafia, gdy nikt inny nie pisał w międzyczasie).

**Mechanizm wstrzykiwania wyścigu**: dokładnie ten, który tester opisał w 14.1 — opakowanie metody wykonującej zapytania (np. `client.execute` z `@libsql/client` albo punkt wejścia sesji Drizzle) tak, by przy PIERWSZYM wywołaniu zapisu (UPDATE/INSERT) w ramach testowanego handlera, PRZED jego faktycznym wykonaniem, uruchomić i zaczekać na całe, osobne, konkurencyjne żądanie (inny handler, inna "sesja" bazy danych na tym samym kliencie `:memory:`). Ten plik testowy (albo pomocniczy moduł w `db/test-memory-db.ts`, jeśli backend uzna współdzielenie za warte wydzielenia) jest **nowym, trwałym** fragmentem `route.test.ts` — w przeciwieństwie do jednorazowych sond testera (usuwanych po przebiegu), te testy muszą zostać w repo jako regresja, bo to jest DOKŁADNIE ta klasa błędu, która przeszła niezauważona przez pięć wcześniejszych rund.

### 17.9 Czy to NAPRAWDĘ jest ostatnia przyczyna źródłowa w tym mechanizmie?

**Tak, w obrębie `app/api/active-workout-session/route.ts` — po tej naprawie nie ma już żadnej mutacji na tym zasobie, która nie jest atomowa z własnym sprawdzeniem.** Rekonstrukcja: p.1 dało `PUT` kontrolę rewizji NA WEJŚCIU (SELECT-then-UPDATE, z tą samą luką TOCTOU, tylko nigdy złowioną testem sekwencyjnym — p.14.1 testera: "wszystkie żądania są w nich sekwencyjne, więc nie mogą wykryć P3-P5" — **PUT miał tę lukę od p.1, siedem rund, nikt jej nie zauważył, bo żadna sonda nie testowała współbieżności aż do etapu 7g**). p.16 dało `DELETE` symetryczny warunek NA WEJŚCIU, z tą samą, odziedziczoną luką. Ta naprawa (p.17) jest pierwszą, która atakuje **atomowość samego zapisu**, nie **warunek przed zapisem** — to jest kategoria wyżej niż wszystkie sześć poprzednich rund, które operowały na "czego sprawdzić" i "jaką tożsamość zapisać", nigdy na "czy sprawdzenie i zapis są jednym krokiem". Po tej naprawie: `PUT` (UPDATE i INSERT), `DELETE`, `GET`-ghost — wszystkie trzy mutacje mają CAS. Nie ma czwartej mutacji na tym zasobie.

**Nie, w obrębie całej aplikacji — to jest wzorzec, nie incydent, i inne miejsca w kodzie mają tę samą lukę klasy strukturalnej.** Przeszukanie (`Grep` `\.select\(\)...\.update\(` w zasięgu ~400 znaków, cały `lib/`/`app/`, bez testów) zwraca siedem plików z podobnym kształtem kodu: `lib/community/hof.ts`, `lib/community/team-quests.ts`, `lib/community/team-wars.ts`, `lib/community/progression.ts`, `lib/community/teams.ts`, `lib/meal-catalog-images.ts`, `lib/app-settings.ts`. **Nie każde dopasowanie jest automatycznie tym samym defektem** — SELECT-then-UPDATE jest bezpieczny, gdy: (a) operacja jest commutatywna/idempotentna niezależnie od kolejności (np. `UPSERT` czysto addytywny bez odczytu poprzedniej wartości do decyzji), (b) kolizja dwóch równoczesnych zapisów tego samego użytkownika jest z definicji niemożliwa (dane są per-request, nie per-zasób współdzielony), albo (c) skutek przegranej wyścigu jest nieszkodliwy (np. licznik odczytów w cache, gdzie przegrana to najwyżej jedno przeterminowane odświeżenie, nie utrata danych użytkownika). Żaden z tych siedmiu plików nie był w zakresie analizy tej naprawy (nie dotyczą `activeWorkoutSessions`, nie są częścią zadania 005) — **rekomendacja: osobne zadanie/ADR (dług techniczny, NIE blokujące tego zadania)**, które dla każdego z siedmiu plików ocenia: czy odczytany stan wpływa na WARTOŚĆ zapisu (nie tylko na to, CZY zapis się odbywa), i czy kolizja dwóch użytkowników/urządzeń na tym samym wierszu jest realna w domenie (zespoły, questy, wojny zespołów — **wielu użytkowników współdzieli te wiersze z definicji**, co czyni je a priori bardziej podobnymi do `activeWorkoutSessions` niż `app-settings.ts`/`meal-catalog-images.ts`, które brzmią jak dane per-singleton/per-cache). Priorytet rekomendowany: `lib/community/team-wars.ts` i `lib/community/team-quests.ts` najpierw (współdzielony stan zespołu, wiele urządzeń/użytkowników zapisujących ten sam wiersz — analogiczna topologia do defektu N-P13-8), pozostałe pięć — do oceny w tym samym zadaniu, niższy priorytet.

### 17.10 Pliki do zmiany

**Backend (jedyny zakres — zero zmian kontraktu HTTP, zero zmian frontendu):**
- `app/api/active-workout-session/route.ts` — `clearRow` (sygnatura `Promise<number | null>`, `WHERE` z `revision`, `.returning()`), `handleDELETE` (obsługa `null` z `clearRow` → świeży odczyt → `buildRevisionConflictResponse`), `handleGET` (refaktor na `evaluateActiveRow`/`retryFreshRead`, obsługa `null` z `clearRow` w obu gałęziach), `handlePUT` (CAS na ścieżce UPDATE z `.returning()`, `try/catch isUniqueViolation` na ścieżce INSERT). Nowy import: `and` z `drizzle-orm` (już importowane gdzie indziej w repo, zero nowej zależności), `isUniqueViolation` z `@/db/errors` (istniejący plik, zero nowej zależności).
- `app/api/active-workout-session/route.test.ts` — nowy blok testów p.17.8 (sześć scenariuszy, w tym mechanizm wstrzykiwania wyścigu).

**Bez zmian**: `lib/active-workout-cloud.ts`, `lib/active-workout-cloud-client.ts`, `components/active-workout/active-workout-cloud-sync.tsx`, schemat bazy, kontrakt odpowiedzi `409`/`200` (kształt identyczny z p.1/p.16 — `buildRevisionConflictResponse` nie zmienia się, tylko dostaje świeższe dane wejściowe), Android, Java. To jest wyłącznie zmiana WEWNĘTRZNEJ atomowości zapisu na serwerze — żaden klient (istniejący czy przyszły) nie musi wiedzieć, że ta naprawa się wydarzyła, bo kontrakt obserwowalny z zewnątrz (kody statusu, kształt JSON) jest identyczny; zmienia się tylko to, KTO dostaje `200` a kto `409` w rzadkim, wcześniej źle obsłużonym przypadku współbieżności.

### 17.11 Konsekwencje i kompromisy

- Jedno dodatkowe zapytanie (`SELECT` świeżego wiersza) TYLKO na ścieżce przegranej CAS — czyli tylko wtedy, gdy rzeczywiście doszło do wyścigu (rzadkie, p.14.2: "okno = dziesiątki ms"). Ścieżka bez kolizji (zdecydowana większość żądań) ma identyczny koszt zapytań jak dotąd (jeden SELECT, jeden UPDATE/INSERT) — CAS nie dodaje kosztu w normalnym przypadku, `WHERE` ma po prostu dodatkowy warunek na już istniejącym indeksie klucza głównego.
- `handleGET` rośnie o dwie nowe funkcje (`evaluateActiveRow`, `retryFreshRead`) — uzasadnione, bo bez tego refaktoru obsługa "przegrana CAS → odczyt świeży → ocena od nowa" musiałaby duplikować trzy gałęzie decyzyjne (`!payload`, `!hasActiveLocalSession`, `!isActiveWorkoutCloudFresh`) inline w miejscu wywołania — gorsze dla czytelności i ryzyka rozjazdu dwóch kopii tej samej logiki.
- Odrzucona alternatywa: transakcja Drizzle (`db.transaction`) obejmująca SELECT+UPDATE jako jeden blok. Odrzucona — libSQL/Turso po HTTP (Hrana) nie daje `SELECT ... FOR UPDATE`/blokady wiersza w ramach transakcji w sposób, który eliminowałby TOCTOU między dwoma POŁĄCZENIAMI (dwa równoczesne żądania HTTP to dwa niezależne połączenia/transakcje, nie jedno — transakcja chroni atomowość WEWNĄTRZ jednego żądania, nie między dwoma), więc nie rozwiązuje problemu bez dodatkowo CAS-a i tak; CAS samodzielnie jest prostszy, nie wymaga zarządzania czasem życia transakcji przez sieć HTTP, i jest już sprawdzonym wzorcem w repo (p.17.2).
- Odrzucona alternatywa: pętla retry server-side dla `PUT`/`DELETE`. Odrzucona — uzasadnienie w p.17.7 (zbędna wobec istniejącej, już zaimplementowanej obsługi 409 po stronie klienta; nie zwiększa szansy sukcesu wobec trwającej kolizji).
- Dług techniczny odnotowany, NIE blokujący tego zadania: siedem plików z podobnym wzorcem SELECT-then-UPDATE poza zakresem `activeWorkoutSessions` (p.17.9) — rekomendacja osobnego zadania/ADR; preistniejąca duplikacja `isUniqueConstraintError`(`app/api/workouts/complete/route.ts`) / `isUniqueViolation` (`db/errors.ts`) — ten plik nie jest zmieniany w tej naprawie, scalenie poza zakresem.

### 17.12 Werdykt p.17

**ZATWIERDZONE — gotowe do implementacji.** Zakres: trzy mutujące funkcje w jednym pliku (`clearRow`, `handleDELETE`, `handleGET`, `handlePUT`), zero zmiany schematu bazy, zero zmiany kontraktu HTTP widocznego z zewnątrz, zero wpływu na frontend/Android/Javę (potwierdzone — mechanizm aktywnej sesji w chmurze nieużywany przez te ścieżki, p.9/p.12-16 bez zmian tej oceny). To JEST ostatnia przyczyna źródłowa w obrębie tego zasobu (p.17.9) — żadna mutacja `activeWorkoutSessions` nie zostaje bez CAS po tej naprawie. To NIE jest ostatnia przyczyna źródłowa w obrębie całej aplikacji — siedem innych plików ma podobny wzorzec i wymaga osobnej oceny jako dług techniczny (p.17.9), nie jako blokada tego zadania.

Przegląd architekta po implementacji **nie jest wymagany automatycznie** — wywołać go tylko, jeśli `backend` zgłosi niepewność co do mechanizmu wstrzykiwania wyścigu w testach (p.17.8, jedyny naprawdę nowy rodzaj testu w tym zadaniu — pięć poprzednich rund testowały tylko sekwencyjnie) albo `tester` znajdzie w replikach P3-P5 wynik niezgodny z projektem.

Warunek zamknięcia u `tester`: wszystkie sześć scenariuszy p.17.8 przechodzą z oczekiwanym wynikiem (P3/P4/P5 — zero utraty danych drugiej strony, zwycięzca ustalony przez faktyczną kolejność zapisu w bazie, nie przez to, kto pierwszy wykonał SELECT; P2 — jednostronność `>=` zostaje; INSERT-wyścig — 409, nie 500); cała macierz 15.5 (a)-(f) i scenariusz 16.5.1 bez zmiany wyniku; `npm test`, `npx tsc --noEmit`, `npm run lint` bez nowych regresji względem baseline (142/104/38 wg ostatniego pomiaru 14.6). Jeśli to przechodzi: rodzina B-1b/B-1c/B-1d/N-P13-1/N-P13-2/N-P13-6/N-P13-7/N-P13-8 jest zamknięta jako kategoria "mutacja na `activeWorkoutSessions` bez atomowego dowodu aktualności" — kolejne odrzucenie w TYM zasobie powinno celować w kategorię strukturalnie inną (wielosesyjność/współdzielony `localStorage` między kartami, już nazwane w p.15.7/p.16.6 jako odrębne), nie w siódmy-ósmy wariant tej samej, teraz naprawionej na poziomie atomowości, klasy.
