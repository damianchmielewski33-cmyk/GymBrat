import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teamMembers, workouts } from "@/db/schema";
import { listFriendsAndPending } from "@/lib/community/friendships";
import { computeTeamFcsRanking } from "@/lib/community/fcs-compute";
import { buildGhostTimeline } from "@/lib/ghost-training/timeline";
import type { GhostTargetOption, GhostTimeline } from "@/lib/ghost-training/types";

export async function listGhostTargets(
  userId: string,
  planId: string | null,
): Promise<GhostTargetOption[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const options: GhostTargetOption[] = [];

  const selfQ = db
    .select({
      id: workouts.id,
      date: workouts.date,
      planId: workouts.workoutPlanId,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date))
    .limit(5);

  const selfRows = planId
    ? await db
        .select({
          id: workouts.id,
          date: workouts.date,
          planId: workouts.workoutPlanId,
        })
        .from(workouts)
        .where(
          and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, planId)),
        )
        .orderBy(desc(workouts.date))
        .limit(3)
    : await selfQ;

  for (const w of selfRows) {
    options.push({
      kind: "self",
      userId,
      label: "Twój poprzedni trening",
      subtitle: `Sesja · ${w.date}`,
      workoutId: w.id,
      planId: w.planId,
    });
  }

  const { friends } = await listFriendsAndPending(userId);
  for (const f of friends.filter((x) => x.mutualShare || x.theyShareWorkout)) {
    const [w] = await db
      .select({
        id: workouts.id,
        date: workouts.date,
        planId: workouts.workoutPlanId,
      })
      .from(workouts)
      .where(eq(workouts.userId, f.userId))
      .orderBy(desc(workouts.date))
      .limit(1);
    if (!w) continue;
    options.push({
      kind: "friend",
      userId: f.userId,
      label: f.displayName,
      subtitle: `Znajomy · ${w.date}`,
      workoutId: w.id,
      planId: w.planId,
    });
  }

  const myTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  for (const t of myTeams.slice(0, 3)) {
    const ranking = await computeTeamFcsRanking(t.teamId);
    const leader = ranking.find((r) => r.rank === 1 && r.score > 0);
    if (!leader || leader.userId === userId) continue;
    const [w] = await db
      .select({
        id: workouts.id,
        date: workouts.date,
        planId: workouts.workoutPlanId,
      })
      .from(workouts)
      .where(eq(workouts.userId, leader.userId))
      .orderBy(desc(workouts.date))
      .limit(1);
    if (!w) continue;
    options.push({
      kind: "leader",
      userId: leader.userId,
      label: leader.displayName,
      subtitle: `Lider FCS · ${w.date}`,
      workoutId: w.id,
      planId: w.planId,
    });
  }

  return options;
}

export async function loadGhostTimelineForTarget(input: {
  viewerId: string;
  kind: "self" | "friend" | "leader";
  userId: string;
  workoutId: string;
}): Promise<GhostTimeline | null> {
  if (
    input.kind !== "self" &&
    input.kind !== "friend" &&
    input.kind !== "leader"
  ) {
    // Defense in depth: nieznana wartość `kind` (np. pominięcie walidacji
    // w route) nigdy nie ma dostępu do cudzych treningów.
    return null;
  }
  await ensureCriticalSchema();
  if (input.kind === "self") {
    if (input.userId !== input.viewerId) return null;
  } else if (input.kind === "friend") {
    const { friends } = await listFriendsAndPending(input.viewerId);
    const ok = friends.some(
      (f) =>
        f.userId === input.userId &&
        (f.mutualShare || f.theyShareWorkout),
    );
    if (!ok) return null;
  } else {
    const db = getDb();
    const shared = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, input.viewerId));
    let ok = false;
    for (const t of shared) {
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, t.teamId));
      if (members.some((m) => m.userId === input.userId)) {
        ok = true;
        break;
      }
    }
    if (!ok) return null;
  }

  const db = getDb();
  const [w] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, input.workoutId), eq(workouts.userId, input.userId)))
    .limit(1);
  if (!w) return null;

  return buildGhostTimeline({
    sourceKind: input.kind,
    sourceUserId: input.userId,
    sourceLabel:
      input.kind === "self"
        ? "Ty"
        : input.kind === "friend"
          ? "Znajomy"
          : "Lider",
    workoutId: w.id,
    planId: w.workoutPlanId,
    title: `Sesja ${w.date}`,
    exercisesJson: w.exercises ?? "[]",
  });
}
