import { auth } from "@/auth";
import { getBodyReportPhotoDataUrlForUser } from "@/lib/body-report-photo-access";
import { imageResponseFromDataUrl } from "@/lib/user-photo-response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const dataUrl = await getBodyReportPhotoDataUrlForUser(id, userId);
  if (!dataUrl) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const res = imageResponseFromDataUrl(dataUrl);
  if (!res) {
    return NextResponse.json({ ok: false, error: "Corrupt image" }, { status: 500 });
  }
  return res;
}
