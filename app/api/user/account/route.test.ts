import type { Client } from "@libsql/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const auth = vi.fn();
const sendAccountDeletedEmail = vi.fn(async () => true);
vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: (): NextResponse | null => null }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: async () => ({ ok: true, retryAfterSec: 0 }),
  RATE: { accountDelete: { limit: 5, windowMs: 1000 } },
}));
vi.mock("@/lib/email", () => ({ sendAccountDeletedEmail }));

const { DELETE } = await import("@/app/api/user/account/route");

const del = (body: unknown) =>
  DELETE(
    new Request("http://localhost/api/user/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("DELETE /api/user/account (Z14)", () => {
  let client: Client;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    await client.execute(`DELETE FROM users`);
    await db.insert(schema.users).values({
      id: "u1",
      email: "u1@example.com",
      passwordHash: await hash("tajne-haslo", 4),
    });
    sendAccountDeletedEmail.mockClear();
  });
  const exists = async () => Number((await client.execute(`SELECT count(*) AS n FROM users WHERE id='u1'`)).rows[0]!.n);

  it("sama sesja + fraza (stare logowanie) nie wystarcza → 403 REAUTH_REQUIRED", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, authAt: Date.now() - 3_600_000 });
    const res = await del({ confirm: "USUŃ" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("REAUTH_REQUIRED");
    expect(await exists()).toBe(1);
  });

  it("błędne hasło → 403, konto zostaje", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, authAt: Date.now() });
    const res = await del({ confirm: "USUŃ", password: "zle" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PASSWORD_INVALID");
    expect(await exists()).toBe(1);
  });

  it("bez frazy → 400", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, authAt: Date.now() });
    expect((await del({ confirm: "nie" })).status).toBe(400);
    expect(await exists()).toBe(1);
  });

  it("poprawne hasło usuwa konto i wysyła e-mail potwierdzający", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, authAt: Date.now() - 3_600_000 });
    const res = await del({ confirm: "usuń", password: "tajne-haslo" });
    expect(res.status).toBe(200);
    expect(await exists()).toBe(0);
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith({ to: "u1@example.com" });
  });

  it("świeże logowanie OAuth (bez hasła) wystarcza", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, authAt: Date.now() - 1000 });
    expect((await del({ confirm: "USUŃ" })).status).toBe(200);
    expect(await exists()).toBe(0);
  });
});
