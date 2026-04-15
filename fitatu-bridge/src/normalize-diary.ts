/**
 * Mapuje różne możliwe kształty JSON z aplikacji / proxy na kontrakt GymBrat.
 * Jeśli upstream już zwraca pola jak w GymBrat — przepuszczamy je.
 */

export type GymBratDiaryJson = {
  calories: number;
  caloriesGoal?: number;
  proteinG: number;
  proteinGoalG?: number;
  fatG: number;
  fatGoalG?: number;
  carbsG: number;
  carbsGoalG?: number;
  meals: Array<{
    id: string;
    name: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    loggedAt: string;
  }>;
};

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function findTokenDeep(obj: unknown, depth = 0): string | null {
  if (depth > 8 || obj == null) return null;
  if (typeof obj === "string" && obj.length > 24 && /^[\w-]+\.[\w-]+\./.test(obj)) {
    return obj;
  }
  if (typeof obj !== "object") return null;
  const preferred = [
    "accessToken",
    "access_token",
    "token",
    "idToken",
    "id_token",
    "sessionToken",
    "jwt",
    "bearer",
  ];
  for (const k of preferred) {
    if (k in (obj as object)) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === "string" && v.length > 8) return v;
    }
  }
  for (const v of Object.values(obj as object)) {
    const t = findTokenDeep(v, depth + 1);
    if (t) return t;
  }
  return null;
}

export function extractUpstreamAuthToken(body: unknown): string | null {
  return findTokenDeep(body);
}

export function normalizeDiaryResponse(raw: unknown, date: string): GymBratDiaryJson {
  if (raw == null || typeof raw !== "object") {
    return emptyDiary(date);
  }

  const o = raw as Record<string, unknown>;

  if (
    typeof o.calories === "number" ||
    typeof o.calories === "string" ||
    typeof o.proteinG === "number"
  ) {
    return {
      calories: num(o.calories),
      caloriesGoal: o.caloriesGoal != null ? num(o.caloriesGoal) : undefined,
      proteinG: num(o.proteinG),
      proteinGoalG: o.proteinGoalG != null ? num(o.proteinGoalG) : undefined,
      fatG: num(o.fatG),
      fatGoalG: o.fatGoalG != null ? num(o.fatGoalG) : undefined,
      carbsG: num(o.carbsG),
      carbsGoalG: o.carbsGoalG != null ? num(o.carbsGoalG) : undefined,
      meals: normalizeMeals(o.meals, date),
    };
  }

  const totals =
    (o.totals as Record<string, unknown> | undefined) ??
    (o.summary as Record<string, unknown> | undefined) ??
    (o.daily as Record<string, unknown> | undefined);
  const goals =
    (o.goals as Record<string, unknown> | undefined) ??
    (o.targets as Record<string, unknown> | undefined);

  const calories = num(
    o.caloriesConsumed ?? o.consumedCalories ?? totals?.calories ?? totals?.kcal ?? 0,
  );
  const caloriesGoal = goals?.calories != null ? num(goals.calories) : num(o.calorieGoal, NaN);
  const proteinG = num(
    o.protein ?? totals?.protein ?? totals?.proteinG ?? (totals?.p as number | string | undefined),
  );
  const fatG = num(o.fat ?? totals?.fat ?? totals?.fatG);
  const carbsG = num(o.carbs ?? totals?.carbs ?? totals?.carbsG ?? totals?.carbohydrates);

  return {
    calories,
    caloriesGoal: Number.isFinite(caloriesGoal) ? caloriesGoal : undefined,
    proteinG,
    proteinGoalG: goals?.protein != null ? num(goals.protein) : undefined,
    fatG,
    fatGoalG: goals?.fat != null ? num(goals.fat) : undefined,
    carbsG,
    carbsGoalG: goals?.carbs != null ? num(goals.carbs) : undefined,
    meals: normalizeMeals(o.meals ?? o.entries ?? o.foods ?? o.items, date),
  };
}

function emptyDiary(date: string): GymBratDiaryJson {
  return {
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    meals: [],
  };
}

function normalizeMeals(raw: unknown, date: string): GymBratDiaryJson["meals"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m, i) => {
    if (m == null || typeof m !== "object") {
      return {
        id: `m-${i}`,
        name: "Posiłek",
        calories: 0,
        proteinG: 0,
        fatG: 0,
        carbsG: 0,
        loggedAt: `${date}T12:00:00.000Z`,
      };
    }
    const x = m as Record<string, unknown>;
    const name =
      typeof x.name === "string"
        ? x.name
        : typeof x.title === "string"
          ? x.title
          : "Posiłek";
    return {
      id: typeof x.id === "string" ? x.id : `m-${i}`,
      name,
      calories: num(x.calories ?? x.kcal ?? x.energy),
      proteinG: num(x.proteinG ?? x.protein),
      fatG: num(x.fatG ?? x.fat),
      carbsG: num(x.carbsG ?? x.carbs ?? x.carbohydrates),
      loggedAt:
        typeof x.loggedAt === "string"
          ? x.loggedAt
          : typeof x.time === "string"
            ? x.time
            : `${date}T12:00:00.000Z`,
    };
  });
}
