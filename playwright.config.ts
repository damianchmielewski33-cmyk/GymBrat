import { defineConfig } from "@playwright/test";

/** Własny port E2E: 3000 bywa zajęty przez inny projekt, a `reuseExistingServer` testował wtedy cudzą aplikację. */
const E2E_PORT = process.env.E2E_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`;
export const AUTH_FILE = "e2e/.auth/user.json";

/**
 * E2E (US14 / Z46, Z43).
 * - `public`: bez logowania (smoke, zgody, rejestracja, usunięcie konta zakłada własne konto).
 * - `authed`: konto z seeda; logowanie RAZ w `global-setup.ts` → `storageState`
 *   (logowanie per test wpadało w limity prób).
 * Lokalnie: `TURSO_DATABASE_URL=file:./e2e.db`, `node scripts/seed-local-mock.cjs`,
 * `E2E_EMAIL=mock.user@gymbrat.test`, `E2E_PASSWORD=<MOCK_PASSWORD>`, potem `npm run test:e2e`.
 * Serwer: bez `PLAYWRIGHT_BASE_URL` Playwright sam startuje `next dev` (tryb testowy kodu rejestracji).
 */
export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "public",
      testMatch: /(smoke|consent-no-tracking|diet-admin-session|registration)\.spec\.ts/,
    },
    {
      name: "authed",
      testMatch: /(active-workout|payments)\.spec\.ts/,
      use: { storageState: AUTH_FILE },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${E2E_PORT}`,
        url: baseURL,
        env: { NEXTAUTH_URL: baseURL, AUTH_URL: baseURL },
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
