import { auth } from "@/auth";
import { createBodyReport, getBodyReports, type CreateBodyReportInput } from "@/lib/body-reports";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }
  const reports = await getBodyReports(session.user.id);
  return NextResponse.json({ ok: true, reports });
}

const createSchema = z.object({
  weightKg: z.number().finite().min(0).max(1000).nullable().optional(),
  waistCm: z.number().finite().min(0).max(500).nullable().optional(),
  chestCm: z.number().finite().min(0).max(500).nullable().optional(),
  thighCm: z.number().finite().min(0).max(500).nullable().optional(),
  trainingEnergy: z.number().finite().min(1).max(10).nullable().optional(),
  sleepQuality: z.number().finite().min(1).max(10).nullable().optional(),
  dayEnergy: z.number().finite().min(1).max(10).nullable().optional(),
  digestionScore: z.number().finite().min(1).max(10).nullable().optional(),
  cardioCompliance: z.string().max(16).nullable().optional(),
  dietCompliance: z.string().max(16).nullable().optional(),
  trainingCompliance: z.string().max(16).nullable().optional(),
  complianceNotes: z.string().max(20_000).nullable().optional(),
  additionalInfo: z.string().max(20_000).nullable().optional(),
  photoDataUrls: z.array(z.string().max(200_000)).max(8).optional(),
});

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const id = await createBodyReport(session.user.id, parsed.data as CreateBodyReportInput);
  revalidatePath("/reports");
  return NextResponse.json({ ok: true, id });
}

