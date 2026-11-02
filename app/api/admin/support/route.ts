import { and, asc, count, desc, eq, ne, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { supportRequests, users } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { withApiErrors } from "@/lib/errors/api";
import { isSupportStatus } from "@/lib/support";

export const runtime = "nodejs";

/** Lista zgłoszeń do wsparcia (admin). `?summary=1` → licznik otwartych i przeterminowanych. */
async function handleGET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  await ensureCriticalSchema();
  const db = getDb();
  const url = new URL(req.url);

  if (url.searchParams.get("summary") === "1") {
    const now = new Date();
    const [open] = await db
      .select({ n: count() })
      .from(supportRequests)
      .where(ne(supportRequests.status, "resolved"));
    const [overdue] = await db
      .select({ n: count() })
      .from(supportRequests)
      .where(and(ne(supportRequests.status, "resolved"), lt(supportRequests.dueAt, now)));
    return NextResponse.json({ ok: true, openCount: Number(open?.n ?? 0), overdueCount: Number(overdue?.n ?? 0) });
  }

  const statusParam = url.searchParams.get("status") ?? "new";
  if (!isSupportStatus(statusParam)) {
    return NextResponse.json({ error: "Nieprawidłowy status." }, { status: 400 });
  }

  const rows = await db
    .select({
      id: supportRequests.id,
      kind: supportRequests.kind,
      subject: supportRequests.subject,
      message: supportRequests.message,
      orderId: supportRequests.orderId,
      contactEmail: supportRequests.contactEmail,
      status: supportRequests.status,
      createdAt: supportRequests.createdAt,
      dueAt: supportRequests.dueAt,
      resolvedAt: supportRequests.resolvedAt,
      adminNote: supportRequests.adminNote,
      accountEmail: users.email,
    })
    .from(supportRequests)
    .innerJoin(users, eq(users.id, supportRequests.userId))
    .where(eq(supportRequests.status, statusParam))
    .orderBy(statusParam === "resolved" ? desc(supportRequests.createdAt) : asc(supportRequests.dueAt))
    .limit(200);

  return NextResponse.json({ ok: true, requests: rows });
}

export const GET = withApiErrors(handleGET);
