import { auth } from "@/auth";
import { loadStartPhotoDataUrl } from "@/lib/start-photo";
import { imageResponseFromDataUrl } from "@/lib/user-photo-response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dataUrl = await loadStartPhotoDataUrl(userId);
  if (!dataUrl) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const res = imageResponseFromDataUrl(dataUrl);
  if (!res) {
    return NextResponse.json({ ok: false, error: "Corrupt image" }, { status: 500 });
  }
  return res;
}
