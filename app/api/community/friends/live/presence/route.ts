import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  clearFriendLivePresence,
  upsertFriendLivePresence,
} from "@/lib/community/friend-live";
import { parsePresence } from "@/lib/community/group-workout-types";
import { notifyMutualShareFriendsOnWorkoutStart } from "@/lib/community/notifications";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  presence: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
  /** true tylko przy pierwszym ticku sesji — fan-out powiadomień. */
  notifyStart: z.boolean().optional(),
  startedAtMs: z.number().optional().nullable(),
});

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("friend-live-presence", req),
    120,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.active === false) {
    await clearFriendLivePresence(userId);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const presence = parsePresence(
    JSON.stringify(parsed.data.presence ?? {}),
  );
  const result = await upsertFriendLivePresence({
    userId,
    presence,
    startedAt:
      parsed.data.startedAtMs != null
        ? new Date(parsed.data.startedAtMs)
        : null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }

  if (parsed.data.notifyStart) {
    await notifyMutualShareFriendsOnWorkoutStart({
      actorUserId: userId,
      actorDisplayName: presence.displayName,
      href: `/community/friends/${userId}/live`,
    });
  }

  return NextResponse.json({ ok: true });
}
