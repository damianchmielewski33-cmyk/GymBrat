import { test, expect, type Request } from "@playwright/test";

/**
 * Z12: przed zgodą (i po „Tylko niezbędne”) przeglądarka nie wysyła żadnych zdarzeń
 * analityki ani monitoringu — ani do PostHog/Sentry, ani do własnego /api/analytics/page-view.
 * Po „Akceptuj wszystkie” liczenie wejść startuje.
 * Test wymaga uruchomionej aplikacji (PLAYWRIGHT_BASE_URL) i nie potrzebuje konta.
 */
const THIRD_PARTY = /(posthog|sentry\.io|ingest\.)/i;

function collect(page: import("@playwright/test").Page) {
  const seen: string[] = [];
  page.on("request", (req: Request) => {
    const url = req.url();
    if (THIRD_PARTY.test(url) || url.includes("/api/analytics/page-view")) seen.push(url);
  });
  return seen;
}

test("przed zgodą brak zdarzeń analityki i monitoringu", async ({ page }) => {
  const seen = collect(page);
  await page.goto("/login");
  await expect(page.getByRole("dialog", { name: /cookies i prywatność/i })).toBeVisible();
  await page.waitForTimeout(2500);
  expect(seen).toEqual([]);
});

test("„Tylko niezbędne” nie uruchamia analityki, nawet po nawigacji", async ({ page }) => {
  const seen = collect(page);
  await page.goto("/login");
  await page.getByRole("button", { name: /tylko niezbędne/i }).click();
  await page.goto("/register");
  await page.waitForTimeout(2500);
  expect(seen).toEqual([]);
});

test("„Akceptuj wszystkie” włącza liczenie wejść", async ({ page }) => {
  const seen = collect(page);
  await page.goto("/login");
  await page.getByRole("button", { name: /akceptuj wszystkie/i }).click();
  await expect.poll(() => seen.some((u) => u.includes("/api/analytics/page-view")), {
    timeout: 8000,
  }).toBe(true);
});
