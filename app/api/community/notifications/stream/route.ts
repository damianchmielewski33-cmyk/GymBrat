import { withApiErrors } from "@/lib/errors/api";
import { auth } from "@/auth";
import { SSE_POLL } from "@/lib/community/perf-cache";
import { SSE_MAX_CONNECTION_MS } from "@/lib/community/realtime-config";
import {
  countUnreadNotifications,
  listNotificationEventsSince,
} from "@/lib/community/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * SSE notification inbox — adaptive poll + cached unread count.
 * Połączenie zamykane po SSE_MAX_CONNECTION_MS (krótkie invocacje na Hobby).
 */
async function handleGET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  let cursor = Number(url.searchParams.get("since") ?? Date.now());
  if (!Number.isFinite(cursor)) cursor = Date.now();

  const encoder = new TextEncoder();
  let closed = false;
  let intervalMs: number = SSE_POLL.idleMs;
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

      send("ready", { since: cursor, pollMs: intervalMs });

      const tick = async () => {
        if (closed) return;
        tickN += 1;
        try {
          const events = await listNotificationEventsSince(userId, cursor, 40);
          // Unread count: co tick przy evencie, inaczej co 3. tick (cache i tak 2s)
          const needCount = events.length > 0 || tickN % 3 === 0;
          const unreadCount = needCount
            ? await countUnreadNotifications(userId)
            : undefined;

          if (events.length > 0) {
            for (const ev of events) {
              cursor = Math.max(cursor, ev.createdAt.getTime());
            }
            send("notification", {
              events: events.map((e) => ({
                id: e.id,
                kind: e.kind,
                notificationId: e.notificationId,
                createdAt: e.createdAt.getTime(),
              })),
              unreadCount,
              since: cursor,
            });
            if (intervalMs !== SSE_POLL.activeMs) reschedule(SSE_POLL.activeMs);
          } else {
            send("ping", {
              t: Date.now(),
              ...(unreadCount != null ? { unreadCount } : {}),
            });
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
      setTimeout(onAbort, SSE_MAX_CONNECTION_MS);
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

export const GET = withApiErrors(handleGET);
