import { test, expect } from "@playwright/test";

test("strona logowania wyświetla markę GymBrat", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /gym.?brat/i }).first()).toBeVisible();
});
