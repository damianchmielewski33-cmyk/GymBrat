import { createClient } from "@libsql/client";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { getSchemaMode } from "@/db/schema-mode";
import { applyMigrations, pendingMigrations } from "../scripts/db-migrations.mjs";

const dir = path.join(process.cwd(), "db", "migrations");

async function columns(client: ReturnType<typeof createClient>) {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name NOT IN ('schema_migrations') ORDER BY name",
  );
  const out: Record<string, string[]> = {};
  for (const t of tables.rows) {
    const name = String(t.name);
    const info = await client.execute(`PRAGMA table_info("${name}")`);
    out[name] = info.rows.map((r) => String(r.name)).sort();
  }
  return out;
}

describe("Z40: zgodność schema.ts ↔ migracje", () => {
  it("migracje budują te same tabele i kolumny co schema.ts", async () => {
    const fromMigrations = createClient({ url: ":memory:" });
    await applyMigrations(fromMigrations, dir, { tolerateExisting: false });
    const fromSchema = createClient({ url: ":memory:" });
    const empty = await generateSQLiteDrizzleJson({});
    const current = await generateSQLiteDrizzleJson(schema as Record<string, unknown>);
    for (const st of await generateSQLiteMigration(empty, current)) {
      await fromSchema.execute(st);
    }
    const a = await columns(fromMigrations);
    const b = await columns(fromSchema);
    expect(Object.keys(a)).toEqual(Object.keys(b));
    for (const table of Object.keys(b)) {
      expect({ table, cols: a[table] }).toEqual({ table, cols: b[table] });
    }
    fromMigrations.close();
    fromSchema.close();
  });

  it("runner jest idempotentny i zapisuje wersje", async () => {
    const c = createClient({ url: ":memory:" });
    const first = await applyMigrations(c, dir, { tolerateExisting: false });
    expect(first.length).toBeGreaterThan(30);
    expect(await applyMigrations(c, dir)).toEqual([]);
    expect(await pendingMigrations(c, dir)).toEqual([]);
    c.close();
  });

  it("SCHEMA_MODE: domyślnie ensure, migrations tylko jawnie", () => {
    expect(getSchemaMode({} as NodeJS.ProcessEnv)).toBe("ensure");
    expect(getSchemaMode({ SCHEMA_MODE: "Migrations" } as unknown as NodeJS.ProcessEnv)).toBe("migrations");
    expect(getSchemaMode({ SCHEMA_MODE: "x" } as unknown as NodeJS.ProcessEnv)).toBe("ensure");
  });
});
