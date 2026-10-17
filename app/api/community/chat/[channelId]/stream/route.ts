import { auth } from "@/auth";
import {
  assertChannelAccess,
  listChatEventsSince,
  listTypingUsers,
} from "@/lib/community/chat";
import { SSE_POLL } from "@/lib/community/perf-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE Workout Chat — adaptive poll; typing tylko przy evencie lub co 3. tick.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ channelId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { channelId } = await ctx.params;
  const access = await assertChannelAccess(channelId, session.user.id);
  if (!access.ok) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  let cursor = Number(url.searchParams.get("since") ?? Date.now());
  if (!Number.isFinite(cursor)) cursor = Date.now();

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let closed = false;
  let intervalMs: number = SSE_POLL.chatIdleMs;
  let timer: ReturnType<typeof setInterval> | null = null;
  let tickN = 0;

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

      send("ready", { channelId, since: cursor, pollMs: intervalMs });

      const tick = async () => {
        if (closed) return;
        tickN += 1;
        try {
          const events = await listChatEventsSince(channelId, cursor, 50);
          const wantTyping =
            events.some((e) => e.kind === "typing") || tickN % 3 === 0;

          if (events.length > 0) {
            for (const ev of events) {
              cursor = Math.max(cursor, ev.createdAt.getTime());
            }
            send("chat", {
              events: events.map((e) => ({
                id: e.id,
                kind: e.kind,
                entityId: e.entityId,
                actorUserId: e.actorUserId,
                createdAt: e.createdAt.getTime(),
              })),
              since: cursor,
            });
            if (intervalMs !== SSE_POLL.chatActiveMs) {
              reschedule(SSE_POLL.chatActiveMs);
            }
          } else {
            send("ping", { t: Date.now() });
            if (intervalMs !== SSE_POLL.chatIdleMs) {
              reschedule(SSE_POLL.chatIdleMs);
            }
          }

          if (wantTyping) {
            const typing = await listTypingUsers(channelId, userId);
            send("typing", { typing });
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
