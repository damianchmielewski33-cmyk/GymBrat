import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
let userId: string | null = "free";
const getProgressHubData = vi.fn();
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/auth", () => ({ auth: async () => (userId ? { user: { id: userId } } : null) }));
vi.mock("@/lib/progress-hub", () => ({ getProgressHubData }));

const { GET } = await import("@/app/api/premium/report/route");

describe("GET /api/premium/report", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    await db.insert(schema.users).values([
      { id: "free", email: "f@example.com", passwordHash: "x" },
      { id: "pro", email: "p@example.com", passwordHash: "x", packageEndsAt: new Date(Date.now() + 86_400_000), packagePlanSku: "m1" },
    ]);
    getProgressHubData.mockResolvedValue({
      strength: { workoutCount: 1, sinceDate: null, volumeCounts: { up: 0, flat: 0, down: 0 }, maxes: [] },
      body: { tempo: {}, measures: [] },
      week: { summary: { streakWeeks: 0 }, last8: [] },
    });
  });
  afterAll(() => client.close());

  it("konto bez pakietu dostaje 402 i nie ładuje danych", async () => {
    const res = await GET(new Request("http://localhost/api/premium/report"));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("PREMIUM_REQUIRED");
    expect(getProgressHubData).not.toHaveBeenCalled();
  });

  it("konto z pakietem dostaje raport, bez zgody health bez sekcji ciała", async () => {
    userId = "pro";
    const res = await GET(new Request("http://localhost/api/premium/report"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.report.body).toBeNull();
  });

  it("brak sesji → 401", async () => {
    userId = null;
    expect((await GET(new Request("http://localhost/api/premium/report"))).status).toBe(401);
  });
});
