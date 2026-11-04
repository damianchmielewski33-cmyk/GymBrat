import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptionOrders, supportRequests } from "@/db/schema";
import { supportDueAt, type SupportRequestInput } from "@/lib/support";

export type CreatedSupportRequest = { id: string; dueAt: Date };

/**
 * Zapisuje zgłoszenie. `orderId` jest honorowane tylko dla zamówienia należącego do zgłaszającego
 * (cudze id jest po cichu pomijane — bez ujawniania, że zamówienie istnieje).
 */
export async function createSupportRequest(
  db: Database,
  args: { userId: string; accountEmail: string; input: SupportRequestInput; now?: Date },
): Promise<CreatedSupportRequest> {
  const now = args.now ?? new Date();
  let orderId: string | null = null;
  if (args.input.orderId) {
    const [own] = await db
      .select({ id: subscriptionOrders.id })
      .from(subscriptionOrders)
      .where(and(eq(subscriptionOrders.id, args.input.orderId), eq(subscriptionOrders.userId, args.userId)))
      .limit(1);
    orderId = own?.id ?? null;
  }
  const dueAt = supportDueAt(now);
  const [row] = await db
    .insert(supportRequests)
    .values({
      userId: args.userId,
      kind: args.input.kind,
      subject: args.input.subject,
      message: args.input.message,
      orderId,
      contactEmail: args.input.contactEmail || args.accountEmail,
      status: "new",
      createdAt: now,
      dueAt,
    })
    .returning({ id: supportRequests.id });
  return { id: row!.id, dueAt };
}

export async function listUserSupportRequests(db: Database, userId: string, limit = 20) {
  return db
    .select({
      id: supportRequests.id,
      kind: supportRequests.kind,
      subject: supportRequests.subject,
      status: supportRequests.status,
      createdAt: supportRequests.createdAt,
      dueAt: supportRequests.dueAt,
    })
    .from(supportRequests)
    .where(eq(supportRequests.userId, userId))
    .orderBy(desc(supportRequests.createdAt))
    .limit(limit);
}
