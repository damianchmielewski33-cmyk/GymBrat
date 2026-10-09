import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { bugReportPhotos, bugReports, users } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import { isBugStatus } from "@/lib/bug-reports";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  await ensureCriticalSchema();
  const db = getDb();

  if (url.searchParams.get("summary") === "1") {
    const [row] = await db
      .select({ openCount: count() })
      .from(bugReports)
      .where(eq(bugReports.status, "open"));
    return NextResponse.json({
      ok: true,
      openCount: Number(row?.openCount ?? 0),
    });
  }

  const statusParam = url.searchParams.get("status") ?? "open";
  if (!isBugStatus(statusParam)) {
    return NextResponse.json({ error: "Nieprawidłowy status." }, { status: 400 });
  }

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

  const ids = rows.map((r) => r.id);
  const photoRows =
    ids.length === 0
      ? []
      : await db
          .select({
            id: bugReportPhotos.id,
            bugReportId: bugReportPhotos.bugReportId,
            dataUrl: bugReportPhotos.dataUrl,
          })
          .from(bugReportPhotos)
          .where(inArray(bugReportPhotos.bugReportId, ids))
          .orderBy(asc(bugReportPhotos.createdAt));

  const photosByBug = new Map<string, string[]>();
  for (const p of photoRows) {
    const url = maybeDecryptSensitiveField(p.dataUrl);
    if (!url) continue;
    const list = photosByBug.get(p.bugReportId) ?? [];
    list.push(url);
    photosByBug.set(p.bugReportId, list);
  }

  return NextResponse.json({
    ok: true,
    bugs: rows.map((r) => ({
      ...r,
      photos: photosByBug.get(r.id) ?? [],
    })),
  });
}
