// Pomiar batcha przejecia konta (ADR 0001 D4) na bazie file: ze schematem Drizzle, klucze obce wylaczone jak na Turso.
// Uzycie (z korzenia repo):
//   npx vitest run --config docs/wydajnosc/skrypty/001-vitest.config.ts
// Wynik: liczba instrukcji, rozmiar SQL, plany (SCAN = pelny skan tabeli), czasy batcha dla bazy z szumem.
// Zmienne: BENCH_USERS (domyslnie 2000), BENCH_DIR (katalog tymczasowy bazy).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import { buildTakeoverStatements } from "@/lib/account-takeover";
import { buildUserDataPurgeSteps } from "@/lib/account-purge";

const USERS = Number(process.env.BENCH_USERS ?? 2000);
const DIR = process.env.BENCH_DIR ?? process.cwd();
const FILE = path.join(DIR, "bench-001.db");

function pct(a: number[], p: number) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!.toFixed(1);
}

describe("bench takeover", () => {
  it("mierzy", async () => {
    for (const f of [FILE, `${FILE}-wal`, `${FILE}-shm`]) fs.rmSync(f, { force: true });
    const client = createClient({ url: `file:${FILE}` });
    await client.execute("PRAGMA foreign_keys = OFF");
    const empty = await generateSQLiteDrizzleJson({});
    const current = await generateSQLiteDrizzleJson(schema as Record<string, unknown>);
    for (const st of await generateSQLiteMigration(empty, current)) await client.execute(st);
    const db = drizzle(client, { schema }) as unknown as Database;

    // Tabele z user_id i ich liczba wierszy szumu (inni uzytkownicy) - realistyczny profil: 20 wierszy/uzytkownika
    const steps = buildUserDataPurgeSteps("u-target");
    const stmts = buildTakeoverStatements(db, {
      userId: "u-target",
      providerAccountId: "g-1",
      passwordHash: "x",
      now: new Date(),
    });
    // EXPLAIN na osobnym polaczeniu: libsql zostawia otwarta instrukcje po EXPLAIN QUERY PLAN DELETE (SQLITE_BUSY przy commit).
    const dialect = new SQLiteSyncDialect();
    const explainClient = createClient({ url: `file:${FILE}` });
    const scans: string[] = [];
    for (const s of steps) {
      const q = sql`EXPLAIN QUERY PLAN ${
        s.action === "delete" ? sql`DELETE FROM ${sql.identifier(s.table)} WHERE ${s.where}` : sql`SELECT 1 FROM ${sql.identifier(s.table)} WHERE ${s.where}`
      }`;
      const built = dialect.sqlToQuery(q);
      const rs = await explainClient.execute({ sql: built.sql, args: built.params as never[] });
      const detail = rs.rows.map((r) => String(r.detail)).join(" | ");
      if (/SCAN/.test(detail) && !/SCAN .* USING (COVERING )?INDEX/.test(detail)) scans.push(`${s.table}: ${detail}`);
    }
    explainClient.close();
    console.log(`INSTRUKCJE batcha: ${stmts.length} (purge: ${steps.length})`);
    console.log(`TABELE z pelnym skanem w purge (${scans.length}):\n  ${scans.join("\n  ")}`);

    // Szum: USERS uzytkownikow, po 20 wierszy w kazdej tabeli purge z kolumna user_id (tylko tabele bezposrednie)
    const direct = steps.filter((s) => s.path.split(" > ").length === 2 && s.action === "delete");
    const chunked = async (items: { sql: string; args: never[] }[]) => {
      for (let i = 0; i < items.length; i += 500) await client.batch(items.slice(i, i + 500), "write");
    };
    await chunked(
      Array.from({ length: USERS }, (_, u) => ({
        sql: "INSERT INTO users (id,email,password_hash,created_at,app_role) VALUES (?,?,?,?, 'zawodnik')",
        args: [u === 0 ? "u-target" : `u${u}`, `u${u}@x.pl`, "h", Date.now()] as never[],
      })),
    );
    let seeded = 0;
    for (const s of direct) {
      const cols = (await client.execute(`PRAGMA table_info("${s.table}")`)).rows;
      const userCol = s.columns[0]!;
      const required = cols.filter((c) => c.notnull === 1 && c.dflt_value == null && c.pk === 0 && c.name !== userCol);
      const names = [userCol, ...required.map((c) => String(c.name))];
      const hasId = cols.some((c) => c.name === "id" && c.pk === 1);
      const colsSql = (hasId ? ["id", ...names] : names).map((n) => `"${n}"`).join(",");
      const types = Object.fromEntries(cols.map((c) => [String(c.name), String(c.type)]));
      const items: { sql: string; args: never[] }[] = [];
      for (let u = 0; u < USERS; u++) {
        for (let i = 0; i < 20; i++) {
          const vals = names.map((n) => (n === userCol ? (u === 0 ? "u-target" : `u${u}`) : /INT|REAL/i.test(types[n]!) ? 1 : n === "exercises" ? "x".repeat(3000) : "v"));
          const args = hasId ? [`${s.table}-${u}-${i}`, ...vals] : vals;
          items.push({
            sql: `INSERT OR IGNORE INTO "${s.table}" (${colsSql}) VALUES (${args.map(() => "?").join(",")})`,
            args: args as never[],
          });
        }
      }
      try {
        await chunked(items);
        seeded += 1;
      } catch {
        /* tabela z dodatkowymi ograniczeniami - pomijamy */
      }
    }
    console.log(`Zasiano tabel: ${seeded}/${direct.length}, uzytkownikow: ${USERS}, rozmiar bazy MB: ${(fs.statSync(FILE).size / 1e6).toFixed(0)}`);

    // Czas batcha: uzytkownik docelowy ma 20 wierszy w kazdej tabeli; powtorz na kolejnych uzytkownikach
    const times: number[] = [];
    const guardOnly: number[] = [];
    await client.execute("UPDATE users SET email_verified_at = NULL");
    for (let u = 0; u < 15; u++) {
      const id = u === 0 ? "u-target" : `u${u}`;
      const stm = buildTakeoverStatements(db, { userId: id, providerAccountId: `g-${u}`, passwordHash: "x", now: new Date() });
      const t0 = performance.now();
      await db.batch([...stm] as unknown as Parameters<Database["batch"]>[0]);
      times.push(performance.now() - t0);
    }
    // Drugie wywolanie (token zuzyty): konto zweryfikowane - wszystkie guardy false
    for (let u = 0; u < 15; u++) {
      const id = u === 0 ? "u-target" : `u${u}`;
      const stm = buildTakeoverStatements(db, { userId: id, providerAccountId: `g-${u}`, passwordHash: "x", now: new Date() });
      const t0 = performance.now();
      await db.batch([...stm] as unknown as Parameters<Database["batch"]>[0]);
      guardOnly.push(performance.now() - t0);
    }
    console.log(`BATCH przejecia (15 prob, p50/p95/max ms): ${pct(times, 0.5)} / ${pct(times, 0.95)} / ${Math.max(...times).toFixed(1)}`);
    console.log(`BATCH ponowny (guard=false, p50/p95 ms): ${pct(guardOnly, 0.5)} / ${pct(guardOnly, 0.95)}`);

    const h: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await hash("x".repeat(64), 12);
      h.push(performance.now() - t0);
    }
    console.log(`bcryptjs hash(cost 12) ms p50: ${pct(h, 0.5)}`);
    client.close();
    for (const f of [FILE, `${FILE}-wal`, `${FILE}-shm`]) fs.rmSync(f, { force: true });
  }, 600_000);
});
