import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { deleteNotifications } from "@/lib/community/notifications";
import { UserMessages } from "@/lib/user-facing-errors";

const schema = z.object({
  ids: z.array(z.string().min(8).max(64)).max(50).optional(),
  all: z.boolean().optional(),
});

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("notif-delete", req),
    40,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  if (!parsed.data.all && !(parsed.data.ids && parsed.data.ids.length > 0)) {
    return NextResponse.json(
      { error: "Podaj ids albo all." },
      { status: 400 },
    );
  }

  const result = await deleteNotifications({
    userId: session.user.id,
    ids: parsed.data.ids ?? null,
    all: !!parsed.data.all,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, deleted: result.deleted });
}

export const POST = withApiErrors(handlePOST);
