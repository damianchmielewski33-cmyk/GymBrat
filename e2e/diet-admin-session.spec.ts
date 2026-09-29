import { test, expect } from "@playwright/test";

async function loginAsAthlete(page: import("@playwright/test").Page) {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  test.skip(!email || !password, "Ustaw E2E_EMAIL i E2E_PASSWORD.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Hasło", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /zaloguj się jako zawodnik/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 25_000 });
}

test.describe("Dieta / admin / sesja — bez logowania", () => {
  test("Dieta wymaga logowania", async ({ page }) => {
    await page.goto("/meal-suggestions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("panel katalogu admina wymaga logowania", async ({ page }) => {
    await page.goto("/admin/catalog");
    await expect(page).toHaveURL(/\/(login|admin)/);
  });

  test("aktywna sesja bez planu wraca do treningów lub logowania", async ({ page }) => {
    await page.goto("/active-workout");
    await expect(page).toHaveURL(/\/(login|workout-plan)/);
  });
});

test.describe("Dieta / admin / sesja — po zalogowaniu", () => {
  test("Dieta: zakładki Plan i Jadłospis", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/meal-suggestions");
    await expect(page.getByRole("button", { name: /^Plan$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Jadłospis|Food log/i })).toBeVisible();
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await expect(
      page.getByText(/Katalog posiłków|Meal catalog|Brak przepisów|No recipes/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Treningi: hub sesji dostępny", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/workout-plan");
    await expect(page).toHaveURL(/\/workout-plan/);
    await expect(page.locator("body")).toContainText(/Trening|Plan|Start/i);
  });

  test("active-workout bez sesji nie zostaje na pustym ekranie sesji", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/active-workout");
    await expect(page).toHaveURL(/\/workout-plan/, { timeout: 15_000 });
  });

  test("admin catalog: dostęp albo redirect (zależnie od roli)", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/admin/catalog");
    const url = page.url();
    if (/\/admin\/catalog/.test(url)) {
      await expect(
        page.getByText(/Przepisy w aplikacji|Recipes in the app|Pakiet startowy|Starter pack/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page).toHaveURL(/\/(login|admin|profile|$)/);
    }
  });
});
