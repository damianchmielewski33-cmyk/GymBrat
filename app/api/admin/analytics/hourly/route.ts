import { NextResponse } from "next/server";
import { and, gte, lte } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import {
  analyticsDeploymentPredicate,
  getAnalyticsDeployment,
} from "@/lib/analytics-deployment";
import {
  addCalendarDaysYmd,
  listLocalYmdsInclusive,
  localYmdInclusiveUtcRange,
  nowLocalYmd,
  startOfLocalDayUtcIso,
} from "@/lib/analytics-date-range";
import { wallClockYmdHourFromUtcIso } from "@/lib/analytics-wall-clock";
import { getDb } from "@/db";
import { pageViews } from "@/db/schema";

export const runtime = "nodejs";

const TZ = () => process.env.ANALYTICS_TIMEZONE?.trim() || "Europe/Warsaw";

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const includeUntagged =
    new URL(req.url).searchParams.get("include_untagged") === "1";
  const timeZone = TZ();
  const toYmd = nowLocalYmd(timeZone);
  const fromYmd = addCalendarDaysYmd(toYmd, -6);
  const { fromIso, toIso } = localYmdInclusiveUtcRange(fromYmd, toYmd, timeZone);

  const days = listLocalYmdsInclusive(fromYmd, toYmd);
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const dtfShort = new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const dtfDayOnly = new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  const dayMeta = days.map((ymd) => {
    const startMs = Date.parse(startOfLocalDayUtcIso(ymd, timeZone));
    const anchor = Number.isNaN(startMs)
      ? null
      : new Date(startMs + 12 * 3600 * 1000);
    return {
      ymd,
      labelShort: anchor ? dtfShort.format(anchor) : ymd,
      labelDay: anchor ? dtfDayOnly.format(anchor) : ymd,
    };
  });

  const db = getDb();
  const rows = await db
    .select({ createdAt: pageViews.createdAt })
    .from(pageViews)
    .where(
      and(
        gte(pageViews.createdAt, fromIso),
        lte(pageViews.createdAt, toIso),
        analyticsDeploymentPredicate(pageViews.deploymentEnv, includeUntagged),
      ),
    );

  const byHourTotal = new Array<number>(24).fill(0);
  const matrix = days.map(() => new Array<number>(24).fill(0));
  const timelineMap = new Map<string, number>();
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
      timelineMap.set(`${d}_${h}`, 0);
    }
  }

  for (const { createdAt } of rows) {
    const { ymd, hour } = wallClockYmdHourFromUtcIso(createdAt, timeZone);
    if (hour < 0 || hour > 23 || !dayIndex.has(ymd)) continue;
    byHourTotal[hour]++;
    const di = dayIndex.get(ymd)!;
    matrix[di][hour]++;
    const k = `${ymd}_${hour}`;
    timelineMap.set(k, (timelineMap.get(k) ?? 0) + 1);
  }

  const by_hour = byHourTotal.map((views, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    views,
  }));

  let peakHour = 0;
  let peakViews = 0;
  for (let h = 0; h < 24; h++) {
    if (byHourTotal[h] > peakViews) {
      peakViews = byHourTotal[h];
      peakHour = h;
    }
  }

  const timeline_hourly: {
    ymd: string;
    hour: number;
    views: number;
    slotLabel: string;
    dayLabel: string;
    xKey: string;
  }[] = [];

  for (let di = 0; di < days.length; di++) {
    const { ymd, labelShort } = dayMeta[di];
    for (let h = 0; h < 24; h++) {
      const views = timelineMap.get(`${ymd}_${h}`) ?? 0;
      timeline_hourly.push({
        ymd,
        hour: h,
        views,
        slotLabel: `${labelShort}, ${String(h).padStart(2, "0")}:00`,
        dayLabel: labelShort,
        xKey: `${ymd}_${String(h).padStart(2, "0")}`,
      });
    }
  }

  const by_day = dayMeta.map((meta, di) => ({
    ymd: meta.ymd,
    label: meta.labelDay,
    hours: matrix[di],
    total: matrix[di].reduce((a, b) => a + b, 0),
  }));

  return NextResponse.json({
    deployment: {
      filter: getAnalyticsDeployment(),
      include_untagged: includeUntagged,
    },
    timezone: timeZone,
    range: { from: fromYmd, to: toYmd },
    utc_range: { from: fromIso, to: toIso },
    total_views: rows.length,
    by_hour,
    timeline_hourly,
    by_day,
    peak: {
      hour: peakHour,
      label: `${String(peakHour).padStart(2, "0")}:00`,
      views: peakViews,
    },
  });
}
