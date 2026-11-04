/**
 * Z40: tryb zarządzania schematem.
 * - `ensure` (domyślny): `ensureCriticalSchema()` dopełnia schemat w runtime (zachowanie dotychczasowe).
 * - `migrations`: schemat tylko z migracji (`npm run db:migrate:run`); runtime nie wykonuje DDL.
 */
export type SchemaMode = "ensure" | "migrations";

export function getSchemaMode(env: NodeJS.ProcessEnv = process.env): SchemaMode {
  return env.SCHEMA_MODE?.trim().toLowerCase() === "migrations"
    ? "migrations"
    : "ensure";
}
