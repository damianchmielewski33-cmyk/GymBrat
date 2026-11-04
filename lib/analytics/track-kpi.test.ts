import { beforeEach, describe, expect, it, vi } from "vitest";

const isConsentGranted = vi.fn(async (_u: string, _t: string) => false);
const posthogCapture = vi.fn(async (_i: unknown) => undefined);

vi.mock("@/lib/consents", () => ({ isConsentGranted }));
vi.mock("@/lib/analytics/posthog", () => ({ posthogCapture }));

const { trackKpi, KpiEvents } = await import("@/lib/analytics/track-kpi");
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Z53: zdarzenia KPI tylko po zgodzie", () => {
  beforeEach(() => {
    isConsentGranted.mockReset().mockResolvedValue(false);
    posthogCapture.mockClear();
  });

  it("bez zgody nic nie wychodzi", async () => {
    trackKpi(KpiEvents.packageViewed, "u1", {});
    await flush();
    expect(isConsentGranted).toHaveBeenCalledWith("u1", "analytics");
    expect(posthogCapture).not.toHaveBeenCalled();
  });

  it("ze zgodą wysyła zdarzenie z surface=kpi i bez danych osobowych", async () => {
    isConsentGranted.mockResolvedValue(true);
    trackKpi(KpiEvents.checkoutStarted, "u1", { plan_sku: "m1", amount_grosze: 1999 });
    await flush();
    expect(posthogCapture).toHaveBeenCalledWith({
      event: "kpi_checkout_started",
      distinctId: "u1",
      properties: { analytics_schema: 1, surface: "kpi", plan_sku: "m1", amount_grosze: 1999 },
    });
  });

  it("konta systemowe i anonimowe są pomijane; błąd bazy nie rzuca", async () => {
    trackKpi(KpiEvents.packageViewed, "anonymous", {});
    trackKpi(KpiEvents.packageViewed, "system:cron", {});
    expect(isConsentGranted).not.toHaveBeenCalled();
    isConsentGranted.mockRejectedValue(new Error("db"));
    trackKpi(KpiEvents.packageViewed, "u1", {});
    await flush();
    expect(posthogCapture).not.toHaveBeenCalled();
  });
});
