import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withApiErrors } from "@/lib/errors/api";
import { getUserOrder } from "@/lib/orders";
import { orderStatusHint, orderStatusLabel } from "@/lib/orders-format";

export const runtime = "nodejs";

/** Status własnego zamówienia (odpytywany po powrocie z bramki płatności). */
async function handleGET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const order = await getUserOrder(session.user.id, id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono zamówienia." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    status: order.status,
    label: orderStatusLabel(order.status),
    hint: orderStatusHint(order.status),
  });
}

export const GET = withApiErrors(handleGET);
