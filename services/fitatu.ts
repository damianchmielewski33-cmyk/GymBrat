import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fitatuTag } from "@/lib/cache-tags";
import type { FitatuDaySummary } from "@/types/fitatu";

function errorSummary(date: string, message: string): FitatuDaySummary {
  return {
    date,
    caloriesConsumed: 0,
    macros: { protein: 0, fat: 0, carbs: 0 },
    meals: [],
    source: "error",
    errorMessage: message,
  };
}

/**
 * Fitatu does not ship a public REST API for third-party apps.
 * Point `FITATU_API_BASE_URL` + `FITATU_API_KEY` (or per-user token in DB) at your
 * partner/proxy endpoint that returns the documented JSON shape, or rely on mock data in dev.
 *
 * Expected JSON (example contract):
 * GET /diary/{date}
 * { calories, caloriesGoal?, proteinG, proteinGoalG?, fatG, fatGoalG?, carbsG, carbsGoalG?, meals: [...] }
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

  const userToken = row?.token ?? null;
  const bearer = userToken ?? apiKey;

  if (userToken && !base) {
    return errorSummary(
      date,
      "Masz zapisany token Fitatu, ale brak zmiennej FITATU_API_BASE_URL — ustaw adres proxy, aby pobrać dane.",
    );
  }

  if (!base || !bearer) return null;

  let res: Response;
  try {
    res = await fetch(`${base}/diary/${date}`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });
  } catch {
    return userToken
      ? errorSummary(date, "Nie udało się połączyć z proxy Fitatu.")
      : null;
  }

  if (!res.ok) {
    return userToken
      ? errorSummary(
          date,
          `Proxy Fitatu zwróciło błąd HTTP ${res.status}. Sprawdź token lub endpoint.`,
        )
      : null;
  }

  let data: {
    calories?: number;
    caloriesGoal?: number;
    proteinG?: number;
    proteinGoalG?: number;
    fatG?: number;
    fatGoalG?: number;
    carbsG?: number;
    carbsGoalG?: number;
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

  try {
    data = (await res.json()) as typeof data;
  } catch {
    return userToken
      ? errorSummary(date, "Proxy zwróciło nieprawidłowy JSON.")
      : null;
  }

  const hasMacroGoals =
    data.proteinGoalG != null || data.fatGoalG != null || data.carbsGoalG != null;

  const meals =
    data.meals?.map((m, i) => ({
      id: m.id ?? `meal-${i}`,
      name: m.name ?? "Posiłek",
      calories: Number(m.calories ?? 0),
      proteinG: Number(m.proteinG ?? 0),
      fatG: Number(m.fatG ?? 0),
      carbsG: Number(m.carbsG ?? 0),
      loggedAt: m.loggedAt ?? `${date}T12:00:00.000Z`,
    })) ?? [];

  return {
    date,
    caloriesConsumed: Number(data.calories ?? 0),
    caloriesGoal:
      data.caloriesGoal != null ? Number(data.caloriesGoal) : undefined,
    macros: {
      protein: Number(data.proteinG ?? 0),
      fat: Number(data.fatG ?? 0),
      carbs: Number(data.carbsG ?? 0),
    },
    macroGoals: hasMacroGoals
      ? {
          protein: Number(data.proteinGoalG ?? 0),
          fat: Number(data.fatGoalG ?? 0),
          carbs: Number(data.carbsGoalG ?? 0),
        }
      : undefined,
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
    macroGoals: { protein: 180, fat: 75, carbs: 250 },
    meals: [
      {
        id: "1",
        name: "Owsianka z owocami",
        calories: 420,
        proteinG: 18,
        fatG: 12,
        carbsG: 58,
        loggedAt: `${date}T08:15:00.000Z`,
      },
      {
        id: "2",
        name: "Bowl z kurczakiem",
        calories: 720,
        proteinG: 62,
        fatG: 22,
        carbsG: 64,
        loggedAt: `${date}T13:05:00.000Z`,
      },
      {
        id: "3",
        name: "Jogurt grecki",
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
