import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadGhostTimelineForTarget } from "@/lib/ghost-training/targets";

export async function GET(req: Request) {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as "self" | "friend" | "leader";
  const userId = url.searchParams.get("userId");
  const workoutId = url.searchParams.get("workoutId");
  if (!kind || !userId || !workoutId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const timeline = await loadGhostTimelineForTarget({
    viewerId,
    kind,
    userId,
    workoutId,
  });
  if (!timeline) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ timeline });
}
