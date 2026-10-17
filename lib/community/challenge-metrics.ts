import type {
  ChallengeMetricFilter,
  ChallengeMetricKind,
} from "@/lib/community/challenge-types";

type WorkoutSet = {
  reps?: number | null;
  weight?: number;
  done?: boolean;
  skipped?: boolean;
};

type WorkoutExercise = {
  name?: string;
  sets?: WorkoutSet[];
};

export type WorkoutMetricSource = {
  workoutId: string;
  exercisesJson: string;
  cardioMinutes: number;
};

function parseExercises(json: string): WorkoutExercise[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as WorkoutExercise[];
    if (parsed && typeof parsed === "object") {
      const o = parsed as {
        exercises?: unknown;
        cardio?: { distanceKm?: number | null };
      };
      if (Array.isArray(o.exercises)) return o.exercises as WorkoutExercise[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function parseDistanceKm(json: string): number {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return 0;
    const cardio = (parsed as { cardio?: { distanceKm?: unknown } }).cardio;
    const d = Number(cardio?.distanceKm);
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch {
    return 0;
  }
}

function nameMatches(name: string, keywords: string[]): boolean {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return keywords.some((kw) => {
    const k = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return n.includes(k);
  });
}

function activeSets(ex: WorkoutExercise): WorkoutSet[] {
  return (ex.sets ?? []).filter(
    (s) => !s.skipped && s.done !== false && (Number(s.reps) || 0) > 0,
  );
}

/**
 * Delta metryki z jednej ukończonej sesji (do inkrementacji progress).
 */
export function computeWorkoutMetricDelta(
  metricKind: ChallengeMetricKind,
  filter: ChallengeMetricFilter,
  source: WorkoutMetricSource,
): number {
  const exercises = parseExercises(source.exercisesJson);
  const keywords = filter.exerciseKeywords ?? [];

  switch (metricKind) {
    case "sessions":
      return 1;
    case "cardio_minutes":
      return Math.max(0, Math.round(source.cardioMinutes));
    case "distance_km": {
      const km = parseDistanceKm(source.exercisesJson);
      // Zaokrąglamy do 0.1 km w skali *10? Trzymamy integer — zapisujemy metry w dekametrach? 
      // Lepiej: przechowuj km * 10 (decy-km) albo zaokrąglij w górę do pełnych km przy małym dystansie.
      // Używamy setnych: value w bazie = floor(km * 100) dla dystansu? 
      // Prościej: integer = Math.round(km) — dla 100 km OK; małe sesje też wnoszą.
      // Jeszcze lepiej: przechowuj w metrach.
      return Math.max(0, Math.round(km * 1000)); // metry
    }
    case "tonnage_kg": {
      let t = 0;
      for (const ex of exercises) {
        for (const s of activeSets(ex)) {
          t += (Number(s.weight) || 0) * (Number(s.reps) || 0);
        }
      }
      return Math.max(0, Math.round(t));
    }
    case "reps": {
      let reps = 0;
      for (const ex of exercises) {
        const name = ex.name ?? "";
        if (keywords.length > 0 && !nameMatches(name, keywords)) continue;
        for (const s of activeSets(ex)) {
          reps += Number(s.reps) || 0;
        }
      }
      return Math.max(0, Math.round(reps));
    }
    case "sets": {
      let sets = 0;
      for (const ex of exercises) {
        const name = ex.name ?? "";
        if (keywords.length > 0 && !nameMatches(name, keywords)) continue;
        sets += activeSets(ex).length;
      }
      return Math.max(0, sets);
    }
    default:
      return 0;
  }
}

/** Wyświetlana wartość / target — distance_km trzymamy w metrach. */
export function displayMetricValue(
  metricKind: ChallengeMetricKind,
  raw: number,
): number {
  if (metricKind === "distance_km") {
    return Math.round((raw / 1000) * 10) / 10;
  }
  return raw;
}

export function storageTargetValue(
  metricKind: ChallengeMetricKind,
  displayTarget: number,
): number {
  if (metricKind === "distance_km") {
    return Math.round(displayTarget * 1000);
  }
  return Math.round(displayTarget);
}

export function formatMetricDisplay(
  metricKind: ChallengeMetricKind,
  raw: number,
  unitLabel: string,
): string {
  const v = displayMetricValue(metricKind, raw);
  if (metricKind === "distance_km") {
    return `${v} ${unitLabel || "km"}`;
  }
  return `${Math.round(v).toLocaleString("pl-PL")} ${unitLabel}`.trim();
}
