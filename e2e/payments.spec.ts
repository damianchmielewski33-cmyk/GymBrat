import { expect, test } from "@playwright/test";
import { csrfHeaders, hotpayNotificationHash } from "./helpers";

/**
 * Z43: płatność w trybie sandbox — zamówienie, podpisane powiadomienie HotPay, pakiet aktywny.
 * Wymaga: PREMIUM_CHECKOUT_ENABLED=1, HOTPAY_SEKRET, HOTPAY_NOTIFICATION_PASSWORD (te same
 * wartości w procesie testów i serwera) oraz konta z seeda bez aktywnego pakietu.
 */
const sekret = process.env.HOTPAY_SEKRET?.trim();
const password = process.env.HOTPAY_NOTIFICATION_PASSWORD?.trim();
test.skip(!sekret || !password, "Ustaw HOTPAY_SEKRET i HOTPAY_NOTIFICATION_PASSWORD.");

test("zakup pakietu: zamówienie → powiadomienie SUCCESS → pakiet aktywny (i idempotencja)", async ({
  page,
}) => {
  const headers = await csrfHeaders(page);
  const checkout = await page.request.post("/api/package/checkout", {
    headers,
    data: { sku: "d30", termsAccepted: true, immediateServiceConsent: true },
  });
  expect(checkout.status(), await checkout.text()).toBe(200);
  const body = (await checkout.json()) as {
    ok: boolean;
    fields: { KWOTA: string; ID_ZAMOWIENIA: string };
  };
  expect(body.ok).toBe(true);
  const { KWOTA: kwota, ID_ZAMOWIENIA: idZamowienia } = body.fields;

  const notify = async (hash: string, status = "SUCCESS", idPlatnosci = "E2E-PAY-1") =>
    page.request.post("/api/payments/hotpay/notify", {
      form: {
        KWOTA: kwota,
        ID_PLATNOSCI: idPlatnosci,
        ID_ZAMOWIENIA: idZamowienia,
        STATUS: status,
        SEKRET: sekret!,
        HASH: hash,
      },
    });
  const signed = hotpayNotificationHash({
    password: password!,
    kwota,
    idPlatnosci: "E2E-PAY-1",
    idZamowienia,
    status: "SUCCESS",
    sekret: sekret!,
  });

  // Zły podpis jest odrzucany, pakiet się nie aktywuje.
  expect((await notify("0".repeat(64))).status()).toBe(403);
  expect(((await (await page.request.get("/api/package/status")).json()) as { active: boolean }).active).toBe(false);

  // Poprawny podpis aktywuje pakiet; powtórka nie przedłuża go drugi raz.
  expect((await notify(signed)).status()).toBe(200);
  const first = (await (await page.request.get("/api/package/status")).json()) as {
    active: boolean;
    daysLeft: number;
  };
  expect(first.active).toBe(true);
  expect((await notify(signed)).status()).toBe(200);
  const second = (await (await page.request.get("/api/package/status")).json()) as {
    daysLeft: number;
  };
  expect(second.daysLeft).toBe(first.daysLeft);
});
