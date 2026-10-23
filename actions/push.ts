"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { pushSubscriptions } from "@/db/schema";
import { guardAction } from "@/lib/action-guard";
import { headers } from "next/headers";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(10).max(256),
    auth: z.string().min(8).max(128),
  }),
});

/** Zapisuje (lub przepisuje na bieżące konto) subskrypcję Web Push tej przeglądarki. */
export async function savePushSubscriptionAction(input: unknown) {
  await guardAction("push.savePushSubscriptionAction");
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Nieprawidłowa subskrypcja powiadomień." };
  }

  await ensureCriticalSchema();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const { endpoint, keys } = parsed.data;

  await getDb()
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });

  return { ok: true as const };
}

export async function removePushSubscriptionAction(endpoint: unknown) {
  await guardAction("push.removePushSubscriptionAction");
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };
  if (typeof endpoint !== "string" || endpoint.length > 2048) {
    return { ok: false as const, error: "Nieprawidłowy adres subskrypcji." };
  }

  await ensureCriticalSchema();
  await getDb()
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, session.user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
  return { ok: true as const };
}
