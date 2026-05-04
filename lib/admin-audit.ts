import "server-only";

import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { AdminAuditEntry } from "@/lib/admin-audit-types";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";

export async function logAdminAction(input: {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const db = getDb();
  const env = getAnalyticsDeployment();
  await db.insert(adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    metaJson: input.meta && Object.keys(input.meta).length ? JSON.stringify(input.meta) : null,
    deploymentEnv: env,
  });
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
