"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { outboxList, outboxRemove } from "@/lib/workout-outbox-db";

/**
 * Próbuje wysłać oczekujące treningi po powrocie online / przy starcie aplikacji.
 */
export function WorkoutOutboxFlush() {
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    async function flush() {
      if (busy.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      busy.current = true;
      try {
        const items = await outboxList();
        for (const item of items) {
          try {
            await ensureCsrfCookie();
            const res = await fetch("/api/workouts/complete", {
              method: "POST",
              credentials: "include",
              headers: {
                "content-type": "application/json",
                ...getXsrfHeaders(),
              },
              body: JSON.stringify(item.payload),
            });
            const data = (await res.json()) as { ok?: boolean };
            if (res.ok && data.ok) {
              await outboxRemove(item.id);
            }
          } catch {
            /* następna próba przy kolejnym odświeżeniu / online */
          }
        }
        if (items.length > 0) {
          router.refresh();
        }
      } finally {
        busy.current = false;
      }
    }

    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const id = window.setInterval(() => void flush(), 120_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [router]);

  return null;
}
