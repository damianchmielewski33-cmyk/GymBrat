import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = z
    .object({
      q: z.string().trim().min(1).max(80),
      days: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .pipe(z.number().int().min(14).max(730).optional()),
    })
    .safeParse({
      q: url.searchParams.get("q") ?? "",
      days: url.searchParams.get("days") ?? undefined,
    });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const data = await getExerciseProgressSeries({
    userId: session.user.id,
    exerciseQuery: parsed.data.q,
    days: parsed.data.days,
  });

  const res = NextResponse.json({ ok: true, ...data });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

