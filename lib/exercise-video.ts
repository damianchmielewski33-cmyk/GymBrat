/**
 * Linki do filmów instruktażowych.
 * Bez hardcodowania setek URL — domyślnie YouTube search po nazwie PL;
 * opcjonalne nadpisania dla popularnych ruchów.
 */

const VIDEO_OVERRIDES: Record<string, string> = {
  "c-bench-bar": "https://www.youtube.com/results?search_query=bench+press+technique",
  "c-bench-db": "https://www.youtube.com/results?search_query=dumbbell+bench+press+technique",
  "c-incline-bar": "https://www.youtube.com/results?search_query=incline+bench+press+technique",
  "c-dips": "https://www.youtube.com/results?search_query=chest+dips+technique",
  "q-squat": "https://www.youtube.com/results?search_query=barbell+back+squat+technique",
  "bl-deadlift": "https://www.youtube.com/results?search_query=conventional+deadlift+technique",
};

export function youtubeSearchUrl(exerciseName: string): string {
  const q = encodeURIComponent(`${exerciseName.trim()} technika ćwiczenia`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

export function resolveExerciseVideoUrl(opts: {
  catalogId?: string | null;
  name: string;
  overrideUrl?: string | null;
}): string {
  const override = opts.overrideUrl?.trim();
  if (override) return override;
  const id = opts.catalogId?.trim();
  if (id && VIDEO_OVERRIDES[id]) return VIDEO_OVERRIDES[id]!;
  return youtubeSearchUrl(opts.name);
}

/** Walidacja tempa: 2–4 liczby oddzielone myślnikiem, np. 3-1-2-0. */
export function normalizeTempo(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/,/g, "-").replace(/\s+/g, "");
  if (!t) return null;
  if (!/^\d{1,2}(-\d{1,2}){1,3}$/.test(t)) return null;
  return t;
}
