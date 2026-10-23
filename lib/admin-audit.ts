import "server-only";

import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { AdminAuditEntry } from "@/lib/admin-audit-types";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";

export type AdminAuditInput = {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Wiersz `admin_audit_log` — wspólny dla zapisu pojedynczego i instrukcji w `db.batch`. */
export function adminAuditValues(input: AdminAuditInput): typeof adminAuditLog.$inferInsert {
  return {
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    metaJson: input.meta && Object.keys(input.meta).length ? JSON.stringify(input.meta) : null,
    deploymentEnv: getAnalyticsDeployment(),
  };
}

export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  await getDb().insert(adminAuditLog).values(adminAuditValues(input));
}

export async function listAdminAuditLogs(limit = 200): Promise<AdminAuditEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(Math.min(500, Math.max(1, limit)));

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    action: r.action,
    targetUserId: r.targetUserId,
    meta: r.metaJson
      ? (() => {
          try {
            return JSON.parse(r.metaJson) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : null,
    createdAt: r.createdAt,
  }));
}
