import { expect, test } from "@playwright/test";
import { E2E_CONSENT_INIT, csrfHeaders } from "./helpers";

/**
 * Z43: rejestracja e-mailem (tryb testowy kodu: 123456, wymaga `next dev` bez SMTP) →
 * usunięcie konta → ponowne logowanie jest odrzucone.
 * Selektory wynikają z `components/auth/register-form.tsx`; po pierwszym uruchomieniu
 * sprawdź je i ewentualnie popraw (spec pisany bez dostępu do przeglądarki).
 */
const TEST_CODE = "123456";
const PASSWORD = "E2e-Pass-1234!";

test("rejestracja → usunięcie konta (RODO) → logowanie niemożliwe", async ({ page }) => {
  const email = `e2e.${Date.now()}@gymbrat.test`;
  await page.addInitScript(E2E_CONSENT_INIT);

  await page.goto("/register");
  await page.getByRole("button", { name: /zarejestruj się przez e-mail/i }).click();

  await page.getByLabel("Imię").fill("Ewa");
  await page.getByLabel("Nazwisko").fill("Testowa");
  await page.getByRole("button", { name: "Dalej" }).click();

  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Wyślij kod" }).click();
  await page.getByLabel("Kod z e-maila").fill(TEST_CODE);
  await page.getByRole("button", { name: "Dalej" }).click();

  await page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Dalej" }).click();

  await page.getByLabel("Waga (kg)").fill("80");
  await page.getByLabel("Wzrost (cm)").fill("180");
  await page.getByLabel("Wiek").fill("30");
  await page.getByRole("button", { name: "Dalej" }).click();

  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Dalej" }).click();

  await page.getByRole("button", { name: "Utwórz konto" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), { timeout: 60_000 });

  // Usunięcie konta (potwierdzenie frazą + hasło) — jak w Profilu → Konto.
  const headers = await csrfHeaders(page);
  const del = await page.request.delete("/api/user/account", {
    headers,
    data: { confirm: "USUŃ", password: PASSWORD },
  });
  expect(del.status(), await del.text()).toBe(200);

  // Po usunięciu te same dane nie logują.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /^zaloguj się$/i }).click();
  await expect(page).toHaveURL(/\/login/);
});
