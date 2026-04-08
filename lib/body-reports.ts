import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReportPhotos, bodyReports } from "@/db/schema";

export type BodyReport = {
  id: string;
  createdAt: Date;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  trainingEnergy: number | null;
  sleepQuality: number | null;
  dayEnergy: number | null;
  digestionScore: number | null;
  cardioCompliance: string | null;
  dietCompliance: string | null;
  trainingCompliance: string | null;
  complianceNotes: string | null;
  additionalInfo: string | null;
  photos: { id: string; dataUrl: string }[];
};

export async function getBodyReports(userId: string): Promise<BodyReport[]> {
  const db = getDb();
  const reports = await db
    .select()
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
    .limit(50);

  if (reports.length === 0) return [];

  const reportIds = reports.map((r) => r.id);
  const photos = await db
    .select()
    .from(bodyReportPhotos)
    .where(
      reportIds.length === 1
        ? eq(bodyReportPhotos.reportId, reportIds[0]!)
        : inArray(bodyReportPhotos.reportId, reportIds),
    );

  const photosByReport = new Map<string, { id: string; dataUrl: string }[]>();
  for (const p of photos) {
    const arr = photosByReport.get(p.reportId) ?? [];
    arr.push({ id: p.id, dataUrl: p.dataUrl });
    photosByReport.set(p.reportId, arr);
  }

  const rows = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    weightKg: r.weightKg ?? null,
    waistCm: r.waistCm ?? null,
    chestCm: r.chestCm ?? null,
    thighCm: r.thighCm ?? null,
    trainingEnergy: r.trainingEnergy ?? null,
    sleepQuality: r.sleepQuality ?? null,
    dayEnergy: r.dayEnergy ?? null,
    digestionScore: r.digestionScore ?? null,
    cardioCompliance: r.cardioCompliance ?? null,
    dietCompliance: r.dietCompliance ?? null,
    trainingCompliance: r.trainingCompliance ?? null,
    complianceNotes: r.complianceNotes ?? null,
    additionalInfo: r.additionalInfo ?? null,
    photos: photosByReport.get(r.id) ?? [],
  }));

  rows.sort((a, b) => {
    const byTime = b.createdAt.getTime() - a.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });

  return rows;
}

export type CreateBodyReportInput = {
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  thighCm?: number | null;
  trainingEnergy?: number | null;
  sleepQuality?: number | null;
  dayEnergy?: number | null;
  digestionScore?: number | null;
  cardioCompliance?: string | null;
  dietCompliance?: string | null;
  trainingCompliance?: string | null;
  complianceNotes?: string | null;
  additionalInfo?: string | null;
  photoDataUrls?: string[];
};

function clampScore(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 10) return null;
  return i;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function takNieOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "tak" || s === "yes" || s === "1") return "tak";
  if (s === "nie" || s === "no" || s === "0") return "nie";
  const u = String(v ?? "").trim().toUpperCase();
  if (u === "TAK") return "tak";
  if (u === "NIE") return "nie";
  return null;
}

function textOrNull(v: unknown, maxLen = 20000): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export async function createBodyReport(userId: string, input: CreateBodyReportInput) {
  const db = getDb();

  const row = {
    userId,
    weightKg: numOrNull(input.weightKg),
    waistCm: numOrNull(input.waistCm),
    chestCm: numOrNull(input.chestCm),
    thighCm: numOrNull(input.thighCm),
    trainingEnergy: clampScore(input.trainingEnergy),
    sleepQuality: clampScore(input.sleepQuality),
    dayEnergy: clampScore(input.dayEnergy),
    digestionScore: clampScore(input.digestionScore),
    cardioCompliance: takNieOrNull(input.cardioCompliance),
    dietCompliance: takNieOrNull(input.dietCompliance),
    trainingCompliance: takNieOrNull(input.trainingCompliance),
    complianceNotes: textOrNull(input.complianceNotes),
    additionalInfo: textOrNull(input.additionalInfo),
  };

  const [inserted] = await db.insert(bodyReports).values(row).returning();
  const reportId = inserted!.id;

  const dataUrls = (input.photoDataUrls ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (dataUrls.length) {
    await db.insert(bodyReportPhotos).values(
      dataUrls.map((dataUrl) => ({
        reportId,
        dataUrl,
      })),
    );
  }

  return reportId;
}

export type ImportBodyReportRow = {
  createdAt: Date;
  weightKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  thighCm?: number | null;
  trainingEnergy?: number | null;
  sleepQuality?: number | null;
  dayEnergy?: number | null;
  digestionScore?: number | null;
  cardioCompliance?: string | null;
  dietCompliance?: string | null;
  trainingCompliance?: string | null;
  complianceNotes?: string | null;
  additionalInfo?: string | null;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function importBodyReports(
  userId: string,
  rows: ImportBodyReportRow[],
): Promise<{ imported: number; skipped: number }> {
  const db = getDb();
  const cleaned = rows
    .map((r) => ({
      createdAt: r.createdAt,
      userId,
      weightKg: numOrNull(r.weightKg),
      waistCm: numOrNull(r.waistCm),
      chestCm: numOrNull(r.chestCm),
      thighCm: numOrNull(r.thighCm),
      trainingEnergy: clampScore(r.trainingEnergy),
      sleepQuality: clampScore(r.sleepQuality),
      dayEnergy: clampScore(r.dayEnergy),
      digestionScore: clampScore(r.digestionScore),
      cardioCompliance: takNieOrNull(r.cardioCompliance),
      dietCompliance: takNieOrNull(r.dietCompliance),
      trainingCompliance: takNieOrNull(r.trainingCompliance),
      complianceNotes: textOrNull(r.complianceNotes),
      additionalInfo: textOrNull(r.additionalInfo),
    }))
    .filter((r) => r.createdAt instanceof Date && !Number.isNaN(r.createdAt.getTime()));

  if (cleaned.length === 0) return { imported: 0, skipped: 0 };

  // De-dupe by calendar day: if a report already exists for that day, skip.
  const existing = await db
    .select({ createdAt: bodyReports.createdAt })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId));
  const existingDays = new Set(existing.map((r) => dayKey(r.createdAt)));

  const toInsert = cleaned.filter((r) => !existingDays.has(dayKey(r.createdAt)));
  const skipped = cleaned.length - toInsert.length;

  if (toInsert.length === 0) return { imported: 0, skipped };

  // Hard limit to keep requests safe.
  const limited = toInsert.slice(0, 500);

  await db.insert(bodyReports).values(limited);
  return { imported: limited.length, skipped: skipped + (toInsert.length - limited.length) };
}

