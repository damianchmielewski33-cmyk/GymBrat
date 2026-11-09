import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

/**
 * Loguje konto testowe RAZ i zapisuje `storageState` dla projektu `authed`
 * (US14 / Z46). Bez E2E_EMAIL / E2E_PASSWORD nic nie robi — testy `authed` same się pomijają.
 */
/** Trasy kompilowane na żądanie w `next dev` — rozgrzewamy je, żeby testy nie łapały timeoutu `goto`. */
const WARMUP_PATHS = ["/login", "/register", "/", "/api/csrf"];

async function warmUp(baseURL: string) {
  for (const p of WARMUP_PATHS) {
    try {
      await fetch(new URL(p, baseURL), { redirect: "manual", signal: AbortSignal.timeout(120_000) });
    } catch {
      /* rozgrzewka best-effort; test sam zgłosi realny problem */
    }
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.E2E_PORT ?? "3100"}`;
  await warmUp(baseURL);

  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) return;
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
    // Dev: klik przed hydracją wysyła natywny GET formularza (/login?email=…), więc czekamy
    // na idle sieci i ponawiamy, jeśli strona wróciła na /login.
    let loggedIn = false;
    for (let attempt = 0; attempt < 3 && !loggedIn; attempt++) {
      await page.goto("/login", { waitUntil: "networkidle", timeout: 120_000 });
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Hasło", { exact: true }).fill(password);
      await page.getByRole("button", { name: /^zaloguj się$/i }).click();
      loggedIn = await page
        .waitForURL((url) => url.pathname === "/", { timeout: 45_000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!loggedIn) throw new Error("global-setup: logowanie konta E2E nie powiodło się po 3 próbach.");
    await context.storageState({ path: file });
  } finally {
    await browser.close();
  }
}
