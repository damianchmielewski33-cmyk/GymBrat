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
