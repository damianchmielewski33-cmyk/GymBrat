import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import {
  addCalendarDaysYmd,
  listLocalYmdsInclusive,
  localYmdInclusiveUtcRange,
} from "@/lib/analytics-date-range";
import { wallClockYmdHourFromUtcIso } from "@/lib/analytics-wall-clock";
import { SCREEN_LABELS } from "@/lib/analytics-screen";
import { formatActivityTimePl } from "@/lib/activity-display";
import { getDb } from "@/db";
import { pageViews, siteActivityLog, subscriptionOrders, users, workouts } from "@/db/schema";

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
  // Limit zakresu (ochrona przed ogromnym zapytaniem).
  if (listLocalYmdsInclusive(from, to).length > 366) return { ok: false };
  const { fromIso, toIso } = localYmdInclusiveUtcRange(from, to);
  return {
    ok: true,
    fromDate: from,
    toDate: to,
    fromIso,
    toIso,
  };
}

async function handleGET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
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
      and(
        gte(pageViews.createdAt, fromIso),
        lte(pageViews.createdAt, toIso),
      ),
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

  // --- Szeregi dzienne (strefa analityki) ---
  const tz = process.env.ANALYTICS_TIMEZONE?.trim() || "Europe/Warsaw";
  const days = listLocalYmdsInclusive(fromDate, toDate);
  const daily = new Map(
    days.map((d) => [
      d,
      { views: 0, tokens: new Set<string>(), signups: 0, workouts: 0, revenue: 0, orders: 0 },
    ]),
  );
  for (const row of pvRows) {
    const { ymd } = wallClockYmdHourFromUtcIso(row.createdAt, tz);
    const b = daily.get(ymd);
    if (!b) continue;
    b.views += 1;
    b.tokens.add(row.userId ? `u:${row.userId}` : `v:${row.visitorId}`);
  }

  const signupRows = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(and(gte(users.createdAt, new Date(fromIso)), lte(users.createdAt, new Date(toIso))));
  for (const r of signupRows) {
    const { ymd } = wallClockYmdHourFromUtcIso(new Date(r.createdAt).toISOString(), tz);
    const b = daily.get(ymd);
    if (b) b.signups += 1;
  }

  const workoutRows = await db
    .select({ date: workouts.date, userId: workouts.userId })
    .from(workouts)
    .where(and(gte(workouts.date, fromDate), lte(workouts.date, toDate)));
  const workoutUsers = new Set<string>();
  for (const r of workoutRows) {
    const b = daily.get(r.date);
    if (!b) continue;
    b.workouts += 1;
    workoutUsers.add(r.userId);
  }

  const paidRows = await db
    .select({ paidAt: subscriptionOrders.paidAt, amount: subscriptionOrders.amountGrosze })
    .from(subscriptionOrders)
    .where(
      and(
        inArray(subscriptionOrders.status, ["paid"]),
        gte(subscriptionOrders.paidAt, new Date(fromIso)),
        lte(subscriptionOrders.paidAt, new Date(toIso)),
      ),
    );
  let revenueGrosze = 0;
  for (const r of paidRows) {
    if (!r.paidAt) continue;
    const { ymd } = wallClockYmdHourFromUtcIso(new Date(r.paidAt).toISOString(), tz);
    const b = daily.get(ymd);
    if (!b) continue;
    b.revenue += r.amount;
    b.orders += 1;
    revenueGrosze += r.amount;
  }

  const timeline = days.map((ymd) => {
    const b = daily.get(ymd)!;
    return {
      ymd,
      views: b.views,
      unique_visitors: b.tokens.size,
      signups: b.signups,
      workouts: b.workouts,
      revenue_pln: Math.round(b.revenue) / 100,
      orders: b.orders,
    };
  });

  // --- Poprzedni okres o tej samej długości (porównanie) ---
  const prevTo = addCalendarDaysYmd(fromDate, -1);
  const prevFrom = addCalendarDaysYmd(fromDate, -days.length);
  const prevRange = localYmdInclusiveUtcRange(prevFrom, prevTo);
  const prevRows = await db
    .select({ userId: pageViews.userId, visitorId: pageViews.visitorId })
    .from(pageViews)
    .where(and(gte(pageViews.createdAt, prevRange.fromIso), lte(pageViews.createdAt, prevRange.toIso)));
  const previous = {
    total_views: prevRows.length,
    unique_visitors: new Set(prevRows.map((r) => (r.userId ? `u:${r.userId}` : `v:${r.visitorId}`))).size,
  };

  // --- Rejestracje -> logowanie: lejek ---
  const registeredVisitors = visitorTokens.size;
  const authedVisitors = new Set(pvRows.filter((r) => r.userId).map((r) => r.userId as string)).size;

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
    timeline,
    previous,
    business: {
      signups: timeline.reduce((a, d) => a + d.signups, 0),
      workouts: timeline.reduce((a, d) => a + d.workouts, 0),
      workout_users: workoutUsers.size,
      revenue_pln: Math.round(revenueGrosze) / 100,
      orders: paidRows.length,
      visitors_total: registeredVisitors,
      visitors_logged_in: authedVisitors,
    },
  });
}

export const GET = withApiErrors(handleGET);
