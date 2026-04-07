import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fitatuTag } from "@/lib/cache-tags";
import type { FitatuDaySummary } from "@/types/fitatu";

/**
 * Fitatu does not ship a public REST API for third-party apps.
 * Point `FITATU_API_BASE_URL` + `FITATU_API_KEY` (or per-user token in DB) at your
 * partner/proxy endpoint that returns the documented JSON shape, or rely on mock data in dev.
 *
 * Expected JSON (example contract):
 * GET /v1/diary/{date}
 * { calories, proteinG, fatG, carbsG, meals: [...] }
 */
async function fetchFitatuDayFromRemote(
  userId: string,
  date: string,
): Promise<FitatuDaySummary | null> {
  const base = process.env.FITATU_API_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.FITATU_API_KEY;

  const db = getDb();
  const [row] = await db
    .select({ token: users.fitatuAccessToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const bearer = row?.token ?? apiKey;
  if (!base || !bearer) return null;

  const res = await fetch(`${base}/diary/${date}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    calories?: number;
    proteinG?: number;
    fatG?: number;
    carbsG?: number;
    meals?: Array<{
      id?: string;
      name?: string;
      calories?: number;
      proteinG?: number;
      fatG?: number;
      carbsG?: number;
      loggedAt?: string;
    }>;
  };

  const meals =
    data.meals?.map((m, i) => ({
      id: m.id ?? `meal-${i}`,
      name: m.name ?? "Meal",
      calories: Number(m.calories ?? 0),
      proteinG: Number(m.proteinG ?? 0),
      fatG: Number(m.fatG ?? 0),
      carbsG: Number(m.carbsG ?? 0),
      loggedAt: m.loggedAt ?? `${date}T12:00:00.000Z`,
    })) ?? [];

  return {
    date,
    caloriesConsumed: Number(data.calories ?? 0),
    macros: {
      protein: Number(data.proteinG ?? 0),
      fat: Number(data.fatG ?? 0),
      carbs: Number(data.carbsG ?? 0),
    },
    meals,
    source: "live",
  };
}

function mockSummary(date: string): FitatuDaySummary {
  return {
    date,
    caloriesConsumed: 1840,
    caloriesGoal: 2200,
    macros: { protein: 142, fat: 58, carbs: 198 },
    meals: [
      {
        id: "1",
        name: "Oats & berries",
        calories: 420,
        proteinG: 18,
        fatG: 12,
        carbsG: 58,
        loggedAt: `${date}T08:15:00.000Z`,
      },
      {
        id: "2",
        name: "Chicken bowl",
        calories: 720,
        proteinG: 62,
        fatG: 22,
        carbsG: 64,
        loggedAt: `${date}T13:05:00.000Z`,
      },
      {
        id: "3",
        name: "Greek yogurt",
        calories: 180,
        proteinG: 18,
        fatG: 4,
        carbsG: 14,
        loggedAt: `${date}T21:40:00.000Z`,
      },
    ],
    source: "mock",
  };
}

export function getTodaysMacrosCached(userId: string) {
  const date = new Date().toISOString().slice(0, 10);
  return unstable_cache(
    async () => {
      const remote = await fetchFitatuDayFromRemote(userId, date);
      if (remote) return remote;
      return mockSummary(date);
    },
    ["fitatu-today", userId, date],
    { revalidate: 300, tags: [fitatuTag(userId)] },
  )();
}
