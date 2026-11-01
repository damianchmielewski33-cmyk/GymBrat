# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: active-workout.spec.ts >> Aktywny trening (004) >> US-8: „Zapisz serię” jednym dotknięciem -> przerwa z kartą Zapisano i zielonym postępem
- Location: e2e\active-workout.spec.ts:219:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - img [ref=e11]
        - link "GymBrat — strona główna" [ref=e19] [cursor=pointer]:
          - /url: /login
          - generic [ref=e20]: GymBrat
      - heading "Witaj z powrotem" [level=1] [ref=e21]
      - paragraph [ref=e22]: Zaloguj się i wróć do treningu.
    - generic [ref=e25]:
      - generic [ref=e26]:
        - heading "Zaloguj się" [level=2] [ref=e27]
        - paragraph [ref=e28]: Wróć do swoich planów i historii treningów.
      - alert [ref=e30]: Zbyt wiele prób logowania. Odczekaj kilka minut i spróbuj ponownie.
      - generic [ref=e31]:
        - generic [ref=e32]: E-mail
        - textbox "E-mail" [ref=e33]:
          - /placeholder: twoj@email.pl
          - text: mock.friend@gymbrat.test
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]: Hasło
          - link "Nie pamiętasz hasła?" [ref=e37] [cursor=pointer]:
            - /url: /forgot-password
        - generic [ref=e38]:
          - textbox "Hasło" [ref=e39]: Mock-Local-1234
          - button "Pokaż hasło" [ref=e40]:
            - img [ref=e41]
      - button "Zaloguj się" [ref=e44]
      - generic [ref=e45]:
        - paragraph [ref=e46]: Pierwszy raz w GymBrat?
        - link "Utwórz konto" [ref=e47] [cursor=pointer]:
          - /url: /register?role=zawodnik
      - paragraph [ref=e48]:
        - link "Regulamin" [ref=e49] [cursor=pointer]:
          - /url: /regulamin
        - text: ·
        - link "Polityka prywatności" [ref=e50] [cursor=pointer]:
          - /url: /polityka-prywatnosci
  - button "Open Next.js Dev Tools" [ref=e56] [cursor=pointer]:
    - img [ref=e57]
  - alert [ref=e60]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Zadanie 004 — ekran aktywnego treningu (US-1..US-14).
  5   |  * Wymaga konta testowego (E2E_EMAIL / E2E_PASSWORD) na lokalnej, jednorazowej bazie.
  6   |  * Stan sesji jest wstrzykiwany do localStorage (`active-workout`), więc test nie zależy
  7   |  * od planów w bazie ani od prawdziwych danych. Opcjonalnie E2E_BROWSER_CHANNEL (np. msedge).
  8   |  */
  9   | const email = process.env.E2E_EMAIL?.trim();
  10  | const password = process.env.E2E_PASSWORD?.trim();
  11  | const channel = process.env.E2E_BROWSER_CHANNEL?.trim() || undefined;
  12  | 
  13  | test.use({ viewport: { width: 390, height: 780 }, ...(channel ? { channel } : {}) });
  14  | test.skip(!email || !password, "Ustaw E2E_EMAIL i E2E_PASSWORD.");
  15  | 
  16  | const set = (extra: Record<string, unknown> = {}) => ({
  17  |   reps: 8,
  18  |   weight: 0,
  19  |   done: false,
  20  |   skipped: false,
  21  |   rpe: null,
  22  |   rir: 1,
  23  |   ...extra,
  24  | });
  25  | const last = (weight: number, reps: number, rir: number) => ({
  26  |   reps,
  27  |   weight,
  28  |   done: true,
  29  |   skipped: false,
  30  |   rpe: null,
  31  |   rir,
  32  | });
  33  | 
  34  | function persistedSession() {
  35  |   return {
  36  |     state: {
  37  |       startedAt: Date.now() - 125_000,
  38  |       pausedElapsedSeconds: 0,
  39  |       workoutStartedAtMs: Date.now() - 125_000,
  40  |       title: "Push E2E",
  41  |       workoutPlanId: "e2e-plan",
  42  |       cardioMinutes: 0,
  43  |       cardioExtras: {},
  44  |       selectedExerciseId: "ex-bench",
  45  |       exercises: [
  46  |         {
  47  |           id: "ex-bench",
  48  |           name: "Wyciskanie sztangi leżąc",
  49  |           sets: [set(), set(), set()],
  50  |           targetSets: 3,
  51  |           targetReps: 8,
  52  |           targetRir: 1,
  53  |           // Łatwa historia na górze zakresu: seria 1 = 67,5 kg (↑), reszta = 65 kg (=).
  54  |           lastSessionSets: [last(65, 8, 3), last(65, 8, 3), last(65, 8, 3)],
  55  |           coachContext: { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 },
  56  |         },
  57  |         {
  58  |           id: "ex-incline",
  59  |           name: "Wyciskanie sztangi na ławce skośnej",
  60  |           sets: [set(), set()],
  61  |           targetSets: 2,
  62  |           targetReps: 8,
  63  |           targetRir: 1,
  64  |           // Bardzo ciężka historia: sugestia 62,5 kg (↓) względem 65 kg.
  65  |           lastSessionSets: [last(65, 5, 0), last(65, 4, 0)],
  66  |           coachContext: { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 },
  67  |         },
  68  |         {
  69  |           id: "ex-squat",
  70  |           name: "Przysiad ze sztangą",
  71  |           sets: [set(), set()],
  72  |           targetSets: 2,
  73  |           targetReps: 8,
  74  |           targetRir: 1,
  75  |         },
  76  |       ],
  77  |     },
  78  |     version: 2,
  79  |   };
  80  | }
  81  | 
  82  | async function loginAndClearSession(page: Page) {
  83  |   // Zgody: tylko niezbędne (baner cookies zasłania dolny pasek akcji).
  84  |   await page.addInitScript(() => {
  85  |     window.localStorage.setItem(
  86  |       "gymbrat_consent_v1",
  87  |       JSON.stringify({
  88  |         version: 1,
  89  |         decidedAt: new Date().toISOString(),
  90  |         analytics: false,
  91  |         marketing: false,
  92  |       }),
  93  |     );
  94  |   });
  95  |   await page.goto("/login");
  96  |   await page.getByLabel("E-mail").fill(email!);
  97  |   await page.getByLabel("Hasło", { exact: true }).fill(password!);
  98  |   await page.getByRole("button", { name: /^zaloguj się$/i }).click();
> 99  |   await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
  100 |   // Czysty start: sesja w chmurze z poprzedniego testu wygrałaby z wstrzykniętym stanem lokalnym.
  101 |   // Poza aplikacją (about:blank), żeby globalny sync nie odtworzył jej po usunięciu.
  102 |   await page.goto("about:blank");
  103 |   await page.request.get("/api/csrf");
  104 |   const xsrf = (await page.context().cookies()).find((c) => c.name === "gymbrat_xsrf")?.value ?? "";
  105 |   const current = await page.request.get("/api/active-workout-session");
  106 |   const currentJson = (await current.json().catch(() => null)) as { session?: { revision?: number } | null } | null;
  107 |   const del = await page.request.delete("/api/active-workout-session", {
  108 |     headers: { "x-xsrf-token": decodeURIComponent(xsrf) },
  109 |     data: { revision: currentJson?.session?.revision ?? 0 },
  110 |   });
  111 |   expect(del.ok(), `DELETE /api/active-workout-session -> ${del.status()} ${(await del.text()).slice(0, 160)}`).toBeTruthy();
  112 | }
  113 | 
  114 | /** Wstrzykuje stan sesji do localStorage i otwiera `/active-workout` (po `loginAndClearSession`). */
  115 | async function injectSessionAndOpen(
  116 |   page: Page,
  117 |   session: ReturnType<typeof persistedSession>,
  118 |   readyButtonName = "Zapisz serię 1",
  119 | ) {
  120 |   // Init script (jednorazowo na kartę): inaczej globalny sync nadpisałby stan przy opuszczeniu „/”.
  121 |   await page.addInitScript((s) => {
  122 |     if (window.sessionStorage.getItem("e2e-seeded")) return;
  123 |     window.sessionStorage.setItem("e2e-seeded", "1");
  124 |     window.localStorage.setItem("active-workout", JSON.stringify(s));
  125 |   }, session);
  126 |   await page.goto("/active-workout");
  127 |   // Wznowienie niedokończonej sesji (istniejący dialog) — zatwierdzamy, jak użytkownik.
  128 |   const resume = page.getByRole("button", { name: "Kontynuuj" });
  129 |   await resume.click({ timeout: 15_000 }).catch(() => undefined);
  130 |   await expect(page.getByRole("button", { name: readyButtonName })).toBeVisible({
  131 |     timeout: 30_000,
  132 |   });
  133 | }
  134 | 
  135 | async function openSession(page: Page) {
  136 |   await loginAndClearSession(page);
  137 |   await injectSessionAndOpen(page, persistedSession());
  138 | }
  139 | 
  140 | /**
  141 |  * Sesja z jednym ćwiczeniem o `setsCount` seriach (pomiar geometrii: O-2/defekt 2 `ux`,
  142 |  * schemat + pigułki na wąskim ekranie). Bez historii/sugestii — nieistotne dla geometrii.
  143 |  */
  144 | /** `doneSetsCount` zapisanych serii na początku -> auto-wybrana (bieżąca) jest pierwsza otwarta. */
  145 | function sessionWithSets(setsCount: number, doneSetsCount = 0) {
  146 |   return {
  147 |     state: {
  148 |       startedAt: Date.now() - 60_000,
  149 |       pausedElapsedSeconds: 0,
  150 |       workoutStartedAtMs: Date.now() - 60_000,
  151 |       title: "Geometria E2E",
  152 |       workoutPlanId: "e2e-geometry",
  153 |       cardioMinutes: 0,
  154 |       cardioExtras: {},
  155 |       selectedExerciseId: "ex-geometry",
  156 |       exercises: [
  157 |         {
  158 |           id: "ex-geometry",
  159 |           name: "Wyciskanie hantli skos",
  160 |           sets: Array.from({ length: setsCount }, (_, i) =>
  161 |             i < doneSetsCount ? last(40, 8, 1) : set(),
  162 |           ),
  163 |           targetSets: setsCount,
  164 |           targetReps: 8,
  165 |           targetRir: 1,
  166 |         },
  167 |       ],
  168 |     },
  169 |     version: 2,
  170 |   };
  171 | }
  172 | 
  173 | async function openSessionWithSets(page: Page, setsCount: number, doneSetsCount = 0) {
  174 |   await loginAndClearSession(page);
  175 |   await injectSessionAndOpen(
  176 |     page,
  177 |     sessionWithSets(setsCount, doneSetsCount),
  178 |     `Zapisz serię ${doneSetsCount + 1}`,
  179 |   );
  180 | }
  181 | 
  182 | const progressbar = (page: Page) => page.getByRole("progressbar", { name: "Postęp treningu" });
  183 | const weightInput = (page: Page) => page.locator("#set-weight");
  184 | const repsInput = (page: Page) => page.locator("#set-reps");
  185 | 
  186 | /** Kolor tokenu CSS w postaci rozwiązanej przez przeglądarkę (porównywalnej z computed style). */
  187 | async function resolveToken(page: Page, token: string) {
  188 |   return page.evaluate((t) => {
  189 |     const probe = document.createElement("span");
  190 |     probe.style.color = `var(${t})`;
  191 |     document.body.appendChild(probe);
  192 |     const c = getComputedStyle(probe).color;
  193 |     probe.remove();
  194 |     return c;
  195 |   }, token);
  196 | }
  197 | 
  198 | test.describe("Aktywny trening (004)", () => {
  199 |   test.beforeEach(async ({ page }) => {
```