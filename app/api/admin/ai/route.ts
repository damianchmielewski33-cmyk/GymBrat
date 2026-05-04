import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/csrf";
import { requireAdminApi } from "@/lib/admin-api";
import { getAppSettings, setAiGloballyDisabled } from "@/lib/app-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  disabled: z.boolean(),
});

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const settings = await getAppSettings();
  return NextResponse.json({ ok: true, aiGloballyDisabled: settings.aiGloballyDisabled });
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  await setAiGloballyDisabled(parsed.data.disabled);
  return NextResponse.json({ ok: true });
}

