import { and, desc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type CardioStory = {
  id: string;
  caption: string;
  createdAt: number;
  expiresAt: number;
  minutes?: number | null;
  distanceKm?: number | null;
  machineId?: string | null;
};

function parseStory(json: string, id: string): CardioStory | null {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (o.kind !== "story") return null;
    const createdAt = Number(o.createdAt ?? 0);
    const expiresAt = Number(o.expiresAt ?? 0);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return null;
    if (Date.now() > expiresAt) return null;
    return {
      id,
      caption: typeof o.caption === "string" ? o.caption : "",
      createdAt,
      expiresAt,
      minutes: typeof o.minutes === "number" ? o.minutes : null,
      distanceKm: typeof o.distanceKm === "number" ? o.distanceKm : null,
      machineId: typeof o.machineId === "string" ? o.machineId : null,
    };
  } catch {
    return null;
  }
}

export async function listActiveStories(): Promise<CardioStory[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const db = getDb();
  const since = calendarDateKey(new Date(Date.now() - STORY_TTL_MS));
  const rows = await db
    .select({ id: workouts.id, exercises: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.userId, session.user.id), gte(workouts.date, since)))
    .orderBy(desc(workouts.date))
    .limit(40);

  const out: CardioStory[] = [];
  for (const r of rows) {
    const s = parseStory(r.exercises, r.id);
    if (s) out.push(s);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
}

export async function createStoryAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Zaloguj się, aby dodać story." };
  }
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 200);
  if (!caption) return { ok: false, error: "Wpisz krótki podpis." };

  const minutesRaw = Number(formData.get("minutes") ?? 0);
  const distanceRaw = Number(formData.get("distanceKm") ?? 0);
  const machineId = String(formData.get("machineId") ?? "").trim() || null;
  const now = Date.now();

  const db = getDb();
  await db.insert(workouts).values({
    userId: session.user.id,
    date: calendarDateKey(new Date()),
    cardioMinutes: 0,
    exercises: JSON.stringify({
      kind: "story",
      caption,
      createdAt: now,
      expiresAt: now + STORY_TTL_MS,
      minutes: Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.round(minutesRaw) : null,
      distanceKm:
        Number.isFinite(distanceRaw) && distanceRaw > 0
          ? Math.round(distanceRaw * 100) / 100
          : null,
      machineId,
    }),
  });

  revalidatePath("/cardio");
  return { ok: true };
}
