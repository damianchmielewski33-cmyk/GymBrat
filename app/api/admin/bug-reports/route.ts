import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { bugReports, users } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { isBugStatus } from "@/lib/bug-reports";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const statusParam = new URL(req.url).searchParams.get("status") ?? "open";
  if (!isBugStatus(statusParam)) {
    return NextResponse.json({ error: "Nieprawidłowy status." }, { status: 400 });
  }

  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      id: bugReports.id,
      description: bugReports.description,
      expectedBehavior: bugReports.expectedBehavior,
      stepsToReproduce: bugReports.stepsToReproduce,
      priority: bugReports.priority,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      resolvedAt: bugReports.resolvedAt,
      reporterEmail: users.email,
      reporterName: users.name,
      reporterFirstName: users.firstName,
      reporterLastName: users.lastName,
    })
    .from(bugReports)
    .innerJoin(users, eq(users.id, bugReports.userId))
    .where(eq(bugReports.status, statusParam))
    .orderBy(desc(bugReports.createdAt));

  return NextResponse.json({ ok: true, bugs: rows });
}
