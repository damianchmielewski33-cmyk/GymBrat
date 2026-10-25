import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { loadGhostTimelineForTarget } from "@/lib/ghost-training/targets";

const ghostKindSchema = z.enum(["self", "friend", "leader"]);

async function handleGET(req: Request) {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const rawKind = url.searchParams.get("kind");
  const userId = url.searchParams.get("userId");
  const workoutId = url.searchParams.get("workoutId");
  if (!rawKind || !userId || !workoutId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const kindResult = ghostKindSchema.safeParse(rawKind);
  if (!kindResult.success) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const timeline = await loadGhostTimelineForTarget({
    viewerId,
    kind: kindResult.data,
    userId,
    workoutId,
  });
  if (!timeline) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ timeline });
}

export const GET = withApiErrors(handleGET);
