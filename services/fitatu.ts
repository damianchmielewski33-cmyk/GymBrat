import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fitatuTag } from "@/lib/cache-tags";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import { calendarDateKey } from "@/lib/local-date";
import type { FitatuDaySummary } from "@/types/fitatu";

/** Spójnie z resztą aplikacji: kcal tylko z makr (dzień i posiłki). */
function normalizeFitatuSummary(s: FitatuDaySummary): FitatuDaySummary {
  const mg = s.macroGoals;
  const caloriesGoal =
    mg != null && mg.protein + mg.fat + mg.carbs > 0
      ? kcalFromMacros(mg.protein, mg.fat, mg.carbs)
      : s.caloriesGoal;
  return {
    ...s,
    caloriesConsumed: kcalFromMacros(
      s.macros.protein,
      s.macros.fat,
      s.macros.carbs,
    ),
    caloriesGoal,
    meals: s.meals.map((m) => ({
      ...m,
      calories: kcalFromMacros(m.proteinG, m.fatG, m.carbsG),
    })),
  };
}

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
      calories: 0,
      proteinG: Number(m.proteinG ?? 0),
      fatG: Number(m.fatG ?? 0),
      carbsG: Number(m.carbsG ?? 0),
      loggedAt: m.loggedAt ?? `${date}T12:00:00.000Z`,
    })) ?? [];

  const raw: FitatuDaySummary = {
    date,
    caloriesConsumed: 0,
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

  return normalizeFitatuSummary(raw);
}

/** Brak integracji Fitatu / odpowiedzi — bez fałszywych posiłków (np. nowe konto na produkcji). */
function emptyFitatuSummary(date: string): FitatuDaySummary {
  const raw: FitatuDaySummary = {
    date,
    caloriesConsumed: 0,
    macros: { protein: 0, fat: 0, carbs: 0 },
    meals: [],
    source: "unavailable",
  };
  return normalizeFitatuSummary(raw);
}

function mockSummary(date: string): FitatuDaySummary {
  const raw: FitatuDaySummary = {
    date,
    caloriesConsumed: 0,
    caloriesGoal: 2200,
    macros: { protein: 142, fat: 58, carbs: 198 },
    macroGoals: { protein: 180, fat: 75, carbs: 250 },
    meals: [
      {
        id: "1",
        name: "Owsianka z owocami",
        calories: 0,
        proteinG: 18,
        fatG: 12,
        carbsG: 58,
        loggedAt: `${date}T08:15:00.000Z`,
      },
      {
        id: "2",
        name: "Bowl z kurczakiem",
        calories: 0,
        proteinG: 62,
        fatG: 22,
        carbsG: 64,
        loggedAt: `${date}T13:05:00.000Z`,
      },
      {
        id: "3",
        name: "Jogurt grecki",
        calories: 0,
        proteinG: 18,
        fatG: 4,
        carbsG: 14,
        loggedAt: `${date}T21:40:00.000Z`,
      },
    ],
    source: "mock",
  };
  return normalizeFitatuSummary(raw);
}

function fallbackWhenNoRemote(date: string): FitatuDaySummary {
  return process.env.NODE_ENV === "development"
    ? mockSummary(date)
    : emptyFitatuSummary(date);
}

/** Dziennik Fitatu dla dowolnej daty YYYY-MM-DD (cache per dzień). */
export async function getFitatuDayCached(
  userId: string,
  date: string,
): Promise<FitatuDaySummary> {
  try {
    return await unstable_cache(
      async () => {
        try {
          const remote = await fetchFitatuDayFromRemote(userId, date);
          if (remote) return remote;
          return fallbackWhenNoRemote(date);
        } catch (err) {
          console.error("[fitatu] load inside cache", { userId, date, err });
          return fallbackWhenNoRemote(date);
        }
      },
      ["fitatu-day", userId, date],
      { revalidate: 300, tags: [fitatuTag(userId)] },
    )();
  } catch (err) {
    console.error("[fitatu] unstable_cache failed, fallback bez cache", {
      userId,
      date,
      err,
    });
    try {
      const remote = await fetchFitatuDayFromRemote(userId, date);
      if (remote) return remote;
    } catch (e2) {
      console.error("[fitatu] direct fetch after cache error", e2);
    }
    return fallbackWhenNoRemote(date);
  }
}

/** Dzisiejszy dzień w kalendarzu lokalnym serwera (spójnie z treningami / profilem). */
export function getTodaysMacrosCached(userId: string) {
  const date = calendarDateKey(new Date());
  return getFitatuDayCached(userId, date);
}
