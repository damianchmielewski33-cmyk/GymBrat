import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import { localYmdInclusiveUtcRange } from "@/lib/analytics-date-range";
import { SCREEN_LABELS } from "@/lib/analytics-screen";
import { formatActivityTimePl } from "@/lib/activity-display";
import { getDb } from "@/db";
import { pageViews, siteActivityLog, users } from "@/db/schema";

export const runtime = "nodejs";

function parseRange(searchParams: URLSearchParams):
  | { ok: true; fromDate: string; toDate: string; fromIso: string; toIso: string }
  | { ok: false } {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (
    !from ||
    !to ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return { ok: false };
  }
  if (from > to) return { ok: false };
  const { fromIso, toIso } = localYmdInclusiveUtcRange(from, to);
  return {
    ok: true,
    fromDate: from,
    toDate: to,
    fromIso,
    toIso,
  };
}

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const range = parseRange(new URL(req.url).searchParams);
  if (!range.ok) {
    return NextResponse.json(
      { error: "Podaj zakres dat: from i to (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const { fromDate, toDate, fromIso, toIso } = range;
  const db = getDb();

  const pvRows = await db
    .select()
    .from(pageViews)
    .where(
      and(gte(pageViews.createdAt, fromIso), lte(pageViews.createdAt, toIso)),
    );

  const screenMap = new Map<
    string,
    { total_views: number; visitors: Set<string> }
  >();
  const visitorTokens = new Set<string>();

  for (const row of pvRows) {
    const key = row.screenKey;
    if (!screenMap.has(key)) {
      screenMap.set(key, { total_views: 0, visitors: new Set() });
    }
    const bucket = screenMap.get(key)!;
    bucket.total_views += 1;
    const tok =
      row.userId != null && row.userId !== ""
        ? `u:${row.userId}`
        : `v:${row.visitorId}`;
    bucket.visitors.add(tok);
    visitorTokens.add(tok);
  }

  const screens = [...screenMap.entries()]
    .map(([screen_key, v]) => ({
      screen_key,
      label: SCREEN_LABELS[screen_key] ?? screen_key,
      total_views: v.total_views,
      unique_visitors: v.visitors.size,
    }))
    .sort((a, b) => b.total_views - a.total_views);

  const totals = {
    total_views: pvRows.length,
    unique_visitors: visitorTokens.size,
    anonymous_views: pvRows.filter((r) => !r.userId).length,
    authenticated_views: pvRows.filter((r) => r.userId).length,
  };

  const totalUsers = (await db.select({ id: users.id }).from(users)).length;

  const distinctLoggedInVisitors = new Set(
    pvRows.filter((r) => r.userId).map((r) => r.userId as string),
  ).size;

  const activityRows = await db
    .select({
      id: siteActivityLog.id,
      action: siteActivityLog.action,
      createdAt: siteActivityLog.createdAt,
      userId: siteActivityLog.userId,
      metaJson: siteActivityLog.metaJson,
      userName: users.name,
      userEmail: users.email,
    })
    .from(siteActivityLog)
    .leftJoin(users, eq(siteActivityLog.userId, users.id))
    .where(
      and(
        gte(siteActivityLog.createdAt, new Date(fromIso)),
        lte(siteActivityLog.createdAt, new Date(toIso)),
      ),
    )
    .orderBy(desc(siteActivityLog.createdAt))
    .limit(400);

  const activity_events = activityRows.map((r) => ({
    id: r.id,
    action: r.action,
    actor_label:
      r.userEmail != null
        ? `${r.userName ?? "Użytkownik"} (${r.userEmail})`
        : "Gość",
    time_display: formatActivityTimePl(new Date(r.createdAt)),
    metaJson: r.metaJson,
  }));

  return NextResponse.json({
    range: { from: fromDate, to: toDate },
    totals,
    screens,
    accounts: {
      registered_total: totalUsers,
      distinct_logged_in_visitors_in_range: distinctLoggedInVisitors,
    },
    activity_events,
  });
}
