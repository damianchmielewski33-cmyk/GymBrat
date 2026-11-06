import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { createMemoryDb, countRows } from "@/db/test-memory-db";

let db: Database;
let rateOk = true;
const sendWaitlistConfirmEmail = vi.fn(async (_p: { to: string; confirmUrl: string; unsubscribeUrl: string }) => true);
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => {} }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => (rateOk ? { ok: true } : { ok: false, retryAfterSec: 60 }),
  clientIpFromHeaders: () => "1.2.3.4",
}));
vi.mock("@/lib/email", () => ({ sendWaitlistConfirmEmail }));

const LANDING = "https://gymbrat.example";
const { POST, OPTIONS } = await import("@/app/api/waitlist/route");
const confirm = await import("@/app/api/waitlist/confirm/route");
const unsub = await import("@/app/api/waitlist/unsubscribe/route");

const post = (body: unknown, origin: string | null = LANDING) =>
  POST(
    new Request("https://app.example/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    }),
  );

const valid = { email: "Jan@Example.com", consent: true };

describe("POST /api/waitlist", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", LANDING);
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
  });
  afterAll(() => {
    client.close();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await client.execute("DELETE FROM waitlist_signups");
    sendWaitlistConfirmEmail.mockClear();
    rateOk = true;
  });

  it("503 bez NEXT_PUBLIC_LANDING_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", "");
    expect((await post(valid)).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_LANDING_URL", LANDING);
  });

  it("403 z obcego originu i bez originu, bez nagłówków CORS", async () => {
    const foreign = await post(valid, "https://evil.example");
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    expect((await post(valid, null)).status).toBe(403);
    expect(await countRows(client, "waitlist_signups")).toBe(0);
  });

  it("400 bez zgody lub z błędnym e-mailem", async () => {
    expect((await post({ email: "a@b.pl", consent: false })).status).toBe(400);
    expect((await post({ email: "nie-email", consent: true })).status).toBe(400);
    expect(sendWaitlistConfirmEmail).not.toHaveBeenCalled();
  });

  it("zapisuje wpis pending i wysyła link potwierdzający; CORS tylko dla landingu", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(LANDING);
    expect(await countRows(client, "waitlist_signups", "status = 'pending' AND email = 'jan@example.com'")).toBe(1);
    const mail = sendWaitlistConfirmEmail.mock.calls[0][0];
    expect(mail.to).toBe("jan@example.com");
    expect(mail.confirmUrl).toMatch(/^https:\/\/app\.example\/api\/waitlist\/confirm\?token=/);
    expect(mail.unsubscribeUrl).toContain("/api/waitlist/unsubscribe?email=");
  });

  it("honeypot: sukces bez zapisu i bez maila", async () => {
    const res = await post({ ...valid, website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await countRows(client, "waitlist_signups")).toBe(0);
    expect(sendWaitlistConfirmEmail).not.toHaveBeenCalled();
  });

  it("429 po przekroczeniu limitu IP", async () => {
    rateOk = false;
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("OPTIONS: 204 dla landingu, 403 dla obcych", async () => {
    const ok = await OPTIONS(new Request("https://app.example/api/waitlist", { method: "OPTIONS", headers: { origin: LANDING } }));
    expect(ok.status).toBe(204);
    const bad = await OPTIONS(new Request("https://app.example/api/waitlist", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(bad.status).toBe(403);
  });

  it("double opt-in: link potwierdza zapis, drugi raz już nie; wypis wymaga poprawnego tokenu", async () => {
    await post(valid);
    const { confirmUrl, unsubscribeUrl } = sendWaitlistConfirmEmail.mock.calls[0][0];

    const ok = await confirm.GET(new Request(confirmUrl));
    expect(ok.headers.get("location")).toBe(`${LANDING}/?waitlist=ok`);
    expect(await countRows(client, "waitlist_signups", "status = 'confirmed'")).toBe(1);
    const again = await confirm.GET(new Request(confirmUrl));
    expect(again.headers.get("location")).toBe(`${LANDING}/?waitlist=expired`);

    const forged = await unsub.GET(new Request(unsubscribeUrl.replace(/token=[^&]+/, "token=zly")));
    expect(forged.headers.get("location")).toBe(`${LANDING}/?waitlist=expired`);
    expect(await countRows(client, "waitlist_signups", "status = 'confirmed'")).toBe(1);

    const done = await unsub.GET(new Request(unsubscribeUrl));
    expect(done.headers.get("location")).toBe(`${LANDING}/?waitlist=unsub`);
    expect(await countRows(client, "waitlist_signups", "status = 'unsubscribed'")).toBe(1);
  });

  it("przeterminowany token nie potwierdza", async () => {
    await post(valid);
    await client.execute("UPDATE waitlist_signups SET confirm_expires_at = 1");
    const { confirmUrl } = sendWaitlistConfirmEmail.mock.calls[0][0];
    const res = await confirm.GET(new Request(confirmUrl));
    expect(res.headers.get("location")).toBe(`${LANDING}/?waitlist=expired`);
  });
});

describe("retencja listy powiadomień", () => {
  it("usuwa niepotwierdzone po 7 dniach, zostawia świeże", async () => {
    const { client: c, db: d } = await createMemoryDb();
    const { runWaitlistRetention, registerWaitlistSignup } = await import("@/lib/waitlist");
    const old = new Date(Date.now() - 10 * 86_400_000);
    await registerWaitlistSignup(d, "stary@example.com", old);
    await registerWaitlistSignup(d, "nowy@example.com");
    const res = await runWaitlistRetention(d, Date.now());
    expect(res.deleted).toBe(1);
    expect(await countRows(c, "waitlist_signups")).toBe(1);
    c.close();
  });
});
