import { auth } from "@/auth";
import { createBodyReport, getBodyReports, type CreateBodyReportInput } from "@/lib/body-reports";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }
  const reports = await getBodyReports(session.user.id);
  return NextResponse.json({ ok: true, reports });
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  let body: CreateBodyReportInput;
  try {
    body = (await req.json()) as CreateBodyReportInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const id = await createBodyReport(session.user.id, body);
  revalidatePath("/reports");
  return NextResponse.json({ ok: true, id });
}

