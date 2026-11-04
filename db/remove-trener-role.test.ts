import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { users } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

describe("Z77: migracja roli trener → zawodnik", () => {
  let client: Client;
  beforeAll(async () => {
    const mem = await createMemoryDb();
    client = mem.client;
    await mem.db.insert(users).values([
      { id: "t", email: "t@x.pl", passwordHash: "x", appRole: "trener" },
      { id: "a", email: "a@x.pl", passwordHash: "x", appRole: "admin" },
      { id: "z", email: "z@x.pl", passwordHash: "x", appRole: "zawodnik" },
    ]);
  });
  afterAll(() => client.close());

  it("zmienia tylko trenerów, nie rusza adminów i zawodników; jest idempotentna", async () => {
    const sql = readFileSync(
      path.join(process.cwd(), "db", "migrations", "0043_remove_trener_role.sql"),
      "utf8",
    );
    await client.execute(sql);
    await client.execute(sql);
    const rs = await client.execute("SELECT id, app_role FROM users ORDER BY id");
    expect(rs.rows.map((r) => [r.id, r.app_role])).toEqual([
      ["a", "admin"],
      ["t", "zawodnik"],
      ["z", "zawodnik"],
    ]);
  });
});
