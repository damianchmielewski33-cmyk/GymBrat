import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const sendPackageExpiryEmail = vi.fn(async () => true);
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));
vi.mock("@/lib/email", () => ({ sendPackageExpiryEmail }));

const { GET } = await import("@/app/api/cron/package-expiry/route");
const call = (secret = "tajne") =>
  GET(new Request("http://localhost/api/cron/package-expiry", { headers: { authorization: `Bearer ${secret}` } }));

describe("cron package-expiry (Z24)", () => {
  let client: Client;
  beforeAll(async () => {
    process.env.CRON_SECRET = "tajne";
    ({ client, db } = await createMemoryDb());
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const far = new Date(Date.now() + 20 * 86_400_000);
    await db.insert(schema.users).values([
      { id: "ok", email: "ok@example.com", passwordHash: "x", packageEndsAt: soon },
      { id: "noconsent", email: "nc@example.com", passwordHash: "x", packageEndsAt: soon },
      { id: "far", email: "far@example.com", passwordHash: "x", packageEndsAt: far },
    ]);
    for (const id of ["ok", "far"]) {
      await db.insert(schema.userConsents).values({
        userId: id, type: "push", granted: true, source: "reminders", textVersion: "t", decidedAt: new Date(),
      } as never);
    }
  });
  afterAll(() => client.close());

  it("bez tajnego klucza → 401", async () => {
    expect((await call("zly")).status).toBe(401);
  });

  it("wysyła tylko za zgodą i tylko przy ≤ 3 dniach, a drugie uruchomienie nie dubluje", async () => {
    const first = await (await call()).json();
    expect(first.sent).toBe(1);
    expect(sendPackageExpiryEmail).toHaveBeenCalledTimes(1);
    expect(sendPackageExpiryEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ok@example.com" }));
    const second = await (await call()).json();
    expect(second.sent).toBe(0);
    expect(sendPackageExpiryEmail).toHaveBeenCalledTimes(1);
  });
});
