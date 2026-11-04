import { asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReports } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import type { HomeStartSpark } from "@/lib/home-start-types";

export async function getProgramStartAndReportCount(userId: string): Promise<{
  daysInProgram: number | null;
  reportCount: number;
  firstReportAt: Date | null;
}> {
  const db = getDb();
  const [[countRow], [firstReport]] = await Promise.all([
    db
      .select({ n: count() })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId)),
    db
      .select({ createdAt: bodyReports.createdAt })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId))
      .orderBy(asc(bodyReports.createdAt), asc(bodyReports.id))
      .limit(1),
  ]);

  const reportCount = Number(countRow?.n ?? 0);
  const firstReportAt = firstReport?.createdAt
    ? new Date(firstReport.createdAt)
    : null;
  const daysInProgram =
    firstReportAt && !Number.isNaN(firstReportAt.getTime())
      ? Math.max(
          1,
          Math.floor((Date.now() - firstReportAt.getTime()) / 86_400_000) + 1,
        )
      : null;

  return { daysInProgram, reportCount, firstReportAt };
}

function reportDateKey(d: Date): string {
  return calendarDateKey(d);
}

function compliancePct(values: Array<string | null>): number | null {
  const known = values.filter((v) => v === "tak" || v === "nie");
  if (known.length === 0) return null;
  const yes = known.filter((v) => v === "tak").length;
  return Math.round((yes / known.length) * 100);
}

function toComplianceSlot(v: string | null | undefined): "tak" | "nie" | null {
  if (v === "tak" || v === "nie") return v;
  return null;
}

/** Ostatnie `windowSize` raportów, od najstarszego do najnowszego (lewo → prawo). */
function complianceHistoryWindow(
  valuesNewestFirst: Array<string | null>,
  windowSize: number,
): Array<"tak" | "nie" | null> {
  const slice = valuesNewestFirst.slice(0, windowSize);
  return slice.map(toComplianceSlot).reverse();
}

const COMPLIANCE_HISTORY_WINDOW = 24;

export async function getReportInsights(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      createdAt: bodyReports.createdAt,
      waistCm: bodyReports.waistCm,
      thighCm: bodyReports.thighCm,
      chestCm: bodyReports.chestCm,
      armCm: bodyReports.armCm,
      dayEnergy: bodyReports.dayEnergy,
      sleepQuality: bodyReports.sleepQuality,
      digestionScore: bodyReports.digestionScore,
      trainingEnergy: bodyReports.trainingEnergy,
      dietCompliance: bodyReports.dietCompliance,
      trainingCompliance: bodyReports.trainingCompliance,
      cardioCompliance: bodyReports.cardioCompliance,
      additionalInfo: bodyReports.additionalInfo,
    })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
    .limit(45);

  const latest = rows[0] ?? null;
  const coachText = latest?.additionalInfo?.trim() || null;
  const daysSinceLastReport =
    latest?.createdAt != null
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000,
          ),
        )
      : null;

  const chronological = [...rows].reverse();
  const spark = (
    pick: (r: (typeof chronological)[number]) => number | null,
  ): HomeStartSpark[] =>
    chronological
      .map((r) => {
        const value = pick(r);
        if (value == null || !Number.isFinite(value)) return null;
        return { date: reportDateKey(new Date(r.createdAt)), value };
      })
      .filter((p): p is HomeStartSpark => p != null);

  const dietValues = rows.map((r) => r.dietCompliance);
  const trainingValues = rows.map((r) => r.trainingCompliance);
  const cardioValues = rows.map((r) => r.cardioCompliance);

  return {
    daysSinceLastReport,
    formToday: {
      energy: latest?.dayEnergy ?? null,
      sleep: latest?.sleepQuality ?? null,
      digestion: latest?.digestionScore ?? null,
      training: latest?.trainingEnergy ?? null,
    },
    coachNote:
      coachText && latest?.createdAt
        ? {
            text: coachText,
            dateKey: reportDateKey(new Date(latest.createdAt)),
          }
        : null,
    compliance: {
      dietPct: compliancePct(dietValues),
      trainingPct: compliancePct(trainingValues),
      cardioPct: compliancePct(cardioValues),
      lastN: rows.length,
      doneN: rows.filter((r) => r.dietCompliance === "tak").length,
      historyWindow: COMPLIANCE_HISTORY_WINDOW,
      dietHistory: complianceHistoryWindow(dietValues, COMPLIANCE_HISTORY_WINDOW),
      trainingHistory: complianceHistoryWindow(
        trainingValues,
        COMPLIANCE_HISTORY_WINDOW,
      ),
      cardioHistory: complianceHistoryWindow(
        cardioValues,
        COMPLIANCE_HISTORY_WINDOW,
      ),
    },
    waistSeries: spark((r) => r.waistCm).map((p) => ({ date: p.date, cm: p.value })),
    waistSpark: spark((r) => r.waistCm),
    thighSpark: spark((r) => r.thighCm),
    chestSpark: spark((r) => r.chestCm),
    armSpark: spark((r) => r.armCm),
  };
}
