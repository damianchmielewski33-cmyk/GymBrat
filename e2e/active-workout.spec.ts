import { test, expect, type Page } from "@playwright/test";

/**
 * Zadanie 004 — ekran aktywnego treningu (US-1..US-14).
 * Wymaga konta testowego (E2E_EMAIL / E2E_PASSWORD) na lokalnej, jednorazowej bazie.
 * Stan sesji jest wstrzykiwany do localStorage (`active-workout`), więc test nie zależy
 * od planów w bazie ani od prawdziwych danych. Opcjonalnie E2E_BROWSER_CHANNEL (np. msedge).
 */
const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD?.trim();
const channel = process.env.E2E_BROWSER_CHANNEL?.trim() || undefined;

test.use({ viewport: { width: 390, height: 780 }, ...(channel ? { channel } : {}) });
test.skip(!email || !password, "Ustaw E2E_EMAIL i E2E_PASSWORD.");

const set = (extra: Record<string, unknown> = {}) => ({
  reps: 8,
  weight: 0,
  done: false,
  skipped: false,
  rpe: null,
  rir: 1,
  ...extra,
});
const last = (weight: number, reps: number, rir: number) => ({
  reps,
  weight,
  done: true,
  skipped: false,
  rpe: null,
  rir,
});

function persistedSession() {
  return {
    state: {
      startedAt: Date.now() - 125_000,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: Date.now() - 125_000,
      title: "Push E2E",
      workoutPlanId: "e2e-plan",
      cardioMinutes: 0,
      cardioExtras: {},
      selectedExerciseId: "ex-bench",
      exercises: [
        {
          id: "ex-bench",
          name: "Wyciskanie sztangi leżąc",
          sets: [set(), set(), set()],
          targetSets: 3,
          targetReps: 8,
          targetRir: 1,
          // Łatwa historia na górze zakresu: seria 1 = 67,5 kg (↑), reszta = 65 kg (=).
          lastSessionSets: [last(65, 8, 3), last(65, 8, 3), last(65, 8, 3)],
          coachContext: { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 },
        },
        {
          id: "ex-incline",
          name: "Wyciskanie sztangi na ławce skośnej",
          sets: [set(), set()],
          targetSets: 2,
          targetReps: 8,
          targetRir: 1,
          // Bardzo ciężka historia: sugestia 62,5 kg (↓) względem 65 kg.
          lastSessionSets: [last(65, 5, 0), last(65, 4, 0)],
          coachContext: { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 },
        },
        {
          id: "ex-squat",
          name: "Przysiad ze sztangą",
          sets: [set(), set()],
          targetSets: 2,
          targetReps: 8,
          targetRir: 1,
        },
      ],
    },
    version: 2,
  };
}

async function loginAndClearSession(page: Page) {
  // Zgody: tylko niezbędne (baner cookies zasłania dolny pasek akcji).
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "gymbrat_consent_v1",
      JSON.stringify({
        version: 1,
        decidedAt: new Date().toISOString(),
        analytics: false,
        marketing: false,
      }),
    );
  });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Hasło", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /^zaloguj się$/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  // Czysty start: sesja w chmurze z poprzedniego testu wygrałaby z wstrzykniętym stanem lokalnym.
  // Poza aplikacją (about:blank), żeby globalny sync nie odtworzył jej po usunięciu.
  await page.goto("about:blank");
  await page.request.get("/api/csrf");
  const xsrf = (await page.context().cookies()).find((c) => c.name === "gymbrat_xsrf")?.value ?? "";
  const current = await page.request.get("/api/active-workout-session");
  const currentJson = (await current.json().catch(() => null)) as { session?: { revision?: number } | null } | null;
  const del = await page.request.delete("/api/active-workout-session", {
    headers: { "x-xsrf-token": decodeURIComponent(xsrf) },
    data: { revision: currentJson?.session?.revision ?? 0 },
  });
  expect(del.ok(), `DELETE /api/active-workout-session -> ${del.status()} ${(await del.text()).slice(0, 160)}`).toBeTruthy();
}

/** Wstrzykuje stan sesji do localStorage i otwiera `/active-workout` (po `loginAndClearSession`). */
async function injectSessionAndOpen(
  page: Page,
  session: ReturnType<typeof persistedSession>,
  readyButtonName = "Zapisz serię 1",
) {
  // Init script (jednorazowo na kartę): inaczej globalny sync nadpisałby stan przy opuszczeniu „/”.
  await page.addInitScript((s) => {
    if (window.sessionStorage.getItem("e2e-seeded")) return;
    window.sessionStorage.setItem("e2e-seeded", "1");
    window.localStorage.setItem("active-workout", JSON.stringify(s));
  }, session);
  await page.goto("/active-workout");
  // Wznowienie niedokończonej sesji (istniejący dialog) — zatwierdzamy, jak użytkownik.
  const resume = page.getByRole("button", { name: "Kontynuuj" });
  await resume.click({ timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: readyButtonName })).toBeVisible({
    timeout: 30_000,
  });
}

async function openSession(page: Page) {
  await loginAndClearSession(page);
  await injectSessionAndOpen(page, persistedSession());
}

/**
 * Sesja z jednym ćwiczeniem o `setsCount` seriach (pomiar geometrii: O-2/defekt 2 `ux`,
 * schemat + pigułki na wąskim ekranie). Bez historii/sugestii — nieistotne dla geometrii.
 */
/** `doneSetsCount` zapisanych serii na początku -> auto-wybrana (bieżąca) jest pierwsza otwarta. */
function sessionWithSets(setsCount: number, doneSetsCount = 0) {
  return {
    state: {
      startedAt: Date.now() - 60_000,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: Date.now() - 60_000,
      title: "Geometria E2E",
      workoutPlanId: "e2e-geometry",
      cardioMinutes: 0,
      cardioExtras: {},
      selectedExerciseId: "ex-geometry",
      exercises: [
        {
          id: "ex-geometry",
          name: "Wyciskanie hantli skos",
          sets: Array.from({ length: setsCount }, (_, i) =>
            i < doneSetsCount ? last(40, 8, 1) : set(),
          ),
          targetSets: setsCount,
          targetReps: 8,
          targetRir: 1,
        },
      ],
    },
    version: 2,
  };
}

async function openSessionWithSets(page: Page, setsCount: number, doneSetsCount = 0) {
  await loginAndClearSession(page);
  await injectSessionAndOpen(
    page,
    sessionWithSets(setsCount, doneSetsCount),
    `Zapisz serię ${doneSetsCount + 1}`,
  );
}

const progressbar = (page: Page) => page.getByRole("progressbar", { name: "Postęp treningu" });
const weightInput = (page: Page) => page.locator("#set-weight");
const repsInput = (page: Page) => page.locator("#set-reps");

/** Kolor tokenu CSS w postaci rozwiązanej przez przeglądarkę (porównywalnej z computed style). */
async function resolveToken(page: Page, token: string) {
  return page.evaluate((t) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${t})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);
}

test.describe("Aktywny trening (004)", () => {
  test.beforeEach(async ({ page }) => {
    await openSession(page);
  });

  test("US-1/US-5: nagłówek z serią X/Y, pole ciężaru wypełnione sugestią, brak „Pomiń serię” jako przycisku głównego", async ({
    page,
  }) => {
    await expect(page.getByText(/seria\s*1\/7/)).toBeVisible();
    await expect(progressbar(page)).toHaveAttribute("aria-valuetext", "Zapisano 0 z 7 serii");
    await expect(weightInput(page)).toHaveValue("67.5");
    await expect(repsInput(page)).toHaveValue("8");
    // Sugestia ↑ (67,5 > 65 z poprzedniego treningu) — kierunek także w opisie dla czytnika.
    await expect(
      page.getByRole("button", { name: /^Sugestia: więcej, 67,5 kg/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Zapisz serię 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pomiń serię 1$/ })).toHaveCount(1); // tylko link „Pomiń”
    await expect(page.getByRole("button", { name: "Zapisz serię 1" })).not.toHaveText(/Pomiń/);
  });

  test("US-8: „Zapisz serię” jednym dotknięciem -> przerwa z kartą Zapisano i zielonym postępem", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    const card = page.getByRole("status").filter({ hasText: "Zapisano" });
    await expect(card).toContainText("67,5 kg × 8");
    await expect(card).toContainText("RIR 1");
    await expect(progressbar(page).last()).toHaveAttribute("aria-valuetext", "Zapisano 1 z 7 serii");
  });

  test("US-11/US-12: przerwa -15 s / +30 s, „Następnie” z kierunkiem sugestii, „Zacznij serię 2”", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    const timer = page.getByRole("timer");
    const secs = async () => {
      const label = (await timer.getAttribute("aria-label")) ?? "";
      const m = label.match(/(\d+)\s*min/);
      const s = label.match(/(\d+)\s*s/);
      return (m ? Number(m[1]) * 60 : 0) + (s ? Number(s[1]) : 0);
    };
    const before = await secs();
    await page.getByRole("button", { name: "Wydłuż przerwę o 30 sekund" }).click();
    expect(await secs()).toBeGreaterThanOrEqual(before + 28);
    const afterPlus = await secs();
    await page.getByRole("button", { name: "Skróć przerwę o 15 sekund" }).click();
    const afterMinus = await secs();
    expect(afterMinus).toBeLessThanOrEqual(afterPlus - 14);
    // Seria 2 tego samego ćwiczenia: Live Coach po łatwej serii podtrzymuje podwyżkę (↑, 67,5 > 65).
    await expect(page.getByText("Seria 2 z 3 · Wyciskanie sztangi leżąc")).toBeVisible();
    await expect(page.getByText(/Sugestia: więcej, 67,5 kg/)).toBeAttached();
    await page.getByRole("button", { name: "Zacznij serię 2" }).click();
    await expect(page.getByRole("button", { name: "Zapisz serię 2" })).toBeVisible();
    await expect(weightInput(page)).toHaveValue("67.5");

    // Ostatnia seria ćwiczenia: „ćwiczenie ✓” i „Następnie” z sugestią ↓ (62,5 < 65).
    // Ochrona przed podwójnym dotknięciem (700 ms po zapisie) świadomie ignoruje szybsze kliknięcie.
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Zapisz serię 2" }).click();
    await page.getByRole("button", { name: "Zacznij serię 3" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Zapisz serię 3" }).click();
    await expect(page.getByText("ćwiczenie ✓")).toBeVisible();
    await expect(page.getByText(/Następnie · ćwiczenie 2 z 3/)).toBeVisible();
    await expect(page.getByText(/Sugestia: lżej, 62,5 kg/)).toBeAttached();
    await page.getByRole("button", { name: "Zacznij ćwiczenie 2" }).click();
    await expect(page.getByRole("heading", { name: /skośnej/ })).toBeVisible();
    await expect(weightInput(page)).toHaveValue("62.5");
  });

  test("US-8/L-2: podwójne dotknięcie zapisuje jedną serię", async ({ page }) => {
    await page.getByRole("button", { name: "Zapisz serię 1" }).evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(progressbar(page).last()).toHaveAttribute("aria-valuetext", "Zapisano 1 z 7 serii");
  });

  test("005 p.7/US-14: brak ciężaru nie blokuje zaliczenia (masa ciała, 0 kg)", async ({
    page,
  }) => {
    const later = page.getByRole("button", { name: "Później, odłóż ćwiczenie na później" });
    await later.click();
    await later.click();
    await expect(page.getByRole("heading", { name: "Przysiad ze sztangą" })).toBeVisible();
    await expect(weightInput(page)).toHaveValue("");
    // Pusty ciężar + powtórzenia zapisuje serię jako masę ciała (0 kg) — zaliczoną,
    // bez komunikatu „Podaj ciężar” (usunięty, 005 sekcja 4; decyzja właściciela p.7).
    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Podaj ciężar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Seria 1, zapisana: 0 kg/ })).toBeVisible();
    await expect(progressbar(page).last()).toHaveAttribute("aria-valuetext", "Zapisano 1 z 7 serii");
  });

  test("US-6: brak powtórzeń -> „Podaj liczbę powtórzeń”", async ({ page }) => {
    await repsInput(page).fill("");
    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Podaj liczbę powtórzeń" })).toBeVisible();
    await expect(repsInput(page)).toBeFocused();
    await expect(progressbar(page)).toHaveAttribute("aria-valuetext", "Zapisano 0 z 7 serii");
  });

  test("M-1: edycja zapisanej serii (wyczyść ciężar -> wpisz ciężar) przywraca stan „zapisana”", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    await page.getByRole("button", { name: "Zacznij serię 2" }).click();
    await page.getByRole("button", { name: /^Seria 1, zapisana/ }).click();
    await expect(page.getByRole("button", { name: "Popraw serię 1" })).toBeVisible();
    await weightInput(page).fill("");
    await expect(page.getByRole("button", { name: /^Seria 1, pominięta/ })).toBeVisible();
    await expect(progressbar(page)).toHaveAttribute(
      "aria-valuetext",
      "Zapisano 0 z 7 serii, pominięto 1",
    );
    await weightInput(page).fill("72");
    await expect(page.getByRole("button", { name: /^Seria 1, zapisana: 72 kg/ })).toBeVisible();
    await expect(progressbar(page)).toHaveAttribute("aria-valuetext", "Zapisano 1 z 7 serii");
  });

  test("US-2/BR-2: zapisana seria jest zielona, pominięta pomarańczowa z „–”, bez przerwy po pominięciu", async ({
    page,
  }) => {
    const success = await resolveToken(page, "--gym-success");
    const skipped = await resolveToken(page, "--gym-skipped");
    expect(success).not.toBe(skipped);

    await page.getByRole("button", { name: "Zapisz serię 1" }).click();
    await page.getByRole("button", { name: "Zacznij serię 2" }).click();
    await page.getByRole("button", { name: "Pomiń serię 2" }).click();
    await expect(page.getByRole("timer")).toHaveCount(0);

    const saved = page.getByRole("button", { name: /^Seria 1, zapisana/ });
    const skip = page.getByRole("button", { name: /^Seria 2, pominięta/ });
    await expect(saved).toBeVisible();
    await expect(skip).toBeVisible();
    // Pigułki animują kolor (transition 200 ms) — czekamy na stan końcowy.
    const colorOf = (loc: typeof saved) =>
      loc.locator("span").first().evaluate((e) => getComputedStyle(e).color);
    await expect.poll(() => colorOf(saved)).toBe(success);
    await expect.poll(() => colorOf(skip)).toBe(skipped);
    await expect(progressbar(page)).toHaveAttribute(
      "aria-valuetext",
      "Zapisano 1 z 7 serii, pominięto 1",
    );
    await expect(page.getByText(/seria\s*3\/7/)).toBeVisible();
  });

  test("US-9: „Zakończ” tylko w menu ☰ (nie w dolnym rzędzie), z ekranem potwierdzenia", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: /^Zakończ/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wstecz, wróć do poprzedniej serii" })).toBeDisabled();
    await page.getByRole("button", { name: "Menu treningu" }).click();
    await page.getByRole("button", { name: "Zakończ trening" }).click();
    // Menu -> dialog potwierdzenia „Zakończyć trening?” (005 sekcja 7) -> zapis.
    await page.getByRole("button", { name: "Zakończ i zapisz" }).click();
    await expect(page.getByRole("heading", { name: "Zapisuję trening…" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trening zakończony" })).toBeVisible();
  });

  test("US-13: plakietka Ghost bez „bez zapisu”", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Ghost/ }).first()).toBeVisible();
    await expect(page.getByText(/bez zapisu/i)).toHaveCount(0);
  });

  test("US-7: RIR w jednym rzędzie, podświetlony cel (1), nie 0", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^RIR 1,/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^RIR 0,/ })).toHaveAttribute("aria-pressed", "false");
    const ys = await Promise.all(
      ["RIR 0,", "RIR 1,", "RIR 2,", "RIR 3 lub"].map(async (n) =>
        (await page.getByRole("button", { name: new RegExp(`^${n}`) }).boundingBox())!.y,
      ),
    );
    expect(new Set(ys.map(Math.round)).size).toBe(1);
  });

  test("US-7/BR-10: ekran 360x640 mieści przycisk główny i RIR bez przewijania strony", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const save = page.getByRole("button", { name: "Zapisz serię 1" });
    const rir0 = page.getByRole("button", { name: /^RIR 0,/ });
    const vh = 640;
    const sb = (await save.boundingBox())!;
    const rb = (await rir0.boundingBox())!;
    expect(sb.y + sb.height).toBeLessThanOrEqual(vh);
    expect(rb.y + rb.height).toBeLessThanOrEqual(sb.y);
    expect(rb.height).toBeGreaterThanOrEqual(43.9);
  });

  /** Seria z zapisu store (`localStorage["active-workout"]`, persist) — bez zależności od UI. */
  async function storedSet(page: Page, exerciseIndex: number, setIndex: number) {
    return page.evaluate(
      ([e, s]) => {
        const raw = window.localStorage.getItem("active-workout");
        const parsed = raw ? (JSON.parse(raw) as { state?: { exercises?: unknown[] } }) : null;
        const ex = parsed?.state?.exercises?.[e] as { sets?: unknown[] } | undefined;
        return ex?.sets?.[s] ?? null;
      },
      [exerciseIndex, setIndex] as const,
    );
  }

  test("F2/LR-3: podpowiedź w polu bez dotknięcia nie trafia do store przy przejściu na inną serię", async ({
    page,
  }) => {
    await expect(weightInput(page)).toHaveValue("67.5");
    await page.getByRole("button", { name: "Seria 2, do zrobienia" }).click();
    await expect(page.getByRole("button", { name: "Zapisz serię 2" })).toBeVisible();
    expect(await storedSet(page, 0, 0)).toMatchObject({ weight: 0, done: false });
    // Powrót: pole nadal pokazuje tylko podpowiedź, seria nadal niezapisana.
    await page.getByRole("button", { name: "Seria 1, do zrobienia" }).click();
    await expect(weightInput(page)).toHaveValue("67.5");
    await expect(page.getByRole("button", { name: "Zapisz serię 1" })).toBeVisible();
    expect(await storedSet(page, 0, 0)).toMatchObject({ weight: 0, done: false });
  });

  test("F2/kontrast: zmiana ciężaru steperem przed przejściem zapisuje się do store", async ({
    page,
  }) => {
    await expect(weightInput(page)).toHaveValue("67.5");
    await page.getByRole("button", { name: /^Zwiększ ciężar o [\d.,]+ kg$/ }).first().click();
    const changed = Number(await weightInput(page).inputValue());
    expect(changed).toBeGreaterThan(67.5);
    await page.getByRole("button", { name: "Seria 2, do zrobienia" }).click();
    await expect(page.getByRole("button", { name: "Zapisz serię 2" })).toBeVisible();
    expect(await storedSet(page, 0, 0)).toMatchObject({ weight: changed, done: false });
  });
});

/**
 * Defekt 2 (`ux`, przegląd wizualny etap 8) / O-2 (`tester`): przy 4-5 seriach na 360×640
 * schemat + pigułki nie mieściły się w jednej linii, wiersz zawijał się i zabierał budżet
 * kompaktu. Mierzone bezpośrednio w przeglądarce (bounding box), nie liczone z klas.
 */
test.describe("Aktywny trening (004) — geometria ekranu A przy wielu seriach", () => {
  for (const viewport of [
    { width: 360, height: 640, label: "360x640" },
    { width: 390, height: 844, label: "390x844" },
  ] as const) {
    for (const setsCount of [2, 4, 6, 8]) {
      test(`${viewport.label}, ${setsCount} serii: RIR, CTA i pigułki bez przewijania kolumny`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openSessionWithSets(page, setsCount);

        const save = page.getByRole("button", { name: `Zapisz serię 1` });
        const rir0 = page.getByRole("button", { name: /^RIR 0,/ });
        const centerScroll = page.locator("[data-active-workout-scroll]");
        const pills = page.getByRole("group", { name: "Serie ćwiczenia" });

        const saveBox = (await save.boundingBox())!;
        const rirBox = (await rir0.boundingBox())!;
        const scrollHeight = await centerScroll.evaluate((el) => el.scrollHeight);
        const clientHeight = await centerScroll.evaluate((el) => el.clientHeight);
        // Defekt 2 (ux, przegląd wizualny): pigułki rozpychały kolumnę w poziomie,
        // bo `.chip-scroll` w CSS nie był `@utility`, więc `compact:chip-scroll` nie
        // generował żadnych reguł — pole pigułek było `overflow: visible`.
        const centerScrollWidth = await centerScroll.evaluate((el) => el.scrollWidth);
        const centerClientWidth = await centerScroll.evaluate((el) => el.clientWidth);

        expect(
          saveBox.y + saveBox.height,
          `CTA poza widokiem przy ${setsCount} seriach (${viewport.label})`,
        ).toBeLessThanOrEqual(viewport.height);
        expect(
          rirBox.y + rirBox.height,
          `RIR poza widokiem przy ${setsCount} seriach (${viewport.label})`,
        ).toBeLessThanOrEqual(saveBox.y);
        expect(
          scrollHeight,
          `środek ekranu przewija się w pionie przy ${setsCount} seriach (${viewport.label}): scrollHeight ${scrollHeight} > clientHeight ${clientHeight}`,
        ).toBeLessThanOrEqual(clientHeight + 1);
        expect(
          centerScrollWidth,
          `kolumna treści przewija się w poziomie przy ${setsCount} seriach (${viewport.label}): scrollWidth ${centerScrollWidth} > clientWidth ${centerClientWidth}`,
        ).toBeLessThanOrEqual(centerClientWidth + 1);

        if (setsCount >= 6) {
          const scrollLeftBefore = await centerScroll.evaluate((el) => el.scrollLeft);
          await page.getByRole("button", { name: "Seria 6, do zrobienia" }).click();
          await expect(page.getByRole("button", { name: "Zapisz serię 6" })).toBeVisible();
          const scrollLeftAfter = await centerScroll.evaluate((el) => el.scrollLeft);
          expect(
            scrollLeftAfter,
            `wybór pigułki 6 przewinął kolumnę treści (${viewport.label})`,
          ).toBe(scrollLeftBefore);
          // Pigułka 6 jest przewinięta do widoku wewnątrz własnego pola, nie kolumny.
          const pillsScrollWidth = await pills.evaluate((el) => el.scrollWidth);
          const pillsClientWidth = await pills.evaluate((el) => el.clientWidth);
          if (pillsScrollWidth > pillsClientWidth + 1) {
            await expect(
              page.getByRole("button", { name: "Seria 6, bieżąca" }),
            ).toBeInViewport();
          }
        }
      });
    }
  }
});

/**
 * Runda 2 przeglądu wizualnego `ux`: pozycja pigułki liczona z `offsetLeft`/`offsetWidth`
 * (względem `offsetParent`, nie względem pola pigułek) chowała bieżącą/wybraną/fokusowaną
 * pigułkę częściowo lub całkowicie. Asercja na geometrię pigułki względem pola (`group`),
 * nie tylko na `scrollWidth`/`scrollLeft` kolumny — to nie wykrywałoby tego defektu.
 */
test.describe("Aktywny trening (004) — pigułka w całości widoczna w polu przewijania (360x640)", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  // `scrollTo({ behavior: "smooth" })` animuje dojście do pozycji — `toPass` czeka,
  // aż przewijanie się ustali (do 2 s), zamiast łapać geometrię w połowie animacji.
  async function expectPillFullyInGroup(page: Page, pillName: string) {
    await expect(async () => {
      const group = page.getByRole("group", { name: "Serie ćwiczenia" });
      const pill = page.getByRole("button", { name: pillName });
      const groupBox = (await group.boundingBox())!;
      const pillBox = (await pill.boundingBox())!;
      expect(
        pillBox.x,
        `„${pillName}”: lewa krawędź poza polem pigułek (pillBox.x=${pillBox.x}, groupBox.x=${groupBox.x})`,
      ).toBeGreaterThanOrEqual(groupBox.x - 0.5);
      expect(
        pillBox.x + pillBox.width,
        `„${pillName}”: prawa krawędź poza polem pigułek (right=${pillBox.x + pillBox.width}, groupBox right=${groupBox.x + groupBox.width})`,
      ).toBeLessThanOrEqual(groupBox.x + groupBox.width + 0.5);
    }).toPass({ timeout: 2000 });
  }

  for (const setsCount of [2, 3, 4, 6, 8]) {
    test(`${setsCount} serii: bieżąca pigułka widoczna od razu, po każdym kliku i po fokusie`, async ({
      page,
    }) => {
      await openSessionWithSets(page, setsCount);

      // Od razu po otwarciu ćwiczenia (seria 1 bieżąca).
      await expectPillFullyInGroup(page, "Seria 1, bieżąca");

      // Klik każdej pigułki po kolei — wybrana ma być w całości widoczna.
      for (let i = 1; i <= setsCount; i++) {
        const before = i === 1 ? "Seria 1, bieżąca" : `Seria ${i}, do zrobienia`;
        await page.getByRole("button", { name: before }).click();
        await expect(page.getByRole("button", { name: `Zapisz serię ${i}` })).toBeVisible();
        await expectPillFullyInGroup(page, `Seria ${i}, bieżąca`);
      }

      // Fokus klawiaturą (np. Tab) na każdej pigułce — niezależnie od wyboru.
      for (let i = 1; i <= setsCount; i++) {
        const name =
          i === setsCount ? `Seria ${i}, bieżąca` : `Seria ${i}, do zrobienia`;
        const pill = page.getByRole("button", { name });
        await pill.focus();
        await expect(pill).toBeFocused();
        await expectPillFullyInGroup(page, name);
      }
    });
  }

  test("6 serii, bieżąca od razu seria 6 (5 zapisanych): widoczna od razu po otwarciu", async ({
    page,
  }) => {
    await openSessionWithSets(page, 6, 5);
    await expectPillFullyInGroup(page, "Seria 6, bieżąca");
  });
});




