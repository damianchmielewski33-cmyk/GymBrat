import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => undefined }));

const { requirePremium, isPremiumActive } = await import("@/lib/user-package");
const { AppError } = await import("@/lib/errors/app-error");

describe("requirePremium (Z10)", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    const now = Date.now();
    await db.insert(schema.users).values([
      { id: "free", email: "f@example.com", passwordHash: "x" },
      { id: "active", email: "a@example.com", passwordHash: "x", packageEndsAt: new Date(now + 86_400_000), packagePlanSku: "m1" },
      { id: "expired", email: "e@example.com", passwordHash: "x", packageEndsAt: new Date(now - 1000), packagePlanSku: "m1" },
    ]);
  });
  afterAll(() => client.close());

  it("aktywny pakiet przechodzi", async () => {
    await expect(requirePremium("active")).resolves.toMatchObject({ active: true });
    expect(await isPremiumActive("active")).toBe(true);
  });

  it("brak pakietu i pakiet wygasły (bez karencji) → PREMIUM_REQUIRED / 402", async () => {
    for (const id of ["free", "expired", "nieistnieje"]) {
      const err = await requirePremium(id).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("PREMIUM_REQUIRED");
      expect(err.status).toBe(402);
    }
  });
});
