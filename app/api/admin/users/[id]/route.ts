import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { getFounderUserId } from "@/lib/admin-session";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";

export const runtime = "nodejs";

const patchSchema = z.object({
  appRole: z.enum(["zawodnik", "trener"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const founderId = await getFounderUserId();
  if (founderId !== null && id === founderId) {
    return NextResponse.json(
      { error: "Nie można zmienić roli pierwszego administratora w bazie." },
      { status: 400 },
    );
  }

  const db = getDb();
  await db
    .update(users)
    .set({ appRole: parsed.data.appRole })
    .where(eq(users.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const sessionUserId = gate.session.user!.id!;
  const { id } = await ctx.params;

  if (id === sessionUserId) {
    return NextResponse.json(
      { error: "Nie możesz usunąć własnego konta z panelu." },
      { status: 400 },
    );
  }

  const founderId = await getFounderUserId();
  if (founderId !== null && id === founderId) {
    return NextResponse.json(
      { error: "Nie można usunąć pierwszego administratora w bazie." },
      { status: 400 },
    );
  }

  const db = getDb();
  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ ok: true });
}
