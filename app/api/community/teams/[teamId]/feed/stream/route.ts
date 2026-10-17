import { auth } from "@/auth";
import { SSE_POLL } from "@/lib/community/perf-cache";
import {
  assertActiveTeamMember,
  listTeamFeedEventsSince,
} from "@/lib/community/team-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE Team Feed — adaptive poll (idle 5s / active 1.5s) by zmniejszyć QPS przy skali.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { teamId } = await ctx.params;
  const member = await assertActiveTeamMember(teamId, session.user.id);
  if (!member.ok) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  let cursor = Number(url.searchParams.get("since") ?? Date.now());
  if (!Number.isFinite(cursor)) cursor = Date.now();

  const encoder = new TextEncoder();
  let closed = false;
  let intervalMs: number = SSE_POLL.idleMs;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const reschedule = (ms: number) => {
        if (closed) return;
        if (timer) clearInterval(timer);
        intervalMs = ms;
        timer = setInterval(() => {
          void tick();
        }, intervalMs);
      };

      send("ready", { teamId, since: cursor, pollMs: intervalMs });

      const tick = async () => {
        if (closed) return;
        try {
          const events = await listTeamFeedEventsSince(teamId, cursor, 40);
          if (events.length > 0) {
            for (const ev of events) {
              cursor = Math.max(cursor, ev.createdAt.getTime());
            }
            send("feed", {
              events: events.map((e) => ({
                id: e.id,
                kind: e.kind,
                entityId: e.entityId,
                actorUserId: e.actorUserId,
                createdAt: e.createdAt.getTime(),
              })),
              since: cursor,
            });
            if (intervalMs !== SSE_POLL.activeMs) reschedule(SSE_POLL.activeMs);
          } else {
            send("ping", { t: Date.now() });
            if (intervalMs !== SSE_POLL.idleMs) reschedule(SSE_POLL.idleMs);
          }
        } catch {
          send("error", { message: "sync_failed" });
        }
      };

      void tick();
      timer = setInterval(() => {
        void tick();
      }, intervalMs);

      const onAbort = () => {
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
