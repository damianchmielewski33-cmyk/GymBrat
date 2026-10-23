import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import type { Database } from "@/db";
import * as schema from "@/db/schema";

/**
 * Baza `:memory:` z pełnym schematem Drizzle do testów integracyjnych (Vitest).
 * Klucze obce są wyłączone jak domyślnie na Turso — kod nie może polegać na kaskadzie.
 */
export async function createMemoryDb(): Promise<{ client: Client; db: Database }> {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = OFF");
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema as Record<string, unknown>);
  for (const statement of await generateSQLiteMigration(empty, current)) {
    await client.execute(statement);
  }
  return { client, db: drizzle(client, { schema }) as unknown as Database };
}

export async function countRows(client: Client, table: string, where = "1 = 1"): Promise<number> {
  const rs = await client.execute(`SELECT COUNT(*) AS c FROM "${table}" WHERE ${where}`);
  return Number(rs.rows[0]?.c ?? 0);
}
