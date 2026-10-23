import "server-only";

import { is, sql, type SQL } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "@/db";
import * as schema from "@/db/schema";

/**
 * Usuwanie danych użytkownika bez polegania na `ON DELETE CASCADE` (ADR 0001 D4, wariant C).
 * SQLite/Turso nie wymuszają kluczy obcych bez `PRAGMA foreign_keys = ON`, więc instrukcje
 * są wyprowadzane z metadanych schematu Drizzle i wykonywane jawnie, od liści do korzenia.
 * Nowa tabela z `user_id ... references(() => users.id, { onDelete: "cascade" })` jest objęta automatycznie.
 */

/**
 * Tabele z kaskadą do `users`, których NIE usuwamy razem z danymi konta.
 * - `subscription_orders`: dokumenty rozliczeniowe, obowiązek przechowywania 5 lat
 *   (`docs/prawo/01-podstawy-prawne-i-retencja.md`, wiersz 11). Nie są widoczne w UI ani eksporcie użytkownika.
 */
export const PURGE_EXCLUDED_TABLES: ReadonlySet<string> = new Set(["subscription_orders"]);

type FkEdge = {
  child: SQLiteTable;
  childName: string;
  childColumns: string[];
  childColumnsNotNull: boolean;
  parentName: string;
  parentColumns: string[];
  onDelete: string | undefined;
};

export type PurgeStep = {
  table: string;
  action: "delete" | "set_null";
  /** Ścieżka kluczy obcych od `users` (np. `users > body_reports > body_report_photos`). */
  path: string;
  where: SQL;
  columns: string[];
};

let edgesCache: FkEdge[] | null = null;

function schemaTables(): SQLiteTable[] {
  return (Object.values(schema) as unknown[]).filter((v): v is SQLiteTable => is(v, SQLiteTable));
}

function foreignKeyEdges(): FkEdge[] {
  if (edgesCache) return edgesCache;
  const edges: FkEdge[] = [];
  for (const table of schemaTables()) {
    const config = getTableConfig(table);
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      edges.push({
        child: table,
        childName: config.name,
        childColumns: ref.columns.map((c) => c.name),
        childColumnsNotNull: ref.columns.some((c) => c.notNull),
        parentName: getTableConfig(ref.foreignTable).name,
        parentColumns: ref.foreignColumns.map((c) => c.name),
        onDelete: fk.onDelete,
      });
    }
  }
  edgesCache = edges;
  return edges;
}

type TableRef = ReturnType<typeof sql.identifier>;
type RowCondition = (ref: TableRef) => SQL;

/**
 * Kroki purge w kolejności wykonania. Ścieżka może zawierać tę samą tabelę najwyżej dwa razy
 * (jeden poziom odwołania do samej siebie, np. odpowiedzi na komentarz) — ochrona przed cyklami.
 */
export function buildUserDataPurgeSteps(userId: string): PurgeStep[] {
  const edges = foreignKeyEdges();
  const steps: PurgeStep[] = [];
  let aliasSeq = 0;

  const visit = (tableName: string, cond: RowCondition, path: string[]) => {
    for (const edge of edges) {
      if (edge.parentName !== tableName) continue;
      if (PURGE_EXCLUDED_TABLES.has(edge.childName)) continue;
      const cascade = edge.onDelete === "cascade";
      const setNull = edge.onDelete === "set null";
      if (!cascade && !setNull) continue;
      // Klucze `set null` bezpośrednio do `users` zostają: dowody zdarzeń (LR-27), konto nie znika.
      if (setNull && tableName === "users") continue;
      if (setNull && edge.childColumnsNotNull) continue;
      if (path.filter((p) => p === edge.childName).length >= 2) continue;
      if (path.includes(edge.childName) && edge.childName !== tableName) continue;

      const childCond = edgeCondition(edge, tableName, cond, () => `gb_p${++aliasSeq}`, userId);
      const childPath = [...path, edge.childName];
      if (cascade) {
        visit(edge.childName, childCond, childPath);
        steps.push({
          table: edge.childName,
          action: "delete",
          path: childPath.join(" > "),
          where: childCond(sql.identifier(edge.childName)),
          columns: edge.childColumns,
        });
      } else {
        steps.push({
          table: edge.childName,
          action: "set_null",
          path: childPath.join(" > "),
          where: childCond(sql.identifier(edge.childName)),
          columns: edge.childColumns,
        });
      }
    }
  };

  visit("users", (ref) => sql`${ref}.${sql.identifier("id")} = ${userId}`, ["users"]);
  return steps;
}

function edgeCondition(
  edge: FkEdge,
  parentName: string,
  parentCond: RowCondition,
  nextAlias: () => string,
  userId: string,
): RowCondition {
  if (parentName === "users" && edge.parentColumns.length === 1 && edge.parentColumns[0] === "id") {
    return (ref) => sql`${ref}.${sql.identifier(edge.childColumns[0]!)} = ${userId}`;
  }
  const alias = sql.identifier(nextAlias());
  return (ref) => {
    const joins = sql.join(
      edge.childColumns.map(
        (col, i) =>
          sql`${alias}.${sql.identifier(edge.parentColumns[i]!)} = ${ref}.${sql.identifier(col)}`,
      ),
      sql` AND `,
    );
    return sql`EXISTS (SELECT 1 FROM ${sql.identifier(parentName)} AS ${alias} WHERE ${joins} AND ${parentCond(alias)})`;
  };
}

/**
 * Instrukcje usuwające wszystkie dane zależne od `users.id` (bez wiersza `users`).
 * Do wykonania w jednym `db.batch` (libSQL: jedna transakcja). `guard` to dodatkowy warunek
 * dopisywany do każdej instrukcji (np. przejęcie: tylko gdy konto zostało przejęte w tym batchu).
 */
export function buildUserDataPurgeStatements(
  db: Database,
  userId: string,
  opts: { guard?: SQL } = {},
) {
  return buildUserDataPurgeSteps(userId).map((step) => {
    const where = opts.guard ? sql`(${step.where}) AND ${opts.guard}` : step.where;
    const table = sql.identifier(step.table);
    if (step.action === "delete") {
      return db.run(sql`DELETE FROM ${table} WHERE ${where}`);
    }
    const sets = sql.join(
      step.columns.map((c) => sql`${sql.identifier(c)} = NULL`),
      sql`, `,
    );
    return db.run(sql`UPDATE ${table} SET ${sets} WHERE ${where}`);
  });
}
