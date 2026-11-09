import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { and, gte, isNotNull } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import {
  addCalendarDaysYmd,
  nowLocalYmd,
  startOfLocalDayUtcIso,
} from "@/lib/analytics-date-range";
import { wallClockYmdHourFromUtcIso } from "@/lib/analytics-wall-clock";
import { getDb } from "@/db";
import { pageViews, users } from "@/db/schema";

export const runtime = "nodejs";

const WEEKS = 8;
const TZ = () => process.env.ANALYTICS_TIMEZONE?.trim() || "Europe/Warsaw";

const dayNum = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Poniedziałek tygodnia, w którym wypada `ymd`. */
function mondayOf(ymd: string): string {
  const dow = (dayNum(ymd) + 3) % 7; // 0 = poniedziałek (1970-01-01 to czwartek)
  return addCalendarDaysYmd(ymd, -dow);
}

async function handleGET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const tz = TZ();
  const today = nowLocalYmd(tz);
  const firstMonday = addCalendarDaysYmd(mondayOf(today), -7 * (WEEKS - 1));
  const sinceIso = startOfLocalDayUtcIso(firstMonday, tz);

  const db = getDb();
  const userRows = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(gte(users.createdAt, new Date(sinceIso)));

  const signupYmd = new Map<string, string>();
  for (const u of userRows) {
    signupYmd.set(
      u.id,
      wallClockYmdHourFromUtcIso(new Date(u.createdAt).toISOString(), tz).ymd,
    );
  }

  const viewRows = signupYmd.size
    ? await db
        .select({ userId: pageViews.userId, createdAt: pageViews.createdAt })
        .from(pageViews)
        .where(and(isNotNull(pageViews.userId), gte(pageViews.createdAt, sinceIso)))
    : [];

  // userId -> zbiór dni (względem rejestracji), w których był aktywny
  const activeDays = new Map<string, Set<number>>();
  for (const v of viewRows) {
    const su = v.userId ? signupYmd.get(v.userId) : undefined;
    if (!v.userId || !su) continue;
    const ymd = wallClockYmdHourFromUtcIso(v.createdAt, tz).ymd;
    const diff = dayNum(ymd) - dayNum(su);
    if (diff < 0) continue;
    if (!activeDays.has(v.userId)) activeDays.set(v.userId, new Set());
    activeDays.get(v.userId)!.add(diff);
  }

  // Kohorty tygodniowe
  const cohorts = Array.from({ length: WEEKS }, (_, i) => {
    const start = addCalendarDaysYmd(firstMonday, 7 * i);
    return { start, ids: [] as string[] };
  });
  for (const [id, ymd] of signupYmd) {
    const idx = Math.floor((dayNum(mondayOf(ymd)) - dayNum(firstMonday)) / 7);
    if (idx >= 0 && idx < WEEKS) cohorts[idx].ids.push(id);
  }

  const weekly = cohorts.map((c) => {
    const weeksElapsed = Math.floor((dayNum(today) - dayNum(c.start)) / 7);
    const retention: (number | null)[] = [];
    for (let k = 0; k < WEEKS; k++) {
      if (k > weeksElapsed || !c.ids.length) {
        retention.push(null);
        continue;
      }
      let active = 0;
      for (const id of c.ids) {
        const set = activeDays.get(id);
        if (!set) continue;
        for (let d = 7 * k; d < 7 * k + 7; d++) {
          if (set.has(d)) {
            active++;
            break;
          }
        }
      }
      retention.push(Math.round((active / c.ids.length) * 1000) / 10);
    }
    return { cohort_start: c.start, size: c.ids.length, retention };
  });

  // Retencja D1 / D7 / D30 (aktywność dokładnie w dniu N po rejestracji)
  const dayRet = [1, 7, 30].map((n) => {
    let eligible = 0;
    let returned = 0;
    for (const [id, ymd] of signupYmd) {
      if (dayNum(today) - dayNum(ymd) < n) continue;
      eligible++;
      if (activeDays.get(id)?.has(n)) returned++;
    }
    return {
      day: n,
      eligible,
      returned,
      percent: eligible ? Math.round((returned / eligible) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ timezone: tz, weeks: WEEKS, weekly, day_retention: dayRet });
}

export const GET = withApiErrors(handleGET);
