import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

/**
 * Loguje konto testowe RAZ i zapisuje `storageState` dla projektu `authed`
 * (US14 / Z46). Bez E2E_EMAIL / E2E_PASSWORD nic nie robi — testy `authed` same się pomijają.
 */
export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) return;

  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";
  const file = path.resolve("e2e/.auth/user.json");
  mkdirSync(path.dirname(file), { recursive: true });

  const browser = await chromium.launch({
    channel: process.env.E2E_BROWSER_CHANNEL?.trim() || undefined,
  });
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
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
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Hasło", { exact: true }).fill(password);
    await page.getByRole("button", { name: /^zaloguj się$/i }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
    await context.storageState({ path: file });
  } finally {
    await browser.close();
  }
}
