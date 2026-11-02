import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
vi.mock("@/db", () => ({ getDb: () => db }));

const { lacksSensitiveConsent, consentRequiredResponse, CONSENT_REQUIRED_CODE } = await import(
  "@/lib/consent-guard"
);
const { isConsentGranted } = await import("@/lib/consents");

describe("zgody na dane wrażliwe (Z11)", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute(`DELETE FROM user_consents`);
  });

  async function decide(type: string, granted: boolean, at: number, userId = "u1") {
    await db.insert(schema.userConsents).values({
      userId,
      type,
      granted,
      textVersion: "t",
      source: "profile",
      decidedAt: new Date(at),
    });
  }

  it("brak decyzji = brak zgody", async () => {
    expect(await lacksSensitiveConsent("u1", "health")).toBe(true);
    expect(await isConsentGranted("u1", "photos")).toBe(false);
  });

  it("ostatnia decyzja wygrywa (zgoda, potem cofnięcie, potem zgoda)", async () => {
    await decide("health", true, 1000);
    expect(await lacksSensitiveConsent("u1", "health")).toBe(false);
    await decide("health", false, 2000);
    expect(await lacksSensitiveConsent("u1", "health")).toBe(true);
    await decide("health", true, 3000);
    expect(await lacksSensitiveConsent("u1", "health")).toBe(false);
  });

  it("zgody są rozdzielne: health nie daje photos i nie przechodzi między użytkownikami", async () => {
    await decide("health", true, 1000);
    expect(await lacksSensitiveConsent("u1", "photos")).toBe(true);
    expect(await lacksSensitiveConsent("u2", "health")).toBe(true);
  });

  it("odpowiedź API: 403 z kodem CONSENT_REQUIRED i typem zgody", async () => {
    const res = consentRequiredResponse("photos");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: CONSENT_REQUIRED_CODE,
      consent: "photos",
    });
  });
});
