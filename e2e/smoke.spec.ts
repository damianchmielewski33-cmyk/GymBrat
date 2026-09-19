import { test, expect } from "@playwright/test";

test("strona logowania wyświetla markę GymBrat", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /gym.?brat/i }).first()).toBeVisible();
});

test("changelog jest dostępny bez logowania", async ({ page }) => {
  await page.goto("/changelog");
  await expect(page.getByRole("heading", { name: /nowości i plan/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /źródło tej wersji: repozytorium gymbrat/i }),
  ).toBeVisible();
  await expect(page.getByText("damianchmielewski33-cmyk/GymBrat").first()).toBeVisible();
});

test("endpoint wersji Androida jest publiczny i zwraca JSON", async ({ request }) => {
  const res = await request.get("/api/android/version");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/i);
  const json = (await res.json()) as {
    versionCode?: number;
    versionName?: string;
    apkUrl?: string;
  };
  expect(json.versionCode).toBeGreaterThan(0);
  expect(json.versionName).toBeTruthy();
  expect(json.apkUrl).toMatch(/^https?:\/\//);
});

test("publiczny JSON wersji pochodzi z repozytorium GymBrat", async ({ request }) => {
  const res = await request.get("/api/version");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.app).toBe("gymbrat");
  expect(body.slug).toBe("damianchmielewski33-cmyk/GymBrat");
  expect(Array.isArray(body.changelog)).toBeTruthy();
  expect(body.changelog.length).toBeGreaterThan(0);
  expect(body.changelog[0].sourceRepo).toBe("damianchmielewski33-cmyk/GymBrat");
});

test("chroniona strona przekierowuje na logowanie", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login/);
});

test("strona logowania pokazuje wspólne konto z Akademią (imię / PIN)", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel("Imię")).toBeVisible();
  await expect(page.getByLabel("Nazwisko")).toBeVisible();
  await expect(page.getByLabel("PIN")).toBeVisible();
  await expect(
    page.getByText(/te same dane co w akademii/i).first(),
  ).toBeVisible();
});

test("opcja: smoke po zalogowaniu (E2E_EMAIL / E2E_PASSWORD)", async ({ page }) => {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  test.skip(!email || !password, "Ustaw E2E_EMAIL i E2E_PASSWORD dla pełnego smoke.");

  await page.goto("/login");
  await page.getByRole("button", { name: /zaloguj e-mailem i hasłem/i }).click();
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Hasło", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /zaloguj się jako zawodnik/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 25_000 });
  await expect(
    page.getByRole("heading", { name: /gotowy na trening/i }),
  ).toBeVisible({ timeout: 15_000 });
});
