import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const createBodyReport = vi.fn(async () => "r1");
const lacksSensitiveConsent = vi.fn(async (_u: string, _t: string) => false);

vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: () => null }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({ ok: true, retryAfterSec: 0 }),
  RATE: { bodyReportCreate: { limit: 10, windowMs: 1000 } },
}));
vi.mock("@/lib/body-reports", () => ({ createBodyReport, getBodyReports: vi.fn() }));
vi.mock("@/lib/consent-guard", async (orig) => ({
  ...(await orig<typeof import("@/lib/consent-guard")>()),
  lacksSensitiveConsent,
}));
vi.mock("@/lib/consents", () => ({ isConsentGranted: vi.fn(async () => true) }));

const { POST } = await import("@/app/api/body-reports/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/body-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const report = {
  weightKg: 80,
  trainingEnergy: 3,
  sleepQuality: 3,
  dayEnergy: 3,
  digestionScore: 3,
};

describe("POST /api/body-reports: zgody (Z11)", () => {
  beforeEach(() => {
    auth.mockReset().mockResolvedValue({ user: { id: "u1" } });
    createBodyReport.mockClear();
    lacksSensitiveConsent.mockReset().mockResolvedValue(false);
  });

  it("bez zgody health: 403 CONSENT_REQUIRED i nic nie zapisano", async () => {
    lacksSensitiveConsent.mockImplementation(async (_u, t) => t === "health");
    const res = await post(report);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "CONSENT_REQUIRED", consent: "health" });
    expect(createBodyReport).not.toHaveBeenCalled();
  });

  it("ze zgodą health, ale ze zdjęciami bez zgody photos: 403 photos", async () => {
    lacksSensitiveConsent.mockImplementation(async (_u, t) => t === "photos");
    const res = await post({ ...report, photoDataUrls: ["data:image/jpeg;base64,AAAA"] });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "CONSENT_REQUIRED", consent: "photos" });
    expect(createBodyReport).not.toHaveBeenCalled();
  });

  it("raport bez zdjęć nie wymaga zgody photos", async () => {
    lacksSensitiveConsent.mockImplementation(async (_u, t) => t === "photos");
    const res = await post(report);
    expect(res.status).toBe(200);
    expect(createBodyReport).toHaveBeenCalledTimes(1);
  });

  it("ze zgodami: zapis", async () => {
    const res = await post({ ...report, photoDataUrls: ["data:image/jpeg;base64,AAAA"] });
    expect(res.status).toBe(200);
    expect(createBodyReport).toHaveBeenCalledTimes(1);
  });
});
