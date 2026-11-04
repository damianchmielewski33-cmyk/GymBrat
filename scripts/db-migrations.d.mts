/**
 * Strukturalnie zgodny z `Client` z @libsql/client. Składnia metody (nie właściwości) daje
 * dwuwariantność parametru, a `any[]` w `args` pozwala przekazać `InArgs` bez rzutowania.
 */
export type MigrationClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(q: string | { sql: string; args?: any[] }): Promise<{ rows: any[] }>;
};
export function loadMigrations(dir: string): Array<{ tag: string; statements: string[] }>;
export function ensureVersionTable(client: MigrationClient): Promise<void>;
export function appliedTags(client: MigrationClient): Promise<Set<string>>;
export function applyMigrations(
  client: MigrationClient,
  dir: string,
  opts?: { tolerateExisting?: boolean; dryRun?: boolean },
): Promise<string[]>;
export function pendingMigrations(client: MigrationClient, dir: string): Promise<string[]>;
