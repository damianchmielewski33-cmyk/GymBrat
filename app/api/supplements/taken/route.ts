import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertAnalyticsOrigin } from "@/lib/csrf";
import { withApiErrors } from "@/lib/errors/api";
import { setIntakes } from "@/lib/supplement-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(z.object({ name: z.string().min(1).max(80), slot: z.string().max(5) }))
    .min(1)
    .max(40),
});

/** Odhaczenie z przycisku „Przyjąłem” w powiadomieniu push (cookie sesji, ta sama domena). */
async function handlePOST(req: Request) {
  // Service worker nie ma tokenu CSRF — wystarcza kontrola Origin / Sec-Fetch-Site.
  const originBlock = assertAnalyticsOrigin(req);
  if (originBlock) return originBlock;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const updated = await setIntakes(userId, parsed.data.items, true);
  return NextResponse.json({ ok: true, updated });
}

export const POST = withApiErrors(handlePOST);
