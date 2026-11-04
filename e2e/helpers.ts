import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

/** Nagłówek CSRF dla żądań `page.request` (wzorzec z active-workout.spec). */
export async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  await page.request.get("/api/csrf");
  const xsrf =
    (await page.context().cookies()).find((c) => c.name === "gymbrat_xsrf")?.value ?? "";
  return { "x-xsrf-token": decodeURIComponent(xsrf) };
}

/** HASH notyfikacji HotPay — HASLO;KWOTA;ID_PLATNOSCI;ID_ZAMOWIENIA;STATUS;SECURE;SEKRET. */
export function hotpayNotificationHash(args: {
  password: string;
  kwota: string;
  idPlatnosci: string;
  idZamowienia: string;
  status: string;
  secure?: string;
  sekret: string;
}): string {
  return createHash("sha256")
    .update(
      [
        args.password,
        args.kwota,
        args.idPlatnosci,
        args.idZamowienia,
        args.status,
        args.secure ?? "",
        args.sekret,
      ].join(";"),
      "utf8",
    )
    .digest("hex");
}

export const E2E_CONSENT_INIT = () => {
  window.localStorage.setItem(
    "gymbrat_consent_v1",
    JSON.stringify({
      version: 1,
      decidedAt: new Date().toISOString(),
      analytics: false,
      marketing: false,
    }),
  );
};
