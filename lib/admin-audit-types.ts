export type AdminAuditEntry = {
  id: string;
  actorUserId: string;
  action: string;
  targetUserId: string | null;
  meta: Record<string, unknown> | null;
  /** Po `JSON.parse` z API bywa stringiem ISO. */
  createdAt: Date | string;
};
