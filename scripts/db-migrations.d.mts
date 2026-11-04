export type MigrationClient = {
  execute: (q: string | { sql: string; args?: unknown[] }) => Promise<{ rows: Array<Record<string, unknown>> }>;
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
