import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listGhostTargets } from "@/lib/ghost-training/targets";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const planId = url.searchParams.get("planId");
  const targets = await listGhostTargets(userId, planId);
  return NextResponse.json({ targets });
}
